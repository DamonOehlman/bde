import { ServerResponse, IncomingMessage } from "http";
import { readFile, readdir } from 'fs';
import { getType } from 'mime';
import * as path from 'path';
import * as out from 'out';

import * as debugModule from 'debug';
const debug = debugModule('bde');

interface StaticFileOpts {
  path: string;
}

export function readTargetFile(targetFile: string, opts: StaticFileOpts, req: IncomingMessage, res: ServerResponse) {
  debug(`attempting to read file: ${targetFile}`);

  readFile(targetFile, function(err, data) {
    if (err) {
      if (path.extname(targetFile) === '.html') {
        try {
          return generatePage(targetFile, opts, req, res);
        } catch (e) {
          out('!{red}500: {0}', e);
          res.writeHead(500);
          res.end('Error');

          return;
        }
      }

      out('!{red}404: {0}', req.url);
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    out('!{green}200: {0}', req.url);
    res.writeHead(200, {
      'Content-Type': getType(targetFile) + '; encoding: utf-8'
    });

    res.end(data);
  });
}

export async function generatePage(targetFile: string, opts: StaticFileOpts, req: IncomingMessage, res: ServerResponse) {
  debug(`attemptig to generate placeholder html file: ${targetFile}`);
  const targetFilename = path.basename(targetFile, '.html');
  const targetJsFile = targetFilename === 'index' ? (await findFirstJsFile(opts)) : targetFilename;

  if (!targetJsFile) {
    debug(`unable to find js file to build page for ${targetFile}`);
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-type': getType(targetFile) + '; encoding: utf-8'
  });

  res.end(`
    <html>
    <body>
    <script src="${targetJsFile}-bundle.js"></script>
    </body>
    </html>
  `);
}

function findFirstJsFile(opts: StaticFileOpts): Promise<string | null> {
  return new Promise((resolve, reject) => {
    debug(`looking for js files in:  ${opts.path}`);
    readdir(path.resolve(opts.path), (err, files) => {
      if (err) {
        return reject(err);
      }

      const allJsFiles = files
        .filter(filename => path.extname(filename) === '.js')
        .map(filename => path.basename(filename, '.js'));

      resolve(allJsFiles[0] || null);
    });
  });
}
