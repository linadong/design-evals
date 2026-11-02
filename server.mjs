import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import handler from './server/handler.mjs';
const root=path.resolve(import.meta.dirname,'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(!['localhost','127.0.0.1','[::1]'].includes(new URL('http://'+req.headers.host).hostname)){res.writeHead(403);res.end();return;}
  if(url.pathname.startsWith('/api/design-evals/')){await handler(req,res);return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  if(relative.split('/').some(p=>p.startsWith('.')))throw Error('Invalid path');
  const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||4317),'127.0.0.1',()=>console.log('Design Evals: http://localhost:'+ (process.env.PORT||4317)));
