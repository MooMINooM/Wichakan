'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Room={id:string;level_code:string;room_code:string;academic_year_id:string};
type Homeroom={classroom_id:string};
type Offering={id:string;classroom_id:string;subject_id:string};
type Assignment={course_offering_id:string};
type Subject={id:string;subject_code:string;name_th:string};
const label=(r:Room)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
export default function TeacherPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[rooms,setRooms]=useState<Room[]>([]),[homerooms,setHomerooms]=useState<Homeroom[]>([]),[offerings,setOfferings]=useState<Offering[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[subjects,setSubjects]=useState<Subject[]>([]);
 useEffect(()=>{let live=true;(async()=>{
  if(!db){setError('ยังไม่ได้เชื่อม Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const {data:roles,error:roleError}=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','teacher').eq('active',true);
  if(!live)return;
  if(roleError){setError(roleError.message);return;}
  if(!roles?.length){router.replace('/workspace');return;}
  const schoolIds=roles.map(r=>r.school_id);
  const [r,h,a,o,s]=await Promise.all([
   db.from('classrooms').select('id,level_code,room_code,academic_year_id').in('school_id',schoolIds),
   db.from('homeroom_assignments').select('classroom_id').eq('teacher_user_id',user.id).in('school_id',schoolIds),
   db.from('teaching_assignments').select('course_offering_id').eq('teacher_user_id',user.id).in('school_id',schoolIds),
   db.from('course_offerings').select('id,classroom_id,subject_id').in('school_id',schoolIds),
   db.from('subjects').select('id,subject_code,name_th').in('school_id',schoolIds),
  ]);
  if(!live)return;
  const issue=[r.error,h.error,a.error,o.error,s.error].find(Boolean);
  if(issue){setError(issue.message);return;}
  setRooms(r.data??[]);setHomerooms(h.data??[]);setAssignments(a.data??[]);setOfferings(o.data??[]);setSubjects(s.data??[]);setReady(true);
 })();return()=>{live=false;};},[db,router]);
 const mine=offerings.filter(o=>assignments.some(a=>a.course_offering_id===o.id));
 return <main className="mx-auto max-w-5xl px-5 py-10">
  <Link href="/workspace" className="text-sm text-blue-700">← เปลี่ยนพื้นที่ทำงาน</Link>
  <header className="mt-4 rounded-2xl bg-[#116b78] p-7 text-white"><h1 className="text-3xl font-bold">Teacher Dashboard</h1><p className="mt-2 text-sm text-teal-100">ห้องเรียนและรายวิชาที่ได้รับมอบหมาย</p></header>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
  {ready&&<div className="mt-6 grid gap-5 md:grid-cols-2">
   <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">ห้องประจำชั้นของฉัน</h2>
    <div className="mt-4 space-y-3">{homerooms.map((h,i)=>{const room=rooms.find(r=>r.id===h.classroom_id);return <div key={i} className="rounded-xl bg-slate-50 p-3">{room?label(room):'ห้องเรียน'}</div>;})}</div>
    {!homerooms.length&&<p className="mt-4 text-sm text-slate-500">ยังไม่ได้รับมอบหมายเป็นครูประจำชั้น</p>}
   </section>
   <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">รายวิชาที่ฉันสอน</h2>
    <div className="mt-4 space-y-3">{mine.map(o=>{const room=rooms.find(r=>r.id===o.classroom_id);const sub=subjects.find(s=>s.id===o.subject_id);return <div key={o.id} className="rounded-xl bg-slate-50 p-3"><p className="font-medium">{sub?.subject_code} {sub?.name_th}</p><p className="mt-1 text-sm text-slate-500">{room?label(room):'ห้องเรียน'}</p></div>;})}</div>
    {!mine.length&&<p className="mt-4 text-sm text-slate-500">ยังไม่ได้รับมอบหมายวิชาสอน</p>}
   </section>
  </div>}
  <p className="mt-6 text-sm text-slate-500">ระบบ ปพ.5 และบันทึกคะแนนจะเปิดใช้หลังทดสอบการจำกัดสิทธิ์รายวิชา ยังไม่มีฟังก์ชันแก้คะแนนในหน้านี้</p>
 </main>;
}