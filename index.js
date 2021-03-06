const browserify = require('browserify');
const debug = require('debug')('bde');
const { hatch } = require('hatch');
const fs = require('fs');
const mime = require('mime');
const out = require('out');
const path = require('path');
const uuid = require('uuid');
const reportError = require('./lib/report-error');
const requireModule = require('./lib/require-module');
const url = require('url');
const extend = require('cog/extend');
const defaults = require('cog/defaults');

const extensionMapping = {
  cert: 'crt'
};

const packageJson = require('./package.json');
const rePackageRequire = /^module\s\"([^\.\"]*)\".*$/;

/**
  # bde

  Browserify Development Environment.

  If you are developing on your local machine using
  [browserify](https://github.com/substack/node-substack), then bde is your
  friend (though you should also definitely check out
  [budo](https://github.com/mattdesl/budo)).

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

  ## Using Browserify Transform

  The best way to configure custom browserify behaviour is to use the
  [browserify package.json configuration options](https://github.com/substack/node-browserify#packagejson).
  Previous versions of `bde` tried to use overcomplicated logic to identify transforms
  that were available, until I accidentally worked out it wasn't required :smile:
**/

const bde = module.exports = function(opts, callback) {
  var server;
  var serverPort;
  var serverOpts;

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  // ensure we have default opts
  opts = defaults(opts || {}, {
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

    if (fs.existsSync(certFile)) {
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
  const basePath = path.resolve(opts.path);
  const umdModuleName = path.basename(basePath);
  const umdModulePath = path.resolve(basePath, umdModuleName + '.js');
  const reBrowserfiable = new RegExp('^.*\/(.*?)\-?' + opts.suffix + '\.js$', 'i');

  return function(req, res) {
    const browserifyOpts = {
      debug: true,
      detectGlobals: true
    };

    let targetFile;
    let browserifyTarget;
    let match;
    let b;
    let urlParts;

    // if this is a request for / add index.html
    if (req.url[req.url.length - 1] === '/') {
      req.url += 'index.html';
    }

    // parse the url
    urlParts = url.parse(req.url);

    // if this is a hatch request, abort
    if (req.url.indexOf('/__hatch') === 0) return;

    // determine which of the files is required
    targetFile = path.join(basePath, urlParts.pathname);

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
      b = browserify(extend({ entries: [ browserifyTarget ] }, browserifyOpts));
      out('!{blue}200: {0} [browserify] => {1} !{grey}{2}', browserifyTarget.slice(basePath.length), req.url, JSON.stringify(browserifyOpts));
      res.writeHead(200, {
        'Content-Type': 'application/javascript'
      });

      b.bundle(function(err, content) {
        if (err) return handleError(opts, err, res);

        res.end(content);
      });
    }
    // otherwlse, simply read the file and return
    else {
      readTargetFile(targetFile, opts, req, res);
    }
  };
}

function generatePage(targetFile, opts, req, res) {
  const targetFilename = path.basename(targetFile, '.html');
  const targetJsFile = targetFilename === 'index' ? findFirstJsFile(opts) : targetFilename;

  res.writeHead(200, {
    'Content-type': mime.getType(targetFile) + '; encoding: utf-8'
  });

  res.end(`
    <html>
    <body>
    <script src="${targetJsFile}-bundle.js"></script>
    </body>
    </html>
  `);
}

function findFirstJsFile(opts) {
  const allJsFiles = fs.readdirSync(path.resolve(opts.path))
    .filter(filename => path.extname(filename) === '.js')
    .map(filename => path.basename(filename, '.js'));

  debug('found js files: ', allJsFiles);
  return allJsFiles[0];
}

function readTargetFile(targetFile, opts, req, res) {
  fs.readFile(targetFile, function(err, data) {
    if (err) {
      if (path.extname(targetFile) === '.html') {
        return generatePage(targetFile, opts, req, res);
      }

      out('!{red}404: {0}', req.url);
      res.writeHead(404);
      res.end('Not found');

      return;
    }

    out('!{green}200: {0}', req.url);
    res.writeHead(200, {
      'Content-Type': mime.getType(targetFile) + '; encoding: utf-8'
    });

    res.end(data);
  });
}

/**
## handleError(err, res)

Used to report a browserification error over the wire
*/
function handleError(opts, err, res) {
  const requireMatch = rePackageRequire.exec(err.message);
  const requestId = uuid().replace(/\-/g, '');
  let b;

  // console.log(require('util').inspect(err));

  // browserify the event bridge
  b = browserify(path.resolve(__dirname, 'client', 'bridge.js'));

  // add transforms
  b.transform(require('brfs'));

  // bundle
  b.bundle(function(bundleError, content) {
    if (bundleError) {
      console.log('error handler broken :/', bundleError);
      return res.end('alert(\'error handler broken :/\');');
    }

    res.end('var requestId = \'' + requestId +'\';\n' + content);

    // patch the request id into the opts
    opts = extend({}, opts, { requestId: requestId });

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
