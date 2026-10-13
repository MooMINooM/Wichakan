'use client';
import Link from 'next/link';
import PageControls,{PAGE_SIZE} from '@/components/page-controls';
import {useEffect,useState} from 'react';
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
 const filtered=members.filter(m=>(name(m.user_id)+' '+(roleName[m.role as Role]??m.role)).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
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
    <div className="mt-5 space-y-3">{displayed.map((m,i)=><div key={m.user_id+'-'+m.role+'-'+i} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <div><p className="font-medium">{name(m.user_id)}</p><p className="mt-1 text-xs text-slate-500">{roleName[m.role as Role]??'ผู้ดูแลระบบ'} · {m.active?'เปิดใช้งาน':'ระงับสิทธิ์'}</p></div>
      {roles.includes(m.role as Role)&&<button disabled={busy} onClick={()=>perform(()=>db!.rpc('set_school_staff_role_active',{p_school_id:schoolId,p_user_id:m.user_id,p_role:m.role,p_active:!m.active}),m.active?'ระงับสิทธิ์แล้ว':'เปิดสิทธิ์แล้ว')} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">{m.active?'ระงับสิทธิ์':'เปิดสิทธิ์'}</button>}
    </div>)}</div><PageControls total={filtered.length} page={Math.min(page,Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)))} onChange={setPage}/>
   </section>
  </div>}
 </main>;
}