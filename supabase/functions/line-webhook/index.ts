// Wichakan LINE OA webhook: signature-verified transport only.
// Parent-to-student linking and result notifications are intentionally disabled.
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
function equalConstantTime(a:Uint8Array,b:Uint8Array){let difference=a.length^b.length;const n=Math.max(a.length,b.length);for(let i=0;i<n;i++)difference|=(a[i]??0)^(b[i]??0);return difference===0;}
function decodeBase64(input:string){try{return Uint8Array.from(atob(input),c=>c.charCodeAt(0));}catch{return new Uint8Array(0);}}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
 const secret=Deno.env.get('LINE_CHANNEL_SECRET');
 if(!secret)return reply(503,{error:'not_configured'});
 const signature=req.headers.get('x-line-signature')??'';
 if(!signature)return reply(401,{error:'invalid_signature'});
 const size=Number(req.headers.get('content-length')??'0');
 if(size>65536)return reply(413,{error:'payload_too_large'});
 let raw:string;
 try{raw=await req.text();if(new TextEncoder().encode(raw).byteLength>65536)return reply(413,{error:'payload_too_large'});}catch{return reply(400,{error:'invalid_body'});}
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));
 if(!equalConstantTime(expected,decodeBase64(signature)))return reply(401,{error:'invalid_signature'});
 let event:unknown;
 try{event=JSON.parse(raw);}catch{return reply(400,{error:'invalid_json'});}
 if(!event||typeof event!=='object'||Array.isArray(event)||!Array.isArray((event as {events?:unknown}).events))return reply(400,{error:'invalid_payload'});
 // Acknowledge verified LINE events without storing or logging identifiers or message text.
 // Do not send grades or register guardians until identity verification is implemented.
 return reply(200,{ok:true});
});
