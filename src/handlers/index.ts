import * as browserify from 'browserify';
import * as path from 'path';
import * as url from 'url';
import * as preconditions from 'preconditions-ts';
import { stringify } from 'querystring';
import * as out from 'out';
import { ServerResponse, IncomingMessage } from 'http';
import { handleError } from './error';
import { readTargetFile } from './static';

import * as debugModule from 'debug';
const debug = debugModule('bde');

interface RequestHandlerOpts {
  basePath: string;
  path: string;
  suffix: string;
};

interface ValidatedUrlParts {
  pathname: string;
}

export const createRequestHandler = (opts: RequestHandlerOpts) => {
  const browserifyOpts: browserify.Options = {
    debug: true,
    detectGlobals: true,
  };

  const umdModuleName = path.basename(opts.basePath);
  const umdModulePath = path.resolve(opts.basePath, umdModuleName + '.js');
  const reBrowserfiable = new RegExp('^.*\/(.*?)\-?' + opts.suffix + '\.js$', 'i');

  debug(`created response handler, opts = `, opts);

  return (req: IncomingMessage, res: ServerResponse) => {
    debug(`received request for url: ${req.url}`);
    // if this is a hatch request, abort
    if (!req.url || req.url.indexOf('/__hatch') === 0) {
      return;
    }

    const urlParts = parseUrl(req.url);
    const targetFile = path.join(opts.basePath, urlParts.pathname);
    const browserifyMatch = reBrowserfiable.exec(targetFile);

    // check if this is a umd module request
    if (browserifyMatch || targetFile === umdModulePath) {
      // initialise the browserify target to the correct path
      const browserifyTarget = browserifyMatch
        ? path.join(path.dirname(targetFile), (browserifyMatch[1] || 'index') + '.js')
        : path.join(opts.basePath, 'index.js');

      // if we have matched a standalone request, then add the standalone flag to the opts
      if (targetFile === umdModulePath) {
        browserifyOpts.standalone = umdModuleName;

        // debug option breaks standalone
        // TODO: check this
        browserifyOpts.debug = false;
      }

      // browserify
      const bundle = browserify({
        ...{ entries: [browserifyTarget] },
        ...browserifyOpts
      });

      out('!{blue}200: {0} [browserify] => {1} !{grey}{2}', browserifyTarget.slice(opts.basePath.length), req.url, JSON.stringify(browserifyOpts));
      res.writeHead(200, {
        'Content-Type': 'application/javascript'
      });

      bundle.bundle((err, content) => err ? handleError(opts, err, res) : res.end(content));
    } else {
      readTargetFile(targetFile, opts, req, res);
    }
  };
};

function parseUrl(urlString: string): ValidatedUrlParts {
  const parts = urlString[urlString.length - 1] === '/'
    ? url.parse(`${urlString}index.html`)
    : url.parse(urlString);

  return {
    pathname: preconditions.requiredString(parts, 'pathname')
  };
}
