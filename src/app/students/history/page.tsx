import Link from 'next/link';
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Year={id:string;year_be:number};
type Room={id:string;academic_year_id:string;level_code:string;room_code:string};
type Student={id:string;school_id:string;student_no:string;first_name_th:string;last_name_th:string};
type Enrollment={id:string;student_id:string;academic_year_id:string;classroom_id:string;status:string;started_on:string|null};
type Event={id:string;student_id:string;event_type:string;recorded_at:string;previous_status:string|null;new_status:string;previous_classroom_id:string|null;new_classroom_id:string|null;reason:string|null};
type Membership={school_id:string;role:string;schools:{id:string;name_th:string}|null};
const statuses=[{id:'active',label:'กำลังศึกษา'},{id:'completed',label:'จบปีการศึกษา'},{id:'transferred',label:'ย้ายออก'},{id:'withdrawn',label:'ลาออก'}];
function statusName(s:string){return statuses.find(v=>v.id===s)?.label??s;}

export default function StudentHistoryPage(){
 const router=useRouter();
 const [schoolId,setSchoolId]=useState('');
 const [schools,setSchools]=useState<{id:string;name_th:string}[]>([]);
 const [roles,setRoles]=useState<string[]>([]);
 const [years,setYears]=useState<Year[]>([]);
 const [rooms,setRooms]=useState<Room[]>([]);
 const [students,setStudents]=useState<Student[]>([]);
 const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
 const [events,setEvents]=useState<Event[]>([]);
 const [studentId,setStudentId]=useState('');
 const [yearId,setYearId]=useState('');
 const [roomId,setRoomId]=useState('');
 const [status,setStatus]=useState('active');
 const [reason,setReason]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);
 const writable=roles.some(r=>r==='school_admin'||r==='registrar');

 useEffect(()=>{let alive=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db){setError('กรุณาตั้งค่า Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!alive)return;
  if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
  if(!alive)return;if(e){setError(e.message);return;}
  const m=(data??[]) as unknown as Membership[];
  const unique=[...new Map(m.filter(x=>x.schools).map(x=>[x.school_id,x.schools!])).values()];
  setSchools(unique);setSchoolId(unique[0]?.id??'');setReady(true);
 })();return()=>{alive=false;};},[router]);

 useEffect(()=>{if(!schoolId)return;let alive=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db)return;
  setStudentId('');setYearId('');setRoomId('');setError('');
  const {data:{user}}=await db.auth.getUser();if(!user)return;
  const [y,r,s,e,m]=await Promise.all([
   db.from('academic_years').select('id,year_be').eq('school_id',schoolId).order('year_be',{ascending:false}),
   db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',schoolId),
   db.from('students').select('id,school_id,student_no,first_name_th,last_name_th').eq('school_id',schoolId).order('student_no'),
   db.from('enrollments').select('id,student_id,academic_year_id,classroom_id,status,started_on').eq('school_id',schoolId),
   db.from('school_memberships').select('role').eq('school_id',schoolId).eq('user_id',user.id).eq('active',true)
  ]);
  if(!alive)return;
  const problem=[y.error,r.error,s.error,e.error,m.error].find(Boolean);
  if(problem){setError(problem.message);return;}
  setYears(y.data??[]);setRooms(r.data??[]);setStudents(s.data??[]);setEnrollments(e.data??[]);setRoles((m.data??[]).map(x=>x.role));
  setYearId(y.data?.[0]?.id??'');setStudentId(s.data?.[0]?.id??'');
 })();return()=>{alive=false;};},[schoolId]);

 useEffect(()=>{if(!schoolId||!studentId){setEvents([]);return;}let active=true;(async()=>{
  const db=getSupabaseBrowserClient();
  const {data,error:e}=await db!.from('enrollment_events').select('id,student_id,event_type,recorded_at,previous_status,new_status,previous_classroom_id,new_classroom_id,reason').eq('school_id',schoolId).eq('student_id',studentId).order('recorded_at',{ascending:false}).limit(100);
  if(active){if(e)setError(e.message);else setEvents(data??[]);}
 })();return()=>{active=false;};},[schoolId,studentId,enrollments]);

 const selectedHistory=useMemo(()=>enrollments.filter(e=>e.student_id===studentId).sort((a,b)=>(years.find(y=>y.id===b.academic_year_id)?.year_be??0)-(years.find(y=>y.id===a.academic_year_id)?.year_be??0)),[enrollments,studentId,years]);
 const existing=selectedHistory.find(e=>e.academic_year_id===yearId);
 const currentStatus=status;
 useEffect(()=>{setStatus(existing?.status??'active');},[existing?.id,existing?.status]);
 const availableRooms=rooms.filter(r=>r.academic_year_id===yearId);
 const chosenRoom=roomId||existing?.classroom_id||availableRooms[0]?.id||'';
 const roomName=(id:string|null)=>{const r=rooms.find(x=>x.id===id);return r?`${r.level_code}/${r.room_code}`:'—';};

 async function save(e:React.FormEvent){e.preventDefault();if(!writable||!studentId||!yearId||!chosenRoom)return;
  setBusy(true);setError('');setNotice('');
  const db=getSupabaseBrowserClient()!;
  let problem=null;
  if(existing){
   if(!reason.trim()||reason.trim().length<3){setError('กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร');setBusy(false);return;}
   const {error:e}=await db.rpc('change_student_enrollment',{p_enrollment_id:existing.id,p_classroom_id:chosenRoom,p_status:currentStatus,p_reason:reason.trim()});
   problem=e;
  }else{
   const {error:e}=await db.from('enrollments').insert({school_id:schoolId,student_id:studentId,academic_year_id:yearId,classroom_id:chosenRoom,status:'active'});
   problem=e;
  }
  if(problem)setError(problem.message);
  else{
   const {data,error:e}=await db.from('enrollments').select('id,student_id,academic_year_id,classroom_id,status,started_on').eq('school_id',schoolId);
   if(e)setError(e.message);else{setEnrollments(data??[]);setNotice(existing?'บันทึกการเปลี่ยนแปลงสำเร็จ':'ลงทะเบียนในปีการศึกษาแล้ว');setReason('');}
  }
  setBusy(false);
 }
 return <main className="mx-auto max-w-6xl px-5 py-8">
  <Link href="/students" className="text-sm text-blue-700">← ทะเบียนนักเรียน</Link>
  <h1 className="mt-3 text-3xl font-bold">ประวัติการศึกษา</h1>
  <p className="mt-2 text-sm text-slate-500">การลงทะเบียนรายปี · ห้องเรียน · การเปลี่ยนสถานภาพ</p>
  {ready&&schools.length===0&&<p className="mt-6 rounded-xl bg-amber-50 p-4">ยังไม่มีสิทธิ์เข้าถึงโรงเรียน</p>}
  {schools.length>1&&<select aria-label="โรงเรียน" value={schoolId} onChange={e=>setSchoolId(e.target.value)} className="mt-5 rounded-xl border p-3">{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select>}
  {error&&<p role="alert" className="my-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
  {notice&&<p role="status" className="my-4 rounded-xl bg-green-50 p-4 text-green-800">{notice}</p>}
  {schoolId&&<div className="mt-7 grid gap-6 lg:grid-cols-[1fr_340px]">
   <section className="rounded-2xl bg-white p-6 shadow-sm">
    <label className="block text-sm font-medium">นักเรียน<select value={studentId} onChange={e=>setStudentId(e.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="">เลือกนักเรียน</option>{students.map(s=><option key={s.id} value={s.id}>{s.student_no} — {s.first_name_th} {s.last_name_th}</option>)}</select></label>
    <h2 className="mt-7 text-lg font-bold">ประวัติรายปี</h2>
    <div className="mt-4 space-y-3">{selectedHistory.map(x=><div key={x.id} className="flex items-center justify-between rounded-xl border p-4"><div><strong>ปี {years.find(y=>y.id===x.academic_year_id)?.year_be??'?'}</strong><p className="mt-1 text-sm text-slate-500">ห้อง {roomName(x.classroom_id)}</p></div><span className="text-sm text-blue-700">{statusName(x.status)}</span></div>)}</div>
    {selectedHistory.length===0&&<p className="mt-4 text-sm text-slate-500">ยังไม่มีประวัติการลงทะเบียน</p>}
    <h2 className="mt-8 text-lg font-bold">ประวัติการเปลี่ยนแปลง</h2>
    <div className="mt-3 space-y-3">{events.map(ev=><div key={ev.id} className="border-b py-3 text-sm"><time className="text-slate-500">{new Date(ev.recorded_at).toLocaleString('th-TH')}</time><p className="mt-1">{ev.event_type==='admitted'?'ลงทะเบียน':ev.event_type==='room_changed'?'ย้ายห้อง':'เปลี่ยนสถานภาพ'}: {roomName(ev.previous_classroom_id)} → {roomName(ev.new_classroom_id)} ({statusName(ev.new_status)})</p>{ev.reason&&<p className="text-slate-500">เหตุผล: {ev.reason}</p>}</div>)}</div>
   </section>
   <aside className="rounded-2xl bg-white p-6 shadow-sm">
    <h2 className="text-lg font-bold">จัดการการเข้าเรียน</h2>
    <p className="mt-2 text-xs text-slate-500">เลือกปีใหม่เพื่อลงทะเบียนเลื่อนชั้น โดยไม่แก้ประวัติปีเก่า</p>
    <form onSubmit={save} className="mt-5 space-y-4">
     <label className="block text-sm font-medium">ปีการศึกษา<select required value={yearId} onChange={e=>{setYearId(e.target.value);setRoomId('');setStatus('active');}} className="mt-2 w-full rounded-xl border p-3">{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
     <label className="block text-sm font-medium">ห้องเรียน<select required value={chosenRoom} onChange={e=>setRoomId(e.target.value)} className="mt-2 w-full rounded-xl border p-3">{availableRooms.map(r=><option key={r.id} value={r.id}>{r.level_code}/{r.room_code}</option>)}</select></label>
     {existing&&<><label className="block text-sm font-medium">สถานภาพ<select value={currentStatus} onChange={e=>setStatus(e.target.value)} className="mt-2 w-full rounded-xl border p-3">{statuses.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label className="block text-sm font-medium">เหตุผลการแก้ไข<textarea required minLength={3} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-xl border p-3" rows={3}/></label></>}
     <button disabled={!writable||busy||!studentId||!chosenRoom} className="w-full rounded-xl bg-blue-800 p-3 font-semibold text-white disabled:opacity-40">{busy?'กำลังบันทึก...':existing?'บันทึกการเปลี่ยนแปลง':'ลงทะเบียนปีการศึกษา'}</button>
     {!writable&&<p className="text-xs text-slate-500">เฉพาะฝ่ายทะเบียนและผู้ดูแลระบบเท่านั้นที่แก้ไขได้</p>}
    </form>
   </aside>
  </div>}
 </main>;
}
