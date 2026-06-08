import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('dist/index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Remove module and crossorigin from any script tags.
  html = html.replace(/<script type="module" crossorigin(.*?)>/g, '<script defer$1>');
  html = html.replace(/<script type="module"(.*?)>/g, '<script defer$1>');
  
  // Alternatively, just replace any type="module" ... with defer
  // and remove crossorigin
  html = html.replace(/ crossorigin/g, '');

  fs.writeFileSync(htmlPath, html);
  console.log('Fixed dist/index.html successfully for single-file deployment.');
}
