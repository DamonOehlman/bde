var eve = require('eve');

eve.on('*', function() {
    console.log(eve.nt(), arguments);
});

module.exports = function(opts, req, res) {
    var requestId = req.url.split('/')[2];

    function streamEvent() {
        var evtName = eve.nt(),
            data = {
                name: evtName.split('.').slice(1).join('.'),
                args: [].slice.call(arguments)
            };

        console.log('received event: ' + evtName, arguments);
        res.write('data: ' + JSON.stringify(data) + '\n\n');
        // res.writeContinue();
    }

    // flag the request as 
    console.log('event stream connected for id: ' + requestId);
    eve(requestId + '.ready');

    // listen for events matching the request id
    eve.on(requestId, streamEvent);

    res.on('close', function() {
        console.log('unbinding event listener');
        eve.unbind(requestId, streamEvent);
    });

    res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive'
    });

    res.writeContinue();
};