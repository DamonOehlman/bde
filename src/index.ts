import * as browserify from 'browserify';
import { createServer  } from 'http';
import { createRequestHandler } from './handlers';
import { pathToFileURL } from 'url';
import { hatch } from 'hatch';
// import { createServer as createSecureServer } from 'https';


interface BdeOptions {
  basePath: string;
  path: string;
  port: number;
  suffix: string;
}

type BdeReadyCallback = (err: Error | null) => void;

const DEFAULT_OPTIONS: BdeOptions = {
  basePath: process.cwd(),
  path: process.cwd(),
  port: 9966,
  suffix: 'bundle',
};

export const bde = (options: BdeOptions): Promise<void> => {
  const port = withDefaults(options).port;

  // // look for cert, key and ca files
  // ['ca', 'cert', 'key'].forEach(function(certType) {
  //   var certFile = path.resolve(
  //     opts.certPath || process.cwd(),
  //     'server.' + (extensionMapping[certType] || certType)
  //   );

  //   if (fs.existsSync(certFile)) {
  //     serverOpts = serverOpts || {};
  //     serverOpts[certType] = fs.readFileSync(certFile);
  //   }
  // });

  const requestHandler = createRequestHandler(options);

  const server = createServer(requestHandler);
  hatch(server);

  return new Promise((resolve) => server.listen(port, resolve));
};

export function validateOpts(options?: {}): {} {
  return withDefaults(options);
}

function withDefaults(options?: {}) {
  return {
    ...DEFAULT_OPTIONS,
    options,
  };
}
