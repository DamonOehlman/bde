# bde

Browserify Development Environment.  Developing locally using [browserify](https://github.com/substack/node-substack), then bde is your friend.  It's inspired by [browservefy](https://github.com/chrisdickinson/browservefy) but has an [easier to remember name](https://github.com/chrisdickinson/browservefy/issues/14) and is generally a little nicer to use (I think).

## Installation

```
npm install bde -g
```

## Running

In a directory that you are building a browserify module in, simply run `bde`.  This will start bde on port `8080` and watch for any files ending in bundle.js.

If you want to start it on a particular port, then specify the port as the first command-line argument (e.g. `bde 8090`) or using the -p flag (e.g. `bde -p 8090`).

If you would like to watch for a different suffix, use the -s flag (e.g. `bde -s foo.js`).

## Conventions

bde will serve pretty much any file, courtesy of [ecstatic](https://github.com/jesusabdullah/node-ecstatic). When particular files are requested, however, they will be routed through browserify:

- *-bundle.js (look for the filename prefixed by `-bundle.js` and run through browserify)

## Using HTTPS

If you wish to run a bde server using HTTPS then you simply need to push relevant `server.crt`, `server.key` and `server.ca` (if required) files into the working directory from which you start your application.  If detected bde will start the server on using HTTPS instead of HTTP.