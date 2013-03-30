var brfs = require('brfs'),
    browserify = require('browserify'),
    fs = require('fs'),
    http = require('http'),
    mime = require('mime'),
    out = require('out'),
    path = require('path'),
    reBrowserfiable = /^.*\/(.*?)\-?bundle\.js$/;

module.exports = function(opts, callback) {
    var server = http.createServer(),
        basePath,
        serverPort;

    if (typeof opts == 'function') {
        callback = opts;
        opts = {};
    }

    // ensure we have default opts
    opts = opts || {};

    // initialise the base path
    basePath = path.resolve(opts.path);

    // initialise the server port
    serverPort = parseInt(opts.port, 10) || 8080;

    // handle requests
    server.on('request', function(req, res) {
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
            out('!{blue}200: {0} ==> {1}', browserifyTarget.slice(basePath.length), req.url);

            // TODO: add transforms

            res.writeHead(200, {
                'Content-Type': 'application/javascript'
            });

            b.bundle().pipe(res);
        }
        // otherwlse, simply read the file and return
        else {
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
    });

    server.listen(serverPort, function(err) {
        out('!{grey}started on port: {0}', serverPort);

        if (typeof callback == 'function') {
            callback.apply(this, arguments);
        }
    });
};