// create an event source back to the bde server
var fs = require('fs');
var hatch = require('hatch/client');
var insertCss = require('insert-css');

// insert some base css
insertCss(fs.readFileSync(__dirname + '/bridge.css'));

hatch(requestId)
  .on('install', function(name) {
      console.log('need to install: ' + name);
  })
  .on('error', function(err) {
      console.log('caught error while browserifying: ', err);
  });