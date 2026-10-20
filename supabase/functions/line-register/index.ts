// Public endpoint: caller must present a LINE Login ID token (not a user-supplied user ID).
// Return the same acknowledgement for matching and unmatched national IDs.
const headers=(origin:string|null)=>{const allowed=(Deno.env.get('LINE_REGISTRATION_ORIGIN')??'').trim();return {'content-type':'application/json','cache-control':'no-store','vary':'Origin',...(origin&&origin===allowed?{'access-control-allow-origin':origin}:{}),'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'};};
Deno.serve(async req=>{
 const origin=req.headers.get('origin'),h=headers(origin),allowed=(Deno.env.get('LINE_REGISTRATION_ORIGIN')??'').trim();
 const respond=(status:number,message:string)=>new Response(JSON.stringify({status:message}),{status,headers:h});
 if(!allowed||!origin||origin!==allowed)return respond(403,'forbidden');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});
 if(req.method!=='POST')return respond(405,'method_not_allowed');
 if(Number(req.headers.get('content-length')??0)>4096)return respond(413,'too_large');
 const channel=Deno.env.get('LINE_LOGIN_CHANNEL_ID'),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!channel||!url||!key)return respond(503,'not_configured');
 let payload:{id_token?:unknown;citizen_id?:unknown};
 try{const raw=await req.text();if(raw.length>4096)throw Error();payload=JSON.parse(raw);}catch{return respond(400,'invalid_request');}
 if(typeof payload.id_token!=='string'||payload.id_token.length>3000||typeof payload.citizen_id!=='string'||!/^[0-9]{13}$/.test(payload.citizen_id))return respond(400,'invalid_request');
 const verified=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:payload.id_token,client_id:channel})});
 if(!verified.ok)return respond(401,'invalid_line_login');
 const identity=await verified.json() as {sub?:string,iss?:string,aud?:string,exp?:number};
 if(identity.iss!=='https://access.line.me'||identity.aud!==channel||typeof identity.sub!=='string'||identity.sub.length<10||identity.exp==null||identity.exp*1000<Date.now())return respond(401,'invalid_line_login');
 const result=await fetch(url+'/rest/v1/rpc/request_line_registration',{method:'POST',headers:{'content-type':'application/json',apikey:key,Authorization:'Bearer '+key},body:JSON.stringify({p_line_user_id:identity.sub,p_citizen_id:payload.citizen_id})});
 if(!result.ok)return respond(503,'temporarily_unavailable');
 const status=await result.json() as string;
 if(status==='rate_limited')return respond(429,'rate_limited');
 return respond(200,'received');
});
