// Authenticated LINE Parent Portal: never accept a caller-supplied LINE user ID.
// LINE ID tokens are verified with LINE servers before using service-role database access.
const respond=(status:number,data:unknown,origin:string)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'}});
Deno.serve(async(req:Request)=>{
 const expectedOrigin=(Deno.env.get('LINE_REGISTRATION_ORIGIN')??'').trim(),origin=req.headers.get('origin')??'';
 if(!expectedOrigin||origin!==expectedOrigin)return new Response('Forbidden',{status:403});
 if(req.method==='OPTIONS')return respond(204,{},origin);
 if(req.method!=='POST')return respond(405,{error:'method_not_allowed'},origin);
 if(Number(req.headers.get('content-length')??'0')>5000)return respond(413,{error:'too_large'},origin);
 const channel=Deno.env.get('LINE_LOGIN_CHANNEL_ID'),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!channel||!url||!key)return respond(503,{error:'not_configured'},origin);
 let input:{id_token?:unknown;student_id?:unknown;year_id?:unknown;term_no?:unknown};
 try{const raw=await req.text();if(raw.length>5000)throw Error();input=JSON.parse(raw);}catch{return respond(400,{error:'bad_request'},origin);}
 if(typeof input.id_token!=='string'||input.id_token.length>3000)return respond(401,{error:'login_required'},origin);
 const verify=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:input.id_token,client_id:channel})});
 if(!verify.ok)return respond(401,{error:'login_required'},origin);
 const identity=await verify.json() as {sub?:string;iss?:string;aud?:string;exp?:number};
 if(identity.iss!=='https://access.line.me'||identity.aud!==channel||!identity.sub||!identity.exp||identity.exp*1000<Date.now())return respond(401,{error:'login_required'},origin);
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const selected=typeof input.student_id==='string'&&uuid.test(input.student_id)&&typeof input.year_id==='string'&&uuid.test(input.year_id)&&[1,2].includes(Number(input.term_no));
 if(input.student_id!==undefined&&!selected)return respond(400,{error:'invalid_selection'},origin);
 const q=await fetch(url+'/rest/v1/rpc/line_parent_portal_data',{method:'POST',headers:{'content-type':'application/json',apikey:key,Authorization:'Bearer '+key},body:JSON.stringify({p_line_user_id:identity.sub,p_student_id:selected?input.student_id:null,p_year:selected?input.year_id:null,p_term:selected?input.term_no:null})});
 if(!q.ok)return respond(503,{error:'temporarily_unavailable'},origin);
 return respond(200,await q.json(),origin);
});
