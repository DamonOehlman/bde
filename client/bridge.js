// create an event source back to the bde server
var source = new EventSource('/events/' + window.requestId);

source.addEventListener('browserify:error', function() {
    console.log('received error');
});

source.addEventListener('message', function(evt) {
    var data;

    try {
        data = JSON.parse(evt.data);
    }
    catch (e) {
    }

    console.log(data);
});