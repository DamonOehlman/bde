var browserify = require('browserify'),
    exec = require('child_process').exec;

module.exports = function(hatch, opts, name) {
    // res.end('alert(\'installing ' + name + '\');');

    hatch.emit('install', name);
    console.log('should install module: ' + name);
};