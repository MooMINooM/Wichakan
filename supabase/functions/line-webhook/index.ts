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
 // Only messages explicitly containing a school-issued, one-time invitation are considered.
 // LINE's signed payload supplies the sender ID; the message alone never grants access.
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!service)return reply(503,{error:'database_not_configured'});
 const events=(event as {events:unknown[]}).events;
 for(const item of events.slice(0,25)){
  if(!item||typeof item!=='object')continue;
  const e=item as {type?:string;source?:{type?:string;userId?:string};message?:{type?:string;text?:string}};
  if(e.type!=='message'||e.source?.type!=='user'||e.message?.type!=='text')continue;
  const code=/^LINK\\s+([A-F0-9]{32})$/i.exec((e.message.text??'').trim())?.[1]?.toUpperCase();
  const userId=e.source.userId;
  if(!code||!userId||userId.length>255||userId.length<10)continue;
  const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const q=await fetch(url+'/rest/v1/line_guardian_invites?select=id,school_id,guardian_id,expires_at,used_at&invite_code=eq.'+encodeURIComponent(code)+'&limit=1',{headers});
  if(!q.ok)return reply(503,{error:'database_unavailable'});
  const matches=await q.json() as Array<{id:string;school_id:string;guardian_id:string;expires_at:string;used_at:string|null}>;
  const invite=matches[0];
  if(!invite||invite.used_at||new Date(invite.expires_at).getTime()<=Date.now())continue;
  const request=await fetch(url+'/rest/v1/line_guardian_requests',{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({school_id:invite.school_id,guardian_id:invite.guardian_id,line_user_id:userId})});
  if(!request.ok&&request.status!==409)return reply(503,{error:'request_unavailable'});
  if(request.ok){
   const used=await fetch(url+'/rest/v1/line_guardian_invites?id=eq.'+encodeURIComponent(invite.id)+'&used_at=is.null',{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({used_at:new Date().toISOString()})});
   if(!used.ok)return reply(503,{error:'invite_update_failed'});
  }
 }
 return reply(200,{ok:true});
});
