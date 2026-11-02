import {access} from 'node:fs/promises';
for(const p of ['public/index.html','public/app.js','public/access-client.js','api/design-evals.mjs','server/handler.mjs'])await access(p);
await import('../server/handler.mjs');
console.log('Static frontend and server entry verified.');
