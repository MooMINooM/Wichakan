import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
export type SarDriveStatus={configured?:boolean;connected?:boolean;can_connect?:boolean;error?:string};
export async function callSarDrive(action:'status'|'connect'|'sync',school:string,evidenceId?:string):Promise<{connected?:boolean;configured?:boolean;can_connect?:boolean;authorization_url?:string;uploaded?:boolean;drive_url?:string}>{
 const db=getSupabaseBrowserClient();if(!db)throw Error('ยังไม่ได้ตั้งค่า Supabase');
 const {data:{session},error}=await db.auth.getSession();
 if(error||!session)throw Error('กรุณาเข้าสู่ระบบใหม่');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw Error('ยังไม่ได้ตั้งค่าฐานข้อมูล');
 const response=await fetch(url+'/functions/v1/sar-drive?action='+action,{
  method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+session.access_token,apikey:key},
  body:JSON.stringify({school_id:school,...(evidenceId?{evidence_id:evidenceId}:{})}),
  cache:'no-store'
 });
 const result=await response.json().catch(()=>({error:'invalid_drive_response'})) as {error?:string;connected?:boolean;configured?:boolean;can_connect?:boolean;authorization_url?:string;uploaded?:boolean;drive_url?:string};
 if(!response.ok){
  if(result.error==='google_drive_not_configured')throw Error('Google Drive ยังไม่ได้ตั้งค่า OAuth ของโรงเรียน');
  if(result.error==='drive_not_connected')throw Error('Admin ยังไม่ได้เชื่อมบัญชี Google Drive');
  throw Error('การเชื่อม Google Drive ไม่สำเร็จ: '+(result.error??response.status));
 }
 return result;
}
