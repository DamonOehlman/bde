// create an event source back to the bde server
const crel = require('crel');
const fs = require('fs');
const hatch = require('hatch/client');
const insertCss = require('insert-css');

// insert some base css
insertCss(fs.readFileSync(__dirname + '/bridge.css', 'utf-8'));

function reportError(err) {
  const errDiv = crel(
    'div',
    { class: 'error' },
    crel('h3', 'Error browserifying'),
    crel('pre', [err.message, err.stack]),
  );

  document.body.insertBefore(errDiv, document.body.childNodes[0]);
}

hatch(requestId)
  .on('install', function(name) {
    console.log('need to install: ' + name);
  })
  .on('error', reportError);
