var brfs = require('brfs'),
    browserify = require('browserify'),
    fs = require('fs'),
    http = require('http'),
    mime = require('mime'),
    out = require('out'),
    path = require('path'),
    reBrowserfiable = /^.*\/(.*?)\-?bundle\.js$/,
    knownTransforms = [
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

    // initialise the server port
    serverPort = parseInt(opts.port, 10) || 8080;

    // handle requests
    server.on('request', createRequestHandler(opts));

    // listen
    server.listen(serverPort, function(err) {
        out('!{grey}started on port: {0}', serverPort);

        if (typeof callback == 'function') {
            callback.apply(this, arguments);
        }
    });
};

function createRequestHandler(opts) {
    var basePath = path.resolve(opts.path),
        transforms = findTransforms(basePath);

    return function(req, res) {
        var targetFile,
            browserifyTarget,
            match,
            b;

        // if this is a request for / add index.html
        if (req.url[req.url.length - 1] === '/') {
            req.url += 'index.html';
        }

        // determine which of the files is required
        targetFile = path.join(basePath, req.url);

        // check if the file is something we should browserify
        match = reBrowserfiable.exec(targetFile);

        // if browserfiable, then browserify
        if (match) {
            browserifyTarget = path.join(path.dirname(targetFile), (match[1] || 'index') + '.js');

            // browserify
            b = browserify(browserifyTarget);

            // add transforms
            transforms.forEach(b.transform.bind(b));

            out('!{blue}200: {0} [browserify] => {1}', browserifyTarget.slice(basePath.length), req.url);
            res.writeHead(200, {
                'Content-Type': 'application/javascript'
            });

            b.bundle().pipe(res);
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
