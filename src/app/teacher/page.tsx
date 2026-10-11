'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Room={id:string;level_code:string;room_code:string;academic_year_id:string};
type Homeroom={classroom_id:string};
type Offering={id:string;classroom_id:string;subject_id:string;term_id:string};
type Assignment={course_offering_id:string};
type Subject={id:string;subject_code:string;name_th:string};
type Term={id:string;academic_year_id:string;term_no:number};
type Year={id:string;year_be:number};
const label=(r:Room)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
export default function TeacherPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [revision,setRevision]=useState(0),[terms,setTerms]=useState<Term[]>([]),[years,setYears]=useState<Year[]>([]);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[rooms,setRooms]=useState<Room[]>([]),[homerooms,setHomerooms]=useState<Homeroom[]>([]),[offerings,setOfferings]=useState<Offering[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[subjects,setSubjects]=useState<Subject[]>([]);
 useEffect(()=>{let live=true;(async()=>{
  if(!db){setError('ยังไม่ได้เชื่อม Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const {data:roles,error:roleError}=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','teacher').eq('active',true);
  if(!live)return;
  if(roleError){setError(roleError.message);return;}
  if(!roles?.length){router.replace('/workspace');return;}
  const schoolIds=roles.map(r=>r.school_id);
  const [r,h,a,o,s,t,y]=await Promise.all([
   db.from('classrooms').select('id,level_code,room_code,academic_year_id').in('school_id',schoolIds),
   db.from('homeroom_assignments').select('classroom_id').eq('teacher_user_id',user.id).in('school_id',schoolIds),
   db.from('teaching_assignments').select('course_offering_id').eq('teacher_user_id',user.id).in('school_id',schoolIds),
   db.from('course_offerings').select('id,classroom_id,subject_id,term_id').in('school_id',schoolIds),
   db.from('subjects').select('id,subject_code,name_th').in('school_id',schoolIds),
   db.from('terms').select('id,academic_year_id,term_no').in('school_id',schoolIds),
   db.from('academic_years').select('id,year_be').in('school_id',schoolIds),
  ]);
  if(!live)return;
  const issue=[r.error,h.error,a.error,o.error,s.error,t.error,y.error].find(Boolean);
  if(issue){setError(issue.message);return;}
  setRooms(r.data??[]);setHomerooms(h.data??[]);setAssignments(a.data??[]);setOfferings(o.data??[]);setSubjects(s.data??[]);setTerms(t.data??[]);setYears(y.data??[]);setReady(true);
 })();return()=>{live=false;};},[db,router,revision]);
 const mine=offerings.filter(o=>assignments.some(a=>a.course_offering_id===o.id));
 return <main className="mx-auto max-w-5xl px-5 py-10">
  <Link href="/workspace" className="text-sm text-blue-700">← เปลี่ยนพื้นที่ทำงาน</Link>
  <header className="mt-4 rounded-2xl bg-[#116b78] p-7 text-white"><h1 className="text-3xl font-bold">Teacher Dashboard</h1><p className="mt-2 text-sm text-teal-100">ห้องเรียนและรายวิชาที่ได้รับมอบหมาย</p></header>
  <div className="mt-5 flex justify-end"><button onClick={()=>{setReady(false);setError('');setRevision(x=>x+1);}} className="rounded-xl border border-teal-300 bg-white px-4 py-2 text-sm font-medium text-teal-800">รีเฟรชงานสอน ↻</button></div>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
  {ready&&<div className="mt-6 grid gap-5 md:grid-cols-2">
   <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">ห้องประจำชั้นของฉัน</h2>
    <div className="mt-4 space-y-3">{homerooms.map((h,i)=>{const room=rooms.find(r=>r.id===h.classroom_id);return <div key={i} className="rounded-xl bg-slate-50 p-3">{room?label(room):'ห้องเรียน'}</div>;})}</div>
    {!homerooms.length&&<p className="mt-4 text-sm text-slate-500">ยังไม่ได้รับมอบหมายเป็นครูประจำชั้น</p>}
   </section>
   <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">รายวิชาที่ฉันสอน</h2>
    <div className="mt-4 space-y-3">{mine.map(o=>{const room=rooms.find(r=>r.id===o.classroom_id);const sub=subjects.find(s=>s.id===o.subject_id);return <div key={o.id} className="rounded-xl bg-slate-50 p-3"><p className="font-medium">{sub?.subject_code} {sub?.name_th}</p><p className="mt-1 text-sm text-slate-500">{room?label(room):'ห้องเรียน'} · ปี {years.find(y=>y.id===room?.academic_year_id)?.year_be??'—'} · ภาคเรียน {terms.find(t=>t.id===o.term_id)?.term_no??'—'}</p></div>;})}</div>
    {!mine.length&&<p className="mt-4 text-sm text-slate-500">ยังไม่ได้รับมอบหมายวิชาสอน</p>}
   </section>
  </div>}
  <p className="mt-6 text-sm text-slate-500">ระบบ ปพ.5 และบันทึกคะแนนจะเปิดใช้หลังทดสอบการจำกัดสิทธิ์รายวิชา ยังไม่มีฟังก์ชันแก้คะแนนในหน้านี้</p>
 </main>;
}