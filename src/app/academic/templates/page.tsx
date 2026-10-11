'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type School={id:string;name_th:string};
type Year={id:string;year_be:number};
type Template={id:string;level_code:string;room_code:string;is_active:boolean};
type Membership={school_id:string;role:string;schools:School|null};
const label=(level:string,room:string)=>room.startsWith(level+'/')?room:level+'/'+room;

export default function ClassroomTemplatesPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [schools,setSchools]=useState<School[]>([]);
 const [schoolId,setSchoolId]=useState('');
 const [canManage,setCanManage]=useState(false);
 const [years,setYears]=useState<Year[]>([]);
 const [templates,setTemplates]=useState<Template[]>([]);
 const [sourceYear,setSourceYear]=useState('');
 const [targetYear,setTargetYear]=useState('');
 const [level,setLevel]=useState('ป.1'),[room,setRoom]=useState('1');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let mounted=true;(async()=>{
   if(!db){setError('ยังไม่ได้ตั้งค่า Supabase');return;}
   const {data:{user}}=await db.auth.getUser();
   if(!mounted)return;
   if(!user){router.replace('/login');return;}
   const {data,error:e}=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
   if(!mounted)return;
   if(e){setError(e.message);return;}
   const m=(data??[]) as unknown as Membership[];
   const list=[...new Map(m.filter(x=>x.schools).map(x=>[x.school_id,x.schools!])).values()];
   setSchools(list);setSchoolId(list[0]?.id??'');
 })();return()=>{mounted=false;};},[db,router]);

 async function load(id:string){
   if(!db)return;
   const {data:{user}}=await db.auth.getUser();
   if(!user)return;
   const [y,t,m]=await Promise.all([
     db.from('academic_years').select('id,year_be').eq('school_id',id).order('year_be',{ascending:false}),
     db.from('classroom_templates').select('id,level_code,room_code,is_active').eq('school_id',id).order('level_code'),
     db.from('school_memberships').select('role').eq('school_id',id).eq('user_id',user.id).eq('active',true)
   ]);
   const issue=[y.error,t.error,m.error].find(Boolean);
   if(issue){setError(issue.message);return;}
   setYears(y.data??[]);setTemplates(t.data??[]);
   setCanManage((m.data??[]).some(x=>['school_admin','academic'].includes(x.role)));
   setSourceYear(old=>(y.data??[]).some(v=>v.id===old)?old:y.data?.[1]?.id??y.data?.[0]?.id??'');
   setTargetYear(old=>(y.data??[]).some(v=>v.id===old)?old:y.data?.[0]?.id??'');
 }
 useEffect(()=>{if(schoolId)void load(schoolId);},[schoolId]);
 async function run(action:()=>PromiseLike<{data:unknown;error:{message:string}|null}>,success:(data:unknown)=>string){
   if(!db||!schoolId||!canManage||busy)return;
   setBusy(true);setError('');setNotice('');
   try{
     const result=await action();
     if(result.error)setError(result.error.message);
     else{await load(schoolId);setNotice(success(result.data));}
   }catch(e){setError(e instanceof Error?e.message:'ไม่สามารถบันทึกได้');}
   finally{setBusy(false);}
 }
 const active=templates.filter(x=>x.is_active);
 return <main className="mx-auto max-w-5xl px-5 py-8">
   <Link href="/academic" className="text-sm text-blue-700">← ตั้งค่างานวิชาการ</Link>
   <h1 className="mt-3 text-3xl font-bold">แม่แบบห้องเรียน</h1>
   <p className="mt-2 text-sm text-slate-500">Classroom Templates · กำหนดครั้งเดียว ใช้ได้หลายปีการศึกษา</p>
   {schools.length>1&&<label className="mt-5 block text-sm">โรงเรียน <select className="ml-2 rounded-xl border p-2" value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>}
   {schools.length===1&&<p className="mt-5 font-medium">{schools[0].name_th}</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
   {notice&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">{notice}</p>}
   {schoolId&&<div className="mt-6 grid gap-5 md:grid-cols-2">
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">1. ตั้งค่าห้องเรียนถาวร</h2>
      <p className="mt-2 text-sm text-slate-500">สร้างแม่แบบใหม่ หรือดึงจากห้องเรียนปีเก่าที่จัดไว้แล้ว</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <select aria-label="ระดับชั้นแม่แบบ" className="rounded-xl border p-3" value={level} onChange={e=>setLevel(e.target.value)}>
          {['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3'].map(x=><option key={x}>{x}</option>)}
        </select>
        <input aria-label="เลขห้องแม่แบบ" className="w-24 rounded-xl border p-3" maxLength={12} value={room} onChange={e=>setRoom(e.target.value)} />
        <button disabled={!canManage||busy||!room.trim()} className="rounded-xl bg-blue-800 px-4 text-white disabled:opacity-40" onClick={()=>run(()=>db!.from('classroom_templates').insert({school_id:schoolId,level_code:level,room_code:room.trim()}),'เพิ่มแม่แบบสำเร็จ')}>เพิ่ม</button>
      </div>
      <div className="mt-6 flex gap-2">
        <select aria-label="ปีต้นทาง" className="min-w-0 flex-1 rounded-xl border p-3" value={sourceYear} onChange={e=>setSourceYear(e.target.value)}>
          {years.map(y=><option key={y.id} value={y.id}>ปี {y.year_be}</option>)}
        </select>
        <button disabled={!canManage||busy||!sourceYear} className="rounded-xl border border-blue-300 px-3 text-sm text-blue-800 disabled:opacity-40" onClick={()=>run(()=>db!.rpc('import_classroom_templates',{p_school_id:schoolId,p_year_id:sourceYear}),d=>`นำเข้าแม่แบบใหม่ ${d} ห้อง`)}>นำเข้าจากปีนี้</button>
      </div>
      <h3 className="mt-6 font-bold">ห้องแม่แบบที่เปิดใช้ ({active.length})</h3>
      <div className="mt-3 flex flex-wrap gap-2">{active.map(t=><span key={t.id} className="rounded-xl bg-slate-100 px-3 py-2 text-sm">{label(t.level_code,t.room_code)}</span>)}</div>
      {!active.length&&<p className="mt-3 text-sm text-slate-500">ยังไม่มีแม่แบบ ให้เพิ่มห้องหรือนำเข้าจากปีเดิมก่อน</p>}
    </section>
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">2. เตรียมห้องสำหรับปีใหม่</h2>
      <p className="mt-2 text-sm text-slate-500">เลือกปีปลายทางแล้วสร้างเฉพาะห้องที่ยังไม่มี ไม่แตะนักเรียนหรือห้องปีเก่า</p>
      <label className="mt-5 block text-sm">ปีการศึกษาปลายทาง<select className="mt-2 w-full rounded-xl border p-3" value={targetYear} onChange={e=>setTargetYear(e.target.value)}>
        {years.map(y=><option key={y.id} value={y.id}>ปี {y.year_be}</option>)}
      </select></label>
      <p className="mt-4 text-sm">จำนวนแม่แบบพร้อมใช้งาน: <strong>{active.length} ห้อง</strong></p>
      <button disabled={!canManage||busy||!targetYear||active.length===0} className="mt-5 w-full rounded-xl bg-blue-800 px-4 py-3 font-medium text-white disabled:opacity-40" onClick={()=>run(()=>db!.rpc('prepare_year_classrooms',{p_school_id:schoolId,p_year_id:targetYear}),d=>`สร้างห้องใหม่ ${d} ห้อง (ห้องที่มีอยู่แล้วไม่เปลี่ยนแปลง)`)}>เตรียมห้องเรียนของปีที่เลือก</button>
      <p className="mt-4 text-xs text-slate-500">กดซ้ำได้โดยไม่เกิดห้องซ้ำ หากต้องการยุบห้องในอนาคตต้องรักษาประวัติปีเก่าไว้เสมอ</p>
      <Link href="/academic" className="mt-6 inline-block text-sm font-medium text-blue-700">ตรวจสอบรายชื่อห้องเรียน →</Link>
    </section>
   </div>}
 </main>;
}
