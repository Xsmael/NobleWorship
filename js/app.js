var mongoose = require('mongoose');
var songWebAPI = require('lyrics-scraper');
var bible = require('bible-parser');
var log = require("noogger").init({
    fileOutput: true
});

var http = require('http');
var faye = require('faye');

var PORT=  7003;
var httpServer = http.createServer();
bayeux = new faye.NodeAdapter({mount: '/'});
bayeux.attach(httpServer);
httpServer.listen(PORT);


mongoose.connect('mongodb://127.0.0.1:27017/simpleWorship');

var Schema = mongoose.Schema;
var BibleVerseSchema =  new Schema({
    testament: String,
    book: String,
    chapter: Number,
    verse: Number,
    word: String,
    lang: String

});

var songSchema= new Schema({
    title: String,
    author: String,
    verses: [String],
    lang: String
});

songSchema.index({
    title: "text",
    author: "text",
    verses: "text"
}, {
    weights: {
        title: 10,
        author: 5,
        verses: 1
    },
    name: "TextIndex"
})
var Song = mongoose.model('Song', songSchema);

/*

db.songs.createIndex({
    author: "text",
    title: "text",
    verses: "text"
}, {
    weights: {
        author: 5,
        title: 10,
        verses: 5
    },
    name: "TextIndex"
})

*/

function parseVerse(str) {
    var s = str.replace(/\s/g, ""); //remove all white spaces
    var re = /^([1-9]?)([a-zA-Z]+)([1-9][0-9]?[0-9]?)(?::([1-9][0-9]?[0-9]?)(?:-([1-9][0-9]?[0-9]?))?)?$/; //my custom bible verse regex
    var ref = re.exec(s);
    if (!ref) return;
    if (parseInt(ref[5]) < parseInt(ref[4])) return;
    return {
        book: ref[1] + ref[2],
        chapter: ref[3],
        verse1: ref[4],
        verse2: ref[5] || ref[4]
    }
}

angular.module("main", ['faye','ui-notification','ngBootbox','ng-fileDialog'])
    .config(function(NotificationProvider) {
            NotificationProvider.setOptions({
                delay: 5000,
                startTop: 20,
                startRight: 10,
                verticalSpacing: 20,
                horizontalSpacing: 20,
                positionX: 'right',
                positionY: 'bottom'
            })
        })
    .factory('FayeFactory', function ($faye) {
        return $faye("http://localhost:7003/");
    })

    .controller("MainController", function ($scope, $rootScope) {
        $scope.showBiblePanel = false;
        $scope.showSongPanel = false;

        $scope.loadPanel = function (panel) { // "bible-panel"
            panel = panel.split('-')[0];
            // $("#display-area").innerHTML='<object type="text/html" data="bible.html" ></object>';
            // $("#display-area").load("panels/"+panel+".html", function(){

            // });

            switch (panel) {
                case 'bible':
                    $scope.showBiblePanel = true;
                    break;
                case 'song':
                    $scope.showSongPanel = true;
                    break;
                case 'preview':
                    $scope.showPreviewPanel = true;
                    break;
            }
        }
        $scope.unloadPanel = function (panel) { // "bible-panel"
            panel = panel.split('-')[0];
            // $("#display-area").innerHTML='<object type="text/html" data="bible.html" ></object>';
            // $("#display-area").load("panels/"+panel+".html", function(){

            // });

            switch (panel) {
                case 'bible':
                    $scope.showBiblePanel = false;
                    break;
                case 'song':
                    $scope.showSongPanel = false;
                    break;
                case 'preview':
                    $scope.showPreviewPanel = false;
                    break;
            }
        }
    })

    .controller("BiblePanelController", function ($scope, $rootScope, FayeFactory, Notification, FileDialog) {
        $scope.pannelTitle = "Bible";
        $scope.verse = "";
        $scope.verses = [];
        $scope.bibles = [];
        $scope.currentBible;
        $scope.view = {};
        
        /** get the installed bibles */
        mongoose.connection.db.listCollections().toArray(function (err, names) {
            if (err) {
              console.log(err);
            } else {
              names.forEach(function(collection) {
                  if( /\w+__\w+__\w+__bible.+/.exec(collection.name)) {
                      console.log(collection.name);
                      var info= collection.name.split('__');
                      var bible= {
                          abbrVersion: info[0],
                          version: info[1].replace(/_/g,' '),
                          lang: info[2]
                      }
                      $scope.bibles.push(bible);
                    var model= info[0]+'__'+info[1]+'__'+info[2]+'__bible';                    
                    $scope.currentBible=  mongoose.model(model,BibleVerseSchema);  
                    $scope.currentBibleVersion=info[0];
                }
              });
            }
        });

        $scope.changeBibleVersion = function (abbrVersion) {
            $scope.currentBibleVersion=abbrVersion;
            $scope.bibles.forEach(function(b) {
                if(b.abbrVersion== abbrVersion) {
                    var model= b.abbrVersion+'__'+b.version.replace(/ /g,'_')+'__'+b.lang+'__bible';
                    $scope.currentBible=  mongoose.model(model,BibleVerseSchema);  
                    console.log( $scope.verseRef );

                    if( $scope.verseRef )  { $scope.findVerse( $scope.verseRef );}
                }
            }, this);
            
        }
    
        $scope.changeView= function(action, song) {
            toggleView(action);

            switch(action) {
                case 'read':
                    // anything here
                break;

                case 'manage':
                // anything here
                break;
            }

            function toggleView( v ) {
                for (var view in  $scope.view) {
                    if ( $scope.view.hasOwnProperty(view)) {
                      $scope.view[view]= false;
                    }
                }
                $scope.view[v]= true;
            }
        }

        $scope.findVerse = function (ref) {

            var verse = parseVerse(ref);
            if (verse) {
                var query = {
                    book: verse.book,
                    chapter: verse.chapter,
                    verse: {
                        $gte: verse.verse1,
                        $lte: verse.verse2
                    }
                }
                if (!verse.verse1) delete query.verse;

                $scope.currentBible.find(query, function (err, verses) {
                    if (err) console.err(err);
                    else console.info(verses);

                    $scope.verses = verses;
                    $scope.verseRef = ref;
                    $scope.$apply();

                    var read = "";
                    $scope.verses.forEach(function (v) {
                        read += '<span class="verse-no">' + v.verse + '</span> <span class="verse-content">' + v.word + '</span>';

                    }, this);

                    FayeFactory.publish("/msg", {
                        displayText: read
                    });
                });

            }


        }
        
        $scope.addBible= function () {
            $scope.addBibleCount=0;
            FileDialog.selectFile(function (file) {
                if(file) {
                    var path= file.path.replace(/\\/g,'/');
                    var bibleInfo= bible.getInfo(path);
                    console.log(bibleInfo);

                    var modelName= bibleInfo.abbrVersion+'__'+bibleInfo.version.replace(/ /g,'_').replace(/\d|\W/g,'')+'__'+bibleInfo.lang+'__bible';
                    var newBibleVersion=  mongoose.model(modelName,BibleVerseSchema);  
                    bible.parse(path, "GETBIBLE.NET", function (verse, done) {
                        newBibleVersion.create(verse, function(err, obj){
                        });                         
                        $scope.addBibleCount++;
                        if(done) Notification.success(bibleInfo.version+" bible has been loaded successfully!");
                    });
                }
            });
        };

    })
    .controller("SongPanelController", function ($scope, $rootScope, FayeFactory, Notification) {
        $scope.pannelTitle = "Song book";
        $scope.songList= [];
        $scope.view= {};
        $scope.view.browse= true;

        $scope.changeView= function(action, song) {
            toggleView(action);

            switch(action) {
                case 'play':
                    $scope.currentSong=song ;
                break;

                case 'edit':
                 $scope.editedSong= {
                    title: song.title,
                    author: song.author,
                    lyrics: song.verses.join("\n\n")
                };
                break;
            }

            function toggleView( v ) {
                for (var view in  $scope.view) {
                    if ( $scope.view.hasOwnProperty(view)) {
                      $scope.view[view]= false;
                    }
                }
                $scope.view[v]= true;
            }
        }
        $scope.findSong= function(keywords) {

            Song.find(
                { $text: { $search: keywords} }, 
                { score: { $meta: "textScore" } } 
            )
            .sort({ score: { $meta: 'textScore' } } )
            .exec( function (err, songs) {
                if(err)  console.err(err);

                $scope.$apply(function () {
                    $scope.songList = songs;      
                });
            });
            songWebAPI.query(keywords, function(result) {
                    $scope.$apply(function () {
                        $scope.songsFromWeb= result;  
                    });
                })
        }
        $scope.getSong = function (id) {
            Song.find({
                _id: id
            }, function (err, song) {
                if (err) log.error(err);
            });
        }

        $scope.createSong = function (song) {

            song.verses= song.lyrics.split(/\n\n+/);
            Song.create(song, function (err, res) {
                    if (err)  Notification.error("Song not created \nError: "+err);
                    else{
                         Notification.success("Song created");
                         refreshSongList();
                         song.title= "";
                         song.author= "";
                         song.lyrics= ""; 
                    }
                });       
            }
            
        $scope.updateSong=   function(song) {
            song.verses= song.lyrics.split(/\n\n+/);
            Song.findOneAndUpdate({title:song.title, author: song.author},song, function (err, doc) {
                if (err)  Notification.error("Song not updated \nError: "+err);
                else{
                        Notification.success("Song updated\n:)");
                        refreshSongList();
                }
            });
        }
        
        $scope.addSong = function (title, author, link) {
            console.log(title+" "+author+" "+link)
            songWebAPI.getLyrics(link, function (lyrics) {
                var songObj = {
                    title: title,
                    author: author,
                    verses: lyrics.split(/\n\n+/),
                    lang: detectLang(lyrics)
                }
                Song.create(songObj, function (err, res) {
                    if (err) log.error("add song error");
                    else {
                        Notification.success("Song added");
                        refreshSongList();
                    }
                });      
            });
        }

        $scope.previewSong = function (link) {
            songWebAPI.getLyrics(link,function (song) {
                $scope.$apply(function () {
                    $scope.previewedSong= song;
                })                
            });
        }
        $scope.deleteSong=   function(song) {
            Song.findOneAndRemove({title:song.title, author: song.author}, function (err, doc) {
                if (err)  Notification.error("Song not deleted \nError: "+err);
                else{
                     Notification.primary("Song deleted");
                     refreshSongList();
                }
            });
        }
        function refreshSongList() {
            $scope.findSong($scope.keyword || "");
        }



        function detectLang(txt) {
            return "EN";
        }


        $scope.displaySongVerse = function (v) {
            FayeFactory.publish("/msg", {
                        displayText: v
                    });
        }
    })
    .controller("PreviewPanelController", function ($scope, $rootScope, FayeFactory) {
        $scope.pannelTitle = "Preview";
    })