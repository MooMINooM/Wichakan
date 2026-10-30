// School-wide Google Drive OAuth connector for SAR.
// Requires SAR_GOOGLE_CLIENT_ID, SAR_GOOGLE_CLIENT_SECRET and SAR_DRIVE_STATE_SECRET
// in Supabase Edge secrets, plus the callback URL registered in Google Cloud.
// Keeps refresh tokens service-role only; personal Gmail and Workspace accounts supported.
import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
const supaUrl=Deno.env.get('SUPABASE_URL')??'',anon=Deno.env.get('SUPABASE_ANON_KEY')??'',
 service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const clientId=Deno.env.get('SAR_GOOGLE_CLIENT_ID')??'',
 clientSecret=Deno.env.get('SAR_GOOGLE_CLIENT_SECRET')??'',
 stateSecret=Deno.env.get('SAR_DRIVE_STATE_SECRET')??'';
const allowed=(Deno.env.get('SAR_DRIVE_ALLOWED_ORIGINS')??'https://moominoom.github.io,http://localhost:3000').split(',').map(x=>x.trim());
const apiUrl=supaUrl+'/functions/v1/sar-drive';
const callback=apiUrl+'?action=callback';
const admin=createClient(supaUrl,service,{auth:{persistSession:false,autoRefreshToken:false}});
const headers=(origin:string)=>({'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS',
 'access-control-allow-headers':'content-type,authorization,apikey','vary':'Origin'});
const respond=(origin:string,status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:headers(origin)});
function b64u(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function un64(s:string){const bin=atob(s.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-s.length%4)%4));return Uint8Array.from(bin,x=>x.charCodeAt(0));}
const enc=new TextEncoder(),dec=new TextDecoder();
async function sign(data:string){
 const key=await crypto.subtle.importKey('raw',enc.encode(stateSecret),'HMAC',false,['sign']);
 return b64u(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(data))));
}
async function validateState(value:string){
 const [payload,signature]=value.split('.');if(!payload||!signature)return null;
 const key=await crypto.subtle.importKey('raw',enc.encode(stateSecret),'HMAC',false,['verify']);
 const result=await crypto.subtle.verify('HMAC',key,un64(signature),enc.encode(payload));
 if(!result)return null;
 const state=JSON.parse(dec.decode(un64(payload))) as {school:string;user:string;expires:number};
 if(state.expires<Date.now()||state.expires>Date.now()+600001)return null;
 return state;
}
function isUuid(s:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);}
async function isMember(school:string,user:string,roles:string[]){
 const m=await admin.from('school_memberships').select('role').eq('school_id',school).eq('user_id',user).eq('active',true);
 if(m.error)return false;return (m.data??[]).some(v=>roles.includes(v.role));
}
async function exchangeToken(code:string){
 const result=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:callback})});
 if(!result.ok)throw Error('google_token_exchange_failed');
 return result.json() as Promise<{refresh_token?:string;access_token?:string}>;
}
async function getAccess(refreshToken:string):Promise<string>{
 const result=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})});
 if(!result.ok)throw Error('google_refresh_failed');
 const token=await result.json() as {access_token?:string};
 if(!token.access_token)throw Error('google_access_missing');
 return token.access_token;
}
async function googleJson(token:string,url:string,method='GET',body?:unknown){
 const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error('drive_request_failed_'+r.status);
 return r.json() as Promise<{id?:string;files?:{id:string}[];webViewLink?:string}>;
}
function safeName(s:string){return s.normalize('NFC').replace(/[\\/<>:"|?*]+/g,'_').trim().slice(0,85)||'รายการ';}
function escapeQuery(s:string){return s.replaceAll('\\','\\\\').replaceAll("'","\\'");}
async function folder(token:string,parent:string|null,name:string){
 const q=`name = '${escapeQuery(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`+
  (parent?` and '${escapeQuery(parent)}' in parents`:'');
 const url='https://www.googleapis.com/drive/v3/files?fields=files(id)&pageSize=20&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&q='+encodeURIComponent(q);
 const list=await googleJson(token,url);
 if(list.files?.[0]?.id)return list.files[0].id;
 const data=await googleJson(token,'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id','POST',{
  name,mimeType:'application/vnd.google-apps.folder',...(parent?{parents:[parent]}:{})
 });
 if(!data.id)throw Error('drive_folder_creation_failed');return data.id;
}
async function uploadToDrive(token:string,parent:string,name:string,bytes:Uint8Array,mime:string){
 const metadata={name,parents:[parent]};
 const start=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink',
  {method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json; charset=UTF-8','x-upload-content-type':mime,'x-upload-content-length':String(bytes.byteLength)},
   body:JSON.stringify(metadata)});
 if(!start.ok)throw Error('drive_start_upload_failed_'+start.status);
 const location=start.headers.get('location');if(!location||!location.startsWith('https://'))throw Error('drive_upload_location_missing');
 const final=await fetch(location,{method:'PUT',headers:{Authorization:'Bearer '+token,'content-type':mime,'content-length':String(bytes.byteLength)},body:bytes});
 if(!final.ok)throw Error('drive_upload_failed_'+final.status);
 return final.json() as Promise<{id:string;webViewLink?:string}>;
}
const folderNames:Record<string,string>={
 achievement:'ผลงาน',training:'ประวัติการอบรม',innovation:'นวัตกรรม',
 learning_media:'สื่อการสอน',learning_activity:'การจัดการเรียนรู้',plc:'PLC',
 assessment_instrument:'เครื่องมือวัดและประเมินผล',project:'โครงการ',
 facility:'สภาพแวดล้อม',safety:'ความปลอดภัย',other:'หลักฐานอื่น'
};
Deno.serve(async(req:Request)=>{
 const url=new URL(req.url),action=url.searchParams.get('action')??'status',origin=req.headers.get('origin')??'';
 if(action==='callback'&&req.method==='GET'){
  const redirect='https://moominoom.github.io/Wichakan/admin/sar/management/';
  try{
   if(!clientId||!clientSecret||!stateSecret)throw Error('not_configured');
   const state=await validateState(url.searchParams.get('state')??'');
   const code=url.searchParams.get('code')??'';
   if(!state||!isUuid(state.school)||!isUuid(state.user)||!code||!await isMember(state.school,state.user,['school_admin']))throw Error('invalid_oauth_state');
   const oauth=await exchangeToken(code);
   if(!oauth.refresh_token)throw Error('google_refresh_token_not_granted');
   const existing=await admin.from('sar_drive_connections').select('root_folder_id').eq('school_id',state.school).maybeSingle();
   const saved=await admin.from('sar_drive_connections').upsert({school_id:state.school,connected_by:state.user,
    refresh_token:oauth.refresh_token,root_folder_id:existing.data?.root_folder_id??null,updated_at:new Date().toISOString()},{onConflict:'school_id'});
   if(saved.error)throw Error('save_connection_failed');
   return Response.redirect(redirect+'?drive=connected',302);
  }catch{return Response.redirect(redirect+'?drive=error',302)}
 }
 if(!allowed.includes(origin))return new Response('Forbidden',{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 if(req.method!=='POST')return respond(origin,405,{error:'method_not_allowed'});
 if(!clientId||!clientSecret||!stateSecret||!supaUrl||!service||!anon)
  return respond(origin,503,{error:'google_drive_not_configured'});
 const token=(req.headers.get('authorization')??'').replace(/^Bearer /i,'');
 if(token.length<20)return respond(origin,401,{error:'login_required'});
 const userClient=createClient(supaUrl,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const userResult=await userClient.auth.getUser(token);
 const user=userResult.data.user;if(userResult.error||!user)return respond(origin,401,{error:'login_required'});
 let input:{action?:string;school_id?:string;evidence_id?:string}={};
 try{input=await req.json()}catch{return respond(origin,400,{error:'bad_json'})}
 if(!isUuid(input.school_id??''))return respond(origin,400,{error:'invalid_school'});
 const school=input.school_id!;
 const adminRole=await isMember(school,user.id,['school_admin']);
 const teacherRole=await isMember(school,user.id,['teacher']);
 if(!adminRole&&!teacherRole)return respond(origin,403,{error:'not_authorized'});
 if(action==='status'){
  const r=await admin.from('sar_drive_connections').select('school_id').eq('school_id',school).maybeSingle();
  return respond(origin,200,{connected:!!r.data?.school_id,configured:true,can_connect:adminRole});
 }
 if(action==='connect'){
  if(!adminRole)return respond(origin,403,{error:'admin_only'});
  const payload=b64u(enc.encode(JSON.stringify({school,user:user.id,expires:Date.now()+600000})));
  const state=payload+'.'+await sign(payload);
  const params=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',
   scope:'https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent',state});
  return respond(origin,200,{authorization_url:'https://accounts.google.com/o/oauth2/v2/auth?'+params});
 }
 if(action==='sync'){
  if(!isUuid(input.evidence_id??''))return respond(origin,400,{error:'invalid_evidence'});
  const itemR=await admin.from('sar_evidence').select('id,school_id,owner_user_id,kind,title,activity_year_be,storage_path')
   .eq('id',input.evidence_id!).eq('school_id',school).maybeSingle();
  const item=itemR.data;
  if(itemR.error||!item)return respond(origin,404,{error:'evidence_not_found'});
  if(!adminRole&&item.owner_user_id!==user.id)return respond(origin,403,{error:'not_owner'});
  if(!item.storage_path||!item.storage_path.startsWith(school+'/'+item.owner_user_id+'/'+item.id+'/'))
   return respond(origin,422,{error:'evidence_file_required'});
  const connR=await admin.from('sar_drive_connections').select('refresh_token,root_folder_id').eq('school_id',school).maybeSingle();
  if(connR.error||!connR.data)return respond(origin,409,{error:'drive_not_connected'});
  try{
   const driveToken=await getAccess(connR.data.refresh_token);
   const downloaded=await admin.storage.from('wichakan-sar').download(item.storage_path);
   if(downloaded.error||!downloaded.data||downloaded.data.size>10485760)throw Error('evidence_download_failed');
   const ext=item.storage_path.split('.').pop()?.toLowerCase()??'pdf';
   const mime=ext==='pdf'?'application/pdf':ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';
   const bytes=new Uint8Array(await downloaded.data.arrayBuffer());
   const root=connR.data.root_folder_id??await folder(driveToken,null,'Wichakan SAR');
   if(!connR.data.root_folder_id){
    const update=await admin.from('sar_drive_connections').update({root_folder_id:root}).eq('school_id',school);
    if(update.error)throw Error('save_drive_root_failed');
   }
   const people=await folder(driveToken,root,'บุคลากร');
   const userProfile=await admin.from('profiles').select('display_name').eq('user_id',item.owner_user_id).maybeSingle();
   const personName=safeName(userProfile.data?.display_name??'บุคลากร').slice(0,50);
   const person=await folder(driveToken,people,personName+'_'+item.owner_user_id.slice(0,8));
   const category=await folder(driveToken,person,folderNames[item.kind]??'หลักฐานอื่น');
   const fileName=safeName(item.activity_year_be+'_'+item.title+'_'+item.id.slice(0,8))+'.'+ext;
   const uploaded=await uploadToDrive(driveToken,category,fileName,bytes,mime);
   if(!uploaded.id)throw Error('drive_missing_file_id');
   const driveUrl=uploaded.webViewLink??'https://drive.google.com/file/d/'+uploaded.id+'/view';
   const updated=await admin.from('sar_evidence').update({drive_url:driveUrl,updated_at:new Date().toISOString()}).eq('id',item.id).eq('school_id',school);
   if(updated.error)throw Error('save_file_reference_failed');
   return respond(origin,200,{uploaded:true,drive_url:driveUrl});
  }catch{return respond(origin,502,{error:'drive_sync_failed_check_connection'})}
 }
 return respond(origin,400,{error:'unknown_action'});
});
