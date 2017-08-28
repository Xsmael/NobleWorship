var http = require('http'),
    faye = require('faye'),
    log= require('noogger');

var PORT=  7003;

var server = http.createServer(),
    bayeux = new faye.NodeAdapter({mount: '/'});

bayeux.on('subscribe', function(clientId, channel) {
    log.notice(clientId+" subscribed on channel "+channel);
});

bayeux.on('unsubscribe', function(clientId, channel) {
    log.warning(clientId+" unsubscribed on channel "+channel);
});

bayeux.on('publish', function(clientId, channel,data) {
    log.info(clientId+" publish on channel "+channel+" data: "+JSON.stringify(data));
});

bayeux.attach(server);
server.listen(PORT);

log.info("Server running on Port "+PORT);



