import { EventChannel } from 'hatch/channel';

export const requireModule = (hatch: EventChannel, opts: {}, name: string) => {
  hatch.emit('install', name);
  console.log(`should install module: ${name}`);
};

export const reportError = (hatch: EventChannel, opts: {}, err: Error) => {
  hatch.emit('error', {
    message: err.toString(),
    stack: err.stack
  });
};
