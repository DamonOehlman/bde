// create an event source back to the bde server
var hatch = require('hatch/client'),
    insertCss = require('insert-css');

// insert some base css
insertCss(require('./bridge.styl'));

hatch(requestId)
    .on('install', function(name) {
        console.log('need to install: ' + name);
    })
    .on('error', function(err) {
        console.log('caught error while browserifying: ', err);
    });