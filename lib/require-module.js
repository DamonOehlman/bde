var browserify = require('browserify'),
    exec = require('child_process').exec,
    eve = require('eve');

module.exports = function(opts, name) {
    // res.end('alert(\'installing ' + name + '\');');

    eve(opts.requestId + '.npm.install', name);

    console.log('should install module: ' + name);
};