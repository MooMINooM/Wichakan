import type {SupabaseClient} from '@supabase/supabase-js';
type Dependencies={userClient:(token:string)=>SupabaseClient;adminClient:()=>SupabaseClient;origins:string[]};
const staffRoles=new Set(['teacher','academic','registrar','director']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createStaffHandler(deps:Dependencies){
 return async(req:Request):Promise<Response>=>{
  const origin=req.headers.get('Origin');
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(origin&&deps.origins.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!deps.origins.includes(origin))return reply(403,{error:'ไม่อนุญาตให้เรียกจากเว็บไซต์นี้'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'ใช้คำสั่ง POST เท่านั้น'});
  const token=req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if(!token)return reply(401,{error:'กรุณาเข้าสู่ระบบอีกครั้ง'});
  try{
   const userDb=deps.userClient(token);
   const {data:auth,error:authError}=await userDb.auth.getUser(token);
   if(authError||!auth.user)return reply(401,{error:'กรุณาเข้าสู่ระบบอีกครั้ง'});
   let body:Record<string,unknown>;
   try{const raw=await req.text();if(raw.length>8192)return reply(413,{error:'ข้อมูลมีขนาดใหญ่เกินไป'});body=JSON.parse(raw);if(!body||Array.isArray(body)||typeof body!=='object')throw new Error();}catch{return reply(400,{error:'รูปแบบข้อมูลไม่ถูกต้อง'});}
   const {action,school_id:schoolId,user_id:targetId}=body;
   if(typeof schoolId!=='string'||!uuid.test(schoolId)||typeof targetId!=='string'||!uuid.test(targetId)||!['get-account','update-profile','reset-password'].includes(String(action)))return reply(400,{error:'ข้อมูลบัญชีหรือคำสั่งไม่ถูกต้อง'});
   // The actor must be an active administrator of the requested school. Never
   // trust user_metadata, client roles, or a caller-supplied actor ID.
   const actor=await userDb.from('school_memberships').select('user_id').eq('school_id',schoolId).eq('user_id',auth.user.id).eq('role','school_admin').eq('active',true).maybeSingle();
   if(actor.error)return reply(500,{error:'ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองใหม่'});
   if(!actor.data)return reply(403,{error:'อนุญาตเฉพาะผู้ดูแลระบบโรงเรียนเท่านั้น'});
   const admin=deps.adminClient();
   const target=await admin.from('school_memberships').select('school_id,role').eq('user_id',targetId);
   if(target.error)return reply(500,{error:'ตรวจสอบบัญชีบุคลากรไม่สำเร็จ'});
   const memberships=(target.data??[]) as {school_id:string;role:string}[];
   if(!memberships.some(m=>m.school_id===schoolId&&staffRoles.has(m.role))||memberships.some(m=>m.role==='school_admin'))return reply(403,{error:'บัญชีนี้ไม่ใช่บุคลากรที่สามารถจัดการได้'});
   // Auth identity and profiles are global; one school must not take over a
   // shared account belonging to another school.
   if(memberships.some(m=>m.school_id!==schoolId))return reply(409,{error:'บัญชีนี้ใช้ร่วมกับโรงเรียนอื่น กรุณาให้เจ้าของบัญชีแก้ไขข้อมูลด้วยตนเอง'});
   if(action==='reset-password'){
    const password=body.password;
    if(typeof password!=='string'||password.length<8||new TextEncoder().encode(password).length>72||!password.trim())return reply(400,{error:'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และไม่เกิน 72 ไบต์'});
    const result=await admin.auth.admin.updateUserById(targetId,{password});
    if(result.error)return reply(400,{error:'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบเงื่อนไขรหัสผ่านหรือลองใหม่'});
    // Never return, log, or store the password outside Supabase Auth.
    return reply(200,{success:true});
   }
   if(action==='update-profile'){
    const displayName=typeof body.display_name==='string'?body.display_name.trim():'';
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    if(displayName.length<2||displayName.length>150||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{error:'กรุณากรอกชื่อ 2–150 ตัวอักษรและอีเมลที่ถูกต้อง'});
    const existing=await admin.auth.admin.getUserById(targetId);
    if(existing.error||!existing.data.user)return reply(404,{error:'ไม่พบบัญชีเข้าสู่ระบบของบุคลากร'});
    const emailChanged=existing.data.user.email?.toLowerCase()!==email;
    if(emailChanged){
     const result=await admin.auth.admin.updateUserById(targetId,{email});
     if(result.error)return reply(400,{error:'แก้ไขอีเมลไม่สำเร็จ อีเมลอาจถูกใช้งานแล้วหรือไม่ถูกต้อง'});
    }
    const profile=await admin.from('profiles').upsert({user_id:targetId,display_name:displayName},{onConflict:'user_id'});
    if(profile.error)return reply(500,{error:emailChanged?'อีเมลเปลี่ยนแล้ว แต่บันทึกชื่อไม่สำเร็จ กรุณากดบันทึกอีกครั้ง':'บันทึกชื่อไม่สำเร็จ กรุณาลองใหม่',partial:emailChanged});
    return reply(200,{success:true,email,display_name:displayName});
   }
   const [account,profile]=await Promise.all([admin.auth.admin.getUserById(targetId),admin.from('profiles').select('display_name').eq('user_id',targetId).maybeSingle()]);
   if(account.error||!account.data.user)return reply(404,{error:'ไม่พบบัญชีเข้าสู่ระบบของบุคลากร'});
   if(profile.error)return reply(500,{error:'โหลดข้อมูลบุคลากรไม่สำเร็จ'});
   return reply(200,{email:account.data.user.email??'',display_name:profile.data?.display_name??''});
  }catch{
   return reply(500,{error:'ระบบจัดการบัญชีไม่พร้อมใช้งาน กรุณาลองใหม่'});
  }
 };
}
