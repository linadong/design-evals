import {randomBytes,createHash} from 'node:crypto';
const code=randomBytes(18).toString('base64url');
console.log('New access code (share privately): '+code);
console.log('Add these variables to your private .env or hosting secrets:');
console.log('DESIGN_EVALS_BETA_CODES='+JSON.stringify([{id:'beta1',hash:createHash('sha256').update(code).digest('hex')}]));
console.log('DESIGN_EVALS_SESSION_SECRET='+randomBytes(32).toString('hex'));
