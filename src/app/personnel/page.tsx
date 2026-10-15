'use client';
import Link from 'next/link';
import PageControls,{PAGE_SIZE} from '@/components/page-controls';
import {useEffect,useRef,useState} from 'react';
import AcademicDialog from '@/components/academic-dialog';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Role='teacher'|'academic'|'registrar'|'director';
type Member={user_id:string;role:string;active:boolean};
type Profile={user_id:string;display_name:string};
const roles:Role[]=['teacher','academic','registrar','director'];
const roleName:Record<Role,string>={teacher:'ครูผู้สอน',academic:'ฝ่ายวิชาการ',registrar:'ฝ่ายทะเบียน',director:'ผู้อำนวยการ'};
export default function PersonnelPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [schoolId,setSchoolId]=useState(''),[schoolName,setSchoolName]=useState('');
 const [members,setMembers]=useState<Member[]>([]),[profiles,setProfiles]=useState<Profile[]>([]);
 const [query,setQuery]=useState(''),[page,setPage]=useState(1),[showAdd,setShowAdd]=useState(false);
 const [uid,setUid]=useState(''),[displayName,setDisplayName]=useState(''),[role,setRole]=useState<Role>('teacher');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [accountForm,setAccountForm]=useState<{mode:'edit'|'password';userId:string}|null>(null);
 const [editName,setEditName]=useState(''),[editEmail,setEditEmail]=useState('');
 const [password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[showPassword,setShowPassword]=useState(false);
 const [formError,setFormError]=useState(''),[accountLoading,setAccountLoading]=useState(false),[accountLoaded,setAccountLoaded]=useState(false);
 const accountRequestId=useRef(0);
 async function accountAction(action:string,userId:string,values:Record<string,string>={}){
  if(!db)throw new Error('ยังไม่ได้เชื่อมต่อระบบ');
  const result=await db.functions.invoke('manage-staff',{body:{action,school_id:schoolId,user_id:userId,...values}});
  if(result.error){
   let message='จัดการบัญชีไม่สำเร็จ กรุณาลองใหม่';
   const context=(result.error as {context?:Response}).context;
   if(context&&typeof context.json==='function'){try{const data=await context.json();if(typeof data.error==='string')message=data.error;}catch{}}
   throw new Error(message);
  }
  if(!result.data||result.data.error)throw new Error(result.data?.error??'ไม่ได้รับผลลัพธ์จากระบบจัดการบัญชี');
  return result.data as {email:string;display_name:string;success?:boolean};
 }
 function closeAccountForm(){if(busy)return;accountRequestId.current++;setAccountForm(null);setPassword('');setConfirmPassword('');setShowPassword(false);setFormError('');}
 async function openAccountForm(mode:'edit'|'password',userId:string){
  const requestId=++accountRequestId.current;
  setAccountForm({mode,userId});setFormError('');setNotice('');setPassword('');setConfirmPassword('');setShowPassword(false);setEditName(name(userId));setEditEmail('');setAccountLoaded(false);
  setAccountLoading(mode==='edit');
  if(mode==='edit')try{
   const account=await accountAction('get-account',userId);
   if(requestId!==accountRequestId.current)return;
   setEditName(account.display_name);setEditEmail(account.email);setAccountLoaded(true);
  }catch(e){if(requestId===accountRequestId.current)setFormError(e instanceof Error?e.message:'โหลดข้อมูลบัญชีไม่สำเร็จ');}
  finally{if(requestId===accountRequestId.current)setAccountLoading(false);}
 }
 async function saveAccount(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!accountForm||busy||accountLoading)return;
  if(accountForm.mode==='edit'&&!accountLoaded)return;
  if(accountForm.mode==='password'&&(password!==confirmPassword||password.length<8||new TextEncoder().encode(password).length>72)){setFormError('รหัสผ่านต้องตรงกัน มีอย่างน้อย 8 ตัวอักษร และไม่เกิน 72 ไบต์');return;}
  setBusy(true);setFormError('');
  try{
   await accountAction(accountForm.mode==='edit'?'update-profile':'reset-password',accountForm.userId,accountForm.mode==='edit'?{display_name:editName.trim(),email:editEmail.trim()}:{password});
   setNotice(accountForm.mode==='edit'?'แก้ไขข้อมูลบุคลากรแล้ว':'ตั้งรหัสผ่านใหม่แล้ว ครูสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้');
   setAccountForm(null);setPassword('');setConfirmPassword('');setShowPassword(false);setRefresh(x=>x+1);
  }catch(e){setFormError(e instanceof Error?e.message:'บันทึกข้อมูลไม่สำเร็จ');}finally{setBusy(false);}
 }

 useEffect(()=>{let alive=true;(async()=>{
  if(!db){setError('ยังไม่ได้เชื่อมต่อ Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!alive)return;
  if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('school_id,role,schools(name_th)').eq('user_id',user.id).eq('active',true);
  if(!alive)return;
  if(e){setError(e.message);return;}
  const admin=(data??[]).find(m=>m.role==='school_admin');
  if(!admin){router.replace('/workspace');return;}
  setSchoolId(admin.school_id);
  const s=admin.schools as unknown as {name_th:string}|null;
  setSchoolName(s?.name_th??'');
 })();return()=>{alive=false;};},[db,router]);
 useEffect(()=>{let alive=true;(async()=>{
  if(!db||!schoolId)return;
  const {data,error:e}=await db.from('school_memberships').select('user_id,role,active').eq('school_id',schoolId);
  if(!alive)return;
  if(e){setError(e.message);return;}
  setMembers(data??[]);
  const ids=[...new Set((data??[]).map(m=>m.user_id))];
  if(!ids.length){setProfiles([]);return;}
  const p=await db.from('profiles').select('user_id,display_name').in('user_id',ids);
  if(!alive)return;
  if(p.error)setError(p.error.message);else setProfiles(p.data??[]);
 })();return()=>{alive=false;};},[db,schoolId,refresh]);
 const name=(id:string)=>profiles.find(p=>p.user_id===id)?.display_name??'บัญชี '+id.slice(0,8);
 const people=[...new Set(members.map(m=>m.user_id))].map(userId=>({userId,memberships:members.filter(m=>m.user_id===userId)}));
 const filtered=people.filter(p=>(name(p.userId)+' '+p.memberships.map(m=>roleName[m.role as Role]??'ผู้ดูแลระบบ').join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const displayed=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
 async function perform(action:()=>PromiseLike<{error:{message:string}|null}>,success:string){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   const result=await action();
   if(result.error)setError(result.error.message);else{setNotice(success);setRefresh(x=>x+1);}
  }catch(e){setError(e instanceof Error?e.message:'บันทึกข้อมูลไม่สำเร็จ');}finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-5xl px-5 py-8">
  <Link href="/workspace" className="text-sm text-blue-700">← พื้นที่ทำงาน</Link>
  <h1 className="mt-3 text-3xl font-bold">จัดการบุคลากร</h1>
  <p className="mt-2 text-sm text-slate-500">Personnel Management · {schoolName}</p>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
  {schoolId&&<div className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
   <section className="rounded-2xl border bg-white p-6 shadow-sm">
    <button type="button" onClick={()=>setShowAdd(v=>!v)} className="w-full rounded-xl bg-blue-800 px-4 py-3 text-left font-semibold text-white">{showAdd?"− ปิดแบบฟอร์ม":"+ เพิ่มสิทธิ์บุคลากร"}</button>
    {showAdd&&<div className="mt-4"><h2 className="text-xl font-bold">เพิ่มสิทธิ์บุคลากร</h2>
    <p className="mt-2 text-sm text-slate-500">บัญชีต้องถูกสร้างใน Supabase Authentication ก่อน จากนั้นใช้ User UID เพื่อผูกกับโรงเรียน</p>
    <label className="mt-5 block text-sm">User UID<input className="mt-2 w-full rounded-xl border p-3" value={uid} onChange={e=>setUid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/></label>
    <label className="mt-4 block text-sm">ชื่อที่แสดง<input className="mt-2 w-full rounded-xl border p-3" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="ชื่อ นามสกุล"/></label>
    <label className="mt-4 block text-sm">บทบาท<select className="mt-2 w-full rounded-xl border p-3" value={role} onChange={e=>setRole(e.target.value as Role)}>{roles.map(r=><option value={r} key={r}>{roleName[r]}</option>)}</select></label>
    <button disabled={busy||!/^[0-9a-fA-F-]{36}$/.test(uid)||displayName.trim().length<2} onClick={()=>perform(()=>db!.rpc('grant_school_staff_role',{p_school_id:schoolId,p_user_id:uid.trim(),p_display_name:displayName.trim(),p_role:role}),'เพิ่มหรือเปิดสิทธิ์บุคลากรแล้ว')} className="mt-5 w-full rounded-xl bg-blue-800 p-3 text-white disabled:opacity-40">บันทึกบุคลากร</button>
    <p className="mt-4 text-xs text-slate-500">สามารถเพิ่มหลายบทบาทให้บัญชีเดียวได้ โดยใช้ UID เดิมและเลือกบทบาทใหม่ ระบบนี้ไม่สร้างรหัสผ่านหรือบัญชี Authentication</p></div>}
   </section>
   <section className="rounded-2xl border bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">บุคลากรในโรงเรียน</h2>
    <input aria-label="ค้นหาบุคลากร" placeholder="ค้นหาชื่อหรือบทบาท..." className="mt-4 w-full rounded-xl border p-3" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/>
    <div className="mt-5 space-y-3">{displayed.map(person=>{
     const protectedAccount=person.memberships.some(m=>m.role==='school_admin');
     return <div key={person.userId} className="rounded-xl border border-slate-200 p-4">
      <p className="font-semibold text-blue-950">{name(person.userId)}</p>
      <div className="mt-2 flex flex-wrap gap-2">{person.memberships.map(m=><div key={m.role} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600"><span>{roleName[m.role as Role]??'ผู้ดูแลระบบ'} · {m.active?'เปิดใช้งาน':'ระงับสิทธิ์'}</span>{roles.includes(m.role as Role)&&<button disabled={busy} onClick={()=>perform(()=>db!.rpc('set_school_staff_role_active',{p_school_id:schoolId,p_user_id:person.userId,p_role:m.role,p_active:!m.active}),m.active?'ระงับสิทธิ์แล้ว':'เปิดสิทธิ์แล้ว')} className="font-semibold text-blue-700 underline disabled:opacity-40">{m.active?'ระงับสิทธิ์':'เปิดสิทธิ์'}</button>}</div>)}</div>
      {!protectedAccount&&<div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
       <button type="button" disabled={busy} onClick={()=>void openAccountForm('edit',person.userId)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40">แก้ไขข้อมูล</button>
       <button type="button" disabled={busy} onClick={()=>void openAccountForm('password',person.userId)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40">รีเซ็ตรหัสผ่าน</button>
      </div>}
     </div>;
    })}{!filtered.length&&<p className="py-5 text-center text-sm text-slate-500">ไม่พบบุคลากร</p>}</div><PageControls total={filtered.length} page={Math.min(page,Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)))} onChange={setPage}/>

   </section>
  </div>}
  {accountForm&&<AcademicDialog title={accountForm.mode==='edit'?'แก้ไขข้อมูลบุคลากร':'รีเซ็ตรหัสผ่านครู'} onClose={closeAccountForm}>
   <p className="mb-4 text-sm font-semibold text-blue-900">{name(accountForm.userId)}</p>
   {accountLoading&&<p role="status" className="mb-4 text-sm text-slate-500">กำลังโหลดข้อมูลบัญชี...</p>}
   {formError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
   {accountForm.mode==='edit'&&!accountLoaded&&!accountLoading&&<button onClick={()=>void openAccountForm('edit',accountForm.userId)} className="mb-4 text-sm font-semibold text-blue-700 underline">โหลดข้อมูลอีกครั้ง</button>}
   <form onSubmit={saveAccount} className="space-y-4">
    {accountForm.mode==='edit'?<>
     <label className="block text-sm font-medium">ชื่อที่แสดง<input required disabled={busy||!accountLoaded} minLength={2} maxLength={150} value={editName} onChange={e=>setEditName(e.target.value)} className="mt-2 w-full rounded-xl border p-3 disabled:bg-slate-50" autoComplete="name"/></label>
     <label className="block text-sm font-medium">อีเมลเข้าสู่ระบบ<input type="email" required disabled={busy||!accountLoaded} maxLength={254} value={editEmail} onChange={e=>setEditEmail(e.target.value)} className="mt-2 w-full rounded-xl border p-3 disabled:bg-slate-50" autoComplete="off"/></label>
     <p className="text-xs text-slate-500">เมื่อเปลี่ยนอีเมล ครูต้องใช้อีเมลใหม่ในการเข้าสู่ระบบ</p>
    </>:<>
     <p className="text-sm text-slate-600">กำหนดรหัสผ่านใหม่ให้บัญชีนี้ ครูจะเข้าสู่ระบบด้วยรหัสผ่านใหม่นี้</p>
     <label className="block text-sm font-medium">รหัสผ่านใหม่<input required type={showPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={72} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border p-3"/></label>
     <label className="block text-sm font-medium">ยืนยันรหัสผ่านใหม่<input required type={showPassword?'text':'password'} autoComplete="new-password" minLength={8} maxLength={72} disabled={busy} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border p-3"/></label>
     <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/>แสดงรหัสผ่าน</label>
     <p className="text-xs text-slate-500">อย่างน้อย 8 ตัวอักษร และไม่เกิน 72 ไบต์</p>
    </>}
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={busy} onClick={closeAccountForm} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">ยกเลิก</button><button type="submit" disabled={busy||accountLoading||(accountForm.mode==='edit'&&!accountLoaded)} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy?'กำลังบันทึก...':accountForm.mode==='edit'?'บันทึกข้อมูล':'ตั้งรหัสผ่านใหม่'}</button></div>
   </form>
  </AcademicDialog>}
 </main>;
}