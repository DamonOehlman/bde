// create an event source back to the bde server
var crel = require('crel');
var fs = require('fs');
var hatch = require('hatch/client');
var insertCss = require('insert-css');

// insert some base css
insertCss(fs.readFileSync(__dirname + '/bridge.css'));

function reportError(err) {
  var errDiv = crel('div', { class: 'error' },
    crel('h3', 'Error browserifying'),
    crel('pre', err.message)
  );

  document.body.appendChild(errDiv);
}

hatch(requestId)
  .on('install', function(name) {
    console.log('need to install: ' + name);
  })
  .on('error', reportError);