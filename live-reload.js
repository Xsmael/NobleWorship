  var path = './';
  var fs = require('fs');
  
  var reloadWatcher=fs.watch(path, function() {
    location.reload();
    reloadWatcher.close();
  });