import {put} from '@vercel/blob';
export async function saveWaitlist(record,env,request){
 if(!env.BLOB_STORE_ID&&!env.BLOB_READ_WRITE_TOKEN)throw Error('Waitlist storage not configured');
 const options={access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',...(env.BLOB_STORE_ID?{storeId:env.BLOB_STORE_ID}:{}),...(env.BLOB_READ_WRITE_TOKEN?{token:env.BLOB_READ_WRITE_TOKEN}:{}),...(request.headers.get('x-vercel-oidc-token')?{oidcToken:request.headers.get('x-vercel-oidc-token')}:{})};
 await put('design-evals-waitlist/'+record.id+'.json',JSON.stringify({email:record.email,submittedAt:record.submittedAt,source:'design-evals-beta',purpose:'test-access-request'}),options);
}
