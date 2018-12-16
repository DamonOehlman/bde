import * as browserify from 'browserify';
import { createServer  } from 'http';
// import { createServer as createSecureServer } from 'https';

interface BdeOptions {
  path: string;
  port: number;
  suffix: string;
}

const DEFAULT_OPTIONS: BdeOptions = {
  path: process.cwd(),
  port: 9966,
  suffix: 'bundle',
};

export const bde = (options?: BdeOptions) => {
  const port = (options || DEFAULT_OPTIONS).port;
};
