import { ServerResponse } from "http";
import { readFile, readdir } from 'fs';
import { getType } from 'mime';
import * as path from 'path';
import * as out from 'out';

interface StaticFileOpts {
  path: string;
}

export function readTargetFile(targetFile: string, opts: StaticFileOpts, req: Request, res: ServerResponse) {
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

export async function generatePage(targetFile: string, opts: StaticFileOpts, req: Request, res: ServerResponse) {
  const targetFilename = path.basename(targetFile, '.html');
  const targetJsFile = targetFilename === 'index' ? (await findFirstJsFile(opts)) : targetFilename;

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

function findFirstJsFile(opts: StaticFileOpts): Promise<string> {
  return new Promise((resolve, reject) => {
    readdir(path.resolve(opts.path), (err, files) => {
      if (err) {
        return reject(err);
      }

      const allJsFiles = files
        .filter(filename => path.extname(filename) === '.js')
        .map(filename => path.basename(filename, '.js'));

      if (allJsFiles.length === 0) {
        return reject(new Error('no valid js files found'));
      }

      return allJsFiles[0];
    });
  });
}
