var browserify = require('browserify'),
    eve = require('eve'),
    fs = require('fs'),
    http = require('http'),
    mime = require('mime'),
    _ = require('lodash'),
    out = require('out'),
    path = require('path'),
    uuid = require('uuid'),
    reportError = require('./lib/report-error'),
    requireModule = require('./lib/require-module'),
    createEventStream = require('./lib/create-eventstream');

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
    var server = http.createServer(),
        serverPort;

    if (typeof opts == 'function') {
        callback = opts;
        opts = {};
    }

    // ensure we have default opts
    opts = opts || {};

    // ensure we have a callback
    callback = callback || function() {};

    // initialise the server port
    serverPort = parseInt(opts.port, 10) || 8080;

    // handle requests
    server.on('request', createRequestHandler(opts));

    // if the project has a server component then start that first
    startProjectServer(opts, function(err) {
        if (err) return callback(err);

        // listen
        server.listen(serverPort, callback);
    });
};

function createRequestHandler(opts) {
    var basePath = path.resolve(opts.path),
        umdModuleName = path.basename(basePath),
        umdModulePath = path.resolve(basePath, umdModuleName + '.js'),
        transforms = findTransforms(basePath);

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

        // provide an events stream
        if (req.url.indexOf('/events') === 0) {
            return createEventStream(opts, req, res);
        }

        // determine which of the files is required
        targetFile = path.join(basePath, req.url);

        // check if the file is something we should browserify
        match = new RegExp('^.+' + opts.suffix + '$').exec(targetFile);

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
    var foundTransforms = knownTransforms.map(function(moduleName) {
            return path.join(targetPath, 'node_modules', moduleName);
        }).filter(fs.existsSync || path.existsSync);

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
            'Content-Type': mime.lookup(req.url)
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

    b.bundle({}, function(err, content) {
        content = 'window.requestId = \'' + requestId +'\';\n' + content;

        res.end(content);

        // patch the request id into the opts
        opts = _.extend({}, opts, { requestId: requestId });

        // once the request is ready, then invoke the handlers
        eve.once(requestId + '.ready', function() {
            process.nextTick(function() {
                console.log('event stream ready');

                // if we hit a require match, then get the library
                if (requireMatch) {
                    requireModule(opts, requireMatch[1]);
                }
                else {
                    reportError(opts, err);
                }
            });
        });
    });
}

function startProjectServer(opts, callback) {
    var serverLoader = path.resolve(opts.path, 'server.js');

    (fs.exists || path.exists)(serverLoader, function(exists) {
        // if we don't have a server, callback immediately
        if (! exists) return callback();

        // otherwise, attempt to start the server in a separate node process
        // TODO:

        callback();
    });
}
