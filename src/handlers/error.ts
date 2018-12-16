import * as browserify from 'browserify';
import * as debug from 'debug';
import { waitFor } from 'hatch';
import { ServerResponse } from 'http';
import * as path from 'path';
import * as uuid from 'uuid';
import { reportError, requireModule } from './hatch-comms';

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
      // tslint:disable-next-line:no-console
      console.error('error handler broken :/', bundleError);
      return res.end('alert(\'error handler broken :/\');');
    }

    res.end('const requestId = \'' + requestId +'\';\n' + content);

    // patch the request id into the opts
    const opts = {
      ...baseOpts,
      ...{ requestId },
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
