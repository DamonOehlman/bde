# bde

Browserify Development Environment.

If you are developing on your local machine using
[browserify](https://github.com/substack/node-substack), then bde is your
friend (though you should also definitely check out
[beefy](https://github.com/chrisdickinson/beefy)). 


[![NPM](https://nodei.co/npm/bde.png)](https://nodei.co/npm/bde/)


## Running

In a directory that you are building a browserify module in, simply run
`bde`.  This will start bde on port `8080` and watch for any files ending
in `bundle.js`.

If you want to start it on a particular port, then specify the port as the
first command-line argument (e.g. `bde 8090`) or using the -p flag
(e.g. `bde -p 8090`).

If you would like to watch for a different suffix, use the -s flag
(e.g. `bde -s foo.js`).

## Conventions

bde will serve pretty much any file, courtesy of
[ecstatic](https://github.com/jesusabdullah/node-ecstatic). When particular
files are requested, however, they will be routed through browserify:

- *-bundle.js (look for the filename prefixed by `-bundle.js` and run
  through browserify)

## Using HTTPS

If you wish to run a bde server using HTTPS then you simply need to push
relevant `server.crt`, `server.key` and `server.ca` (if required) files into
the working directory from which you start your application.  If detected
bde will start the server on using HTTPS instead of HTTP.

## License(s)

### MIT

Copyright (c) 2013 Damon Oehlman <damon.oehlman@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
