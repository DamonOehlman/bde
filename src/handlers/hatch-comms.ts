import * as hatch from 'hatch';

export const requireModule = (hatch, opts, name) => {
  hatch.emit('install', name);
  console.log('should install module: ' + name);
};


export const reportError = (hatch, opts, err: Error) => {
  hatch.emit('error', {
    message: err.toString(),
    stack: err.stack
  });
};
