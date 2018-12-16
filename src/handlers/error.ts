import * as uuid from 'uuid';
import { waitFor } from 'hatch';
import * as debug from 'debug';
import * as browserify from 'browserify';
import * as path from 'path';
import { requireModule, reportError } from './hatch-comms';
import { ServerResponse } from 'http';

const rePackageRequire = /^module\s\"([^\.\"]*)\".*$/;

export function handleError(baseOpts: {}, err: Error, res: ServerResponse) {
  const requireMatch = rePackageRequire.exec(err.message);
  const requestId = uuid().replace(/\-/g, '');
  const b = browserify(path.resolve(__dirname, 'client', 'bridge.js'));

  // add transforms
  b.transform(require('brfs'));

  // bundle
  b.bundle((bundleError, content) => {
    if (bundleError) {
      console.error('error handler broken :/', bundleError);
      return res.end('alert(\'error handler broken :/\');');
    }

    res.end('const requestId = \'' + requestId +'\';\n' + content);

    // patch the request id into the opts
    const opts = {
      ...baseOpts,
      ...{ requestId: requestId }
    };

    // wait for the hatch ready
    waitFor(requestId, (channel) => {
      debug('event stream ready for request: ' + requestId);

      // if we hit a require match, then get the library
      if (requireMatch) {
        requireModule(channel, opts, requireMatch[1]);
      } else {
        reportError(channel, opts, err);
      }
    });
  });
}
