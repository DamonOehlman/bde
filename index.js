/* jshint node: true */
'use strict';

var browserify = require('browserify');
var debug = require('debug')('bde');
var hatch = require('hatch');
var fs = require('fs');
var mime = require('mime');
var _ = require('lodash');
var out = require('out');
var path = require('path');
var uuid = require('uuid');
var reportError = require('./lib/report-error');
var requireModule = require('./lib/require-module');
var _existsSync = fs.existsSync || path.existsSync;

var extensionMapping = {
  cert: 'crt'
};

var packageJson = require('./package.json');
var rePackageRequire = /^module\s\"([^\.\"]*)\".*$/;

// see: https://github.com/substack/node-browserify#list-of-source-transforms
var knownTransforms = [
  'coffeeify',
  'caching-coffeeify',
  'hbsfy',
  'rfileify',
  'liveify',
  'es6ify',
  'stylify',
  'turn',
  'brfs'
];


/**
  # bde

  Browserify Development Environment.

  If you are developing on your local machine using
  [browserify](https://github.com/substack/node-substack), then bde is your
  friend (though you should also definitely check out
  [beefy](https://github.com/chrisdickinson/beefy)). 

  ## Running

  In a directory that you are building a browserify module in, simply run
  `bde`.  This will start bde on port `8080` and watch for any files ending
  in `bundle.js`.

  If you want to start it on a particular port, then specify the port as the
  first command-line argument (e.g. `bde 8090`) or using the -p flag
  (e.g. `bde -p 8090`).

  If you would like to watch for a different suffix, use the -s flag
  (e.g. `bde -s foo.js`).

  ## Conventions

  bde will serve pretty much any file, courtesy of
  [ecstatic](https://github.com/jesusabdullah/node-ecstatic). When particular
  files are requested, however, they will be routed through browserify:

  - *-bundle.js (look for the filename prefixed by `-bundle.js` and run
    through browserify)

  ## Using HTTPS

  If you wish to run a bde server using HTTPS then you simply need to push
  relevant `server.crt`, `server.key` and `server.ca` (if required) files into
  the working directory from which you start your application.  If detected
  bde will start the server on using HTTPS instead of HTTP.
**/

var bde = module.exports = function(opts, callback) {
  var server;
  var serverPort;
  var serverOpts;

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  // ensure we have default opts
  opts = _.defaults(opts || {}, {
    path: process.cwd(),
    port: 8080,
    suffix: 'bundle'
  });

  // look for cert, key and ca files
  ['ca', 'cert', 'key'].forEach(function(certType) {
    var certFile = path.resolve(
      opts.certPath || process.cwd(),
      'server.' + (extensionMapping[certType] || certType)
    );

    if (_existsSync(certFile)) {
      serverOpts = serverOpts || {};
      serverOpts[certType] = fs.readFileSync(certFile);
    }
  });

  // create the server
  server = require(serverOpts ? 'https' : 'http').createServer(serverOpts);

  // hatchify the server
  hatch(server);

  // ensure we have a callback
  callback = callback || function() {};

  // initialise the server port
  serverPort = parseInt(opts.port, 10) || 8080;

  // handle requests
  server.on('request', createRequestHandler(opts));

  // listen
  server.listen(serverPort, callback);
};

// patch in the version of bde
bde.version = packageJson.version;

function createRequestHandler(opts) {
  var basePath = path.resolve(opts.path);
  var umdModuleName = path.basename(basePath);
  var umdModulePath = path.resolve(basePath, umdModuleName + '.js');
  var transforms = findTransforms(basePath);
  var reBrowserfiable = new RegExp('^.*\/(.*?)\-?' + opts.suffix + '\.js$', 'i');

  return function(req, res) {
    var targetFile;
    var browserifyTarget;
    var browserifyOpts = {
      debug: true,
      detectGlobals: true
    };
    var match;
    var b;

    // if this is a request for / add index.html
    if (req.url[req.url.length - 1] === '/') {
      req.url += 'index.html';
    }

    // if this is a hatch request, abort
    if (req.url.indexOf('/__hatch') === 0) return;

    // determine which of the files is required
    targetFile = path.join(basePath, req.url);

    // check if the file is something we should browserify
    match = reBrowserfiable.exec(targetFile);

    // check if this is a umd module request
    if (match || targetFile === umdModulePath) {
      // initialise the browserify target to the correct path
      browserifyTarget = targetFile === umdModulePath ?
        path.join(basePath, 'index.js') : 
        path.join(path.dirname(targetFile), (match[1] || 'index') + '.js');

      // if we have matched a standalone request, then add the standalone flag to the opts
      if (targetFile === umdModulePath) {
        browserifyOpts.standalone = umdModuleName;

        // debug option breaks standalone
        browserifyOpts.debug = false;
      }

      // browserify
      b = browserify(browserifyTarget);

      // add transforms
      transforms.forEach(b.transform.bind(b));

      out('!{blue}200: {0} [browserify] => {1} !{grey}{2}', browserifyTarget.slice(basePath.length), req.url, JSON.stringify(browserifyOpts));
      res.writeHead(200, {
        'Content-Type': 'application/javascript'
      });

      b.bundle(browserifyOpts, function(err, content) {
        if (err) return handleError(opts, err, res);

        res.end(content);
      });
    }
    // otherwlse, simply read the file and return
    else {
      readTargetFile(targetFile, req, res);
    }
  };
}

function findTransforms(targetPath) {
  var foundTransforms;
  var lastTargetPath;

  debug('looking for transforms on path: ' + targetPath);

  // head up the tree until we find a node_modules directory
  while (! _existsSync(path.join(targetPath, 'node_modules'))) {
    targetPath = path.dirname(targetPath);

    if (targetPath === lastTargetPath) break;
    lastTargetPath = targetPath;
  }

  // find the transforms
  debug('looking for transforms in: ' + targetPath);
  foundTransforms = knownTransforms.map(function(moduleName) {
    return path.join(targetPath, 'node_modules', moduleName);
  }).filter(fs.existsSync || path.existsSync);

  debug('found ' + foundTransforms.length + ' valid transforms');
  return foundTransforms.map(require);
}

function readTargetFile(targetFile, req, res) {
  fs.readFile(targetFile, function(err, data) {
    if (err) {
      out('!{red}404: {0}', req.url);
      res.writeHead(404);
      res.end('Not found');

      return;
    }

    out('!{green}200: {0}', req.url);
    res.writeHead(200, {
      'Content-Type': mime.lookup(req.url) + '; encoding: utf-8'
    });

    res.end(data);
  });
}

/**
## handleError(err, res)

Used to report a browserification error over the wire
*/
function handleError(opts, err, res) {
  var requireMatch = rePackageRequire.exec(err.message);
  var requestId = uuid().replace(/\-/g, '');
  var b;

  // browserify the event bridge
  b = browserify(path.resolve(__dirname, 'client', 'bridge.js'));

  // add transforms
  // findTransforms(path.resolve(opts.path)).forEach(b.transform.bind(b));
  b.transform(require('stylify'));

  // bundle
  b.bundle({}, function(bundleError, content) {
    if (bundleError) {
      console.log('error handler broken :/', bundleError);
      return res.end('alert(\'error handler broken :/\');');
    }

    res.end('var requestId = \'' + requestId +'\';\n' + content);

    // patch the request id into the opts
    opts = _.extend({}, opts, { requestId: requestId });

    // wait for the hatch ready
    hatch.waitFor(requestId, function() {
      debug('event stream ready for request: ' + requestId);

      // if we hit a require match, then get the library
      if (requireMatch) {
        requireModule(this, opts, requireMatch[1]);
      }
      else {
        reportError(this, opts, err);
      }
    });
  });
}
