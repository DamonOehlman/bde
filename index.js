var browserify = require('browserify'),
    debug = require('debug')('bde'),
    hatch = require('hatch'),
    fs = require('fs'),
    fork = require('child_process').fork,
    mime = require('mime'),
    _ = require('lodash'),
    out = require('out'),
    path = require('path'),
    uuid = require('uuid'),
    reportError = require('./lib/report-error'),
    requireModule = require('./lib/require-module'),
    _existsSync = fs.existsSync || path.existsSync,

    extensionMapping = {
        cert: 'crt'
    },

    rePackageRequire = /^module\s\"([^\.\"]*)\".*$/,

    // see: https://github.com/substack/node-browserify#list-of-source-transforms
    knownTransforms = [
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

module.exports = function(opts, callback) {
    var server,
        serverPort,
        serverOpts = {},
        useHttps = false;

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
        var certFile = path.resolve(opts.certPath, 'server.' + (extensionMapping[certType] || certType));

        console.log(certFile);
        if (_existsSync(certFile)) {
            useHttps = true;
            serverOpts[certType] = fs.readFileSync(certFile);
        }
    });

    console.log(serverOpts);

    // create the server
    server = require(useHttps ? 'https' : 'http').createServer(serverOpts);

    // hatchify the server
    hatch(server);

    // ensure we have a callback
    callback = callback || function() {};

    // initialise the server port
    serverPort = parseInt(opts.port, 10) || 8080;

    // handle requests
    server.on('request', createRequestHandler(opts));

    // if the project has a server component then start that first
    startProjectServer(opts, function(err, backend) {
        if (err) return callback(err);

        // listen
        server.listen(serverPort, function(err) {
            callback(err, backend);
        });
    });
};

function createRequestHandler(opts) {
    var basePath = path.resolve(opts.path),
        umdModuleName = path.basename(basePath),
        umdModulePath = path.resolve(basePath, umdModuleName + '.js'),
        transforms = findTransforms(basePath),
        reBrowserfiable = new RegExp('^.*\/(.*?)\-?' + opts.suffix + '\.js$', 'i');

    return function(req, res) {
        var targetFile,
            browserifyTarget,
            browserifyOpts = {
                debug: true,
                detectGlobals: true
            },
            match,
            b;

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
    var foundTransforms,
        lastTargetPath;

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
    var requireMatch = rePackageRequire.exec(err.message),
        requestId = uuid().replace(/\-/g, ''),
        b;

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
            console.log('event stream ready');

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

function startProjectServer(opts, callback) {
    var serverLoader = path.resolve(opts.path, 'server.js');

    debug('checking for server loader: ' + serverLoader);
    (fs.exists || path.exists)(serverLoader, function(exists) {
        // if we don't have a server, callback immediately
        if (! exists) return callback();

        debug('server loader found, starting server');
        callback(null, fork(serverLoader));
    });
}
