'use client';
import PageHeader from '@/components/page-header';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {resolveYear,YEAR_EVENT} from '@/lib/academic-year-selection';
type Room={id:string;level_code:string;room_code:string;academic_year_id:string};
type Homeroom={classroom_id:string};
type Offering={id:string;classroom_id:string;subject_id:string;term_id:string};
type Assignment={course_offering_id:string};
type Subject={id:string;subject_code:string;name_th:string};
type Term={id:string;academic_year_id:string;term_no:number};
type Year={id:string;year_be:number;is_active:boolean};
type Student={id:string;student_no:string;first_name_th:string;last_name_th:string};
const label=(r:Room)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
export default function TeacherPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [selectedCourse,setSelectedCourse]=useState(''),[roster,setRoster]=useState<Student[]>([]),[rosterLoading,setRosterLoading]=useState(false),[rosterError,setRosterError]=useState('');
 const [revision,setRevision]=useState(0),[terms,setTerms]=useState<Term[]>([]),[years,setYears]=useState<Year[]>([]);
 const [yearId,setYearId]=useState(''),[schoolId,setSchoolId]=useState('');
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[rooms,setRooms]=useState<Room[]>([]),[homerooms,setHomerooms]=useState<Homeroom[]>([]),[offerings,setOfferings]=useState<Offering[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[subjects,setSubjects]=useState<Subject[]>([]);
 useEffect(()=>{let live=true;(async()=>{
  if(!db){setError('ยังไม่ได้เชื่อม Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const {data:roles,error:roleError}=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','teacher').eq('active',true);
  if(!live)return;
  if(roleError){setError(roleError.message);return;}
  if(!roles?.length){router.replace('/workspace');return;}
  const schoolIds=roles.map(r=>r.school_id);
  setSchoolId(schoolIds[0]);
  const [h,a]=await Promise.all([
   db.from('homeroom_assignments').select('classroom_id').eq('teacher_user_id',user.id).in('school_id',schoolIds),
   db.from('teaching_assignments').select('course_offering_id').eq('teacher_user_id',user.id).in('school_id',schoolIds),
  ]);
  if(!live)return;
  const assignmentError=h.error??a.error;
  if(assignmentError){setError(assignmentError.message);return;}
  const assignedIds=(a.data??[]).map(x=>x.course_offering_id);
  const homeroomIds=(h.data??[]).map(x=>x.classroom_id);
  const o=assignedIds.length
   ?await db.from('course_offerings').select('id,classroom_id,subject_id,term_id').in('id',assignedIds).in('school_id',schoolIds)
   :{data:[] as Offering[],error:null};
  if(!live)return;
  if(o.error){setError(o.error.message);return;}
  const roomIds=[...new Set([...homeroomIds,...(o.data??[]).map(x=>x.classroom_id)])];
  const subjectIds=[...new Set((o.data??[]).map(x=>x.subject_id))];
  const termIds=[...new Set((o.data??[]).map(x=>x.term_id))];
  const [r,s,t]=await Promise.all([
   roomIds.length?db.from('classrooms').select('id,level_code,room_code,academic_year_id').in('id',roomIds).in('school_id',schoolIds):Promise.resolve({data:[] as Room[],error:null}),
   subjectIds.length?db.from('subjects').select('id,subject_code,name_th').in('id',subjectIds).in('school_id',schoolIds):Promise.resolve({data:[] as Subject[],error:null}),
   termIds.length?db.from('terms').select('id,academic_year_id,term_no').in('id',termIds).in('school_id',schoolIds):Promise.resolve({data:[] as Term[],error:null}),
  ]);
  if(!live)return;
  const issue=r.error??s.error??t.error;
  if(issue){setError(issue.message);return;}
  const y=await db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolIds[0]).order('year_be',{ascending:false});
  if(!live)return;
  if(y.error){setError(y.error.message);return;}
  setRooms(r.data??[]);setHomerooms(h.data??[]);setAssignments(a.data??[]);setOfferings(o.data??[]);setSubjects(s.data??[]);setTerms(t.data??[]);setYears(y.data??[]);setYearId(resolveYear(y.data??[],schoolIds[0]));setReady(true);
 })();return()=>{live=false;};},[db,router,revision]);
 useEffect(()=>{let active=true;(async()=>{
   if(!db||!ready||!selectedCourse){setRoster([]);setRosterError('');return;}
   const offering=offerings.find(o=>o.id===selectedCourse);
   if(!offering||!assignments.some(a=>a.course_offering_id===selectedCourse)){setRoster([]);return;}
   setRosterLoading(true);setRosterError('');
   const {data:enrollments,error:enrollmentError}=await db.from('enrollments')
    .select('student_id').eq('classroom_id',offering.classroom_id).in('status',['active','completed']);
   if(!active)return;
   if(enrollmentError){setRosterError(enrollmentError.message);setRosterLoading(false);return;}
   const ids=(enrollments??[]).map(e=>e.student_id);
   if(!ids.length){setRoster([]);setRosterLoading(false);return;}
   const {data:students,error:studentError}=await db.from('students')
    .select('id,student_no,first_name_th,last_name_th').in('id',ids).order('student_no');
   if(!active)return;
   if(studentError)setRosterError(studentError.message);else setRoster(students??[]);
   setRosterLoading(false);
 })();return()=>{active=false;};},[db,ready,selectedCourse,revision,offerings,assignments]);
 useEffect(()=>{
  if(!schoolId)return;
  const update=(e:Event)=>{const detail=(e as CustomEvent<{schoolId:string;yearId:string}>).detail;
   if(detail?.schoolId===schoolId){setYearId(detail.yearId);setSelectedCourse('');}};
  window.addEventListener(YEAR_EVENT,update);return()=>window.removeEventListener(YEAR_EVENT,update);
 },[schoolId]);
 const roomYear=(id:string)=>rooms.find(r=>r.id===id)?.academic_year_id;
 const mine=offerings.filter(o=>assignments.some(a=>a.course_offering_id===o.id)&&roomYear(o.classroom_id)===yearId);
 const visibleHomerooms=homerooms.filter(h=>roomYear(h.classroom_id)===yearId);
 const hiddenAssignments=assignments.length-offerings.filter(o=>assignments.some(a=>a.course_offering_id===o.id)).length;
 return <main className="wichakan-page mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
  <PageHeader title="งานสอนของฉัน" context={"ปีการศึกษา "+(years.find(y=>y.id===yearId)?.year_be??"—")}/>
  <div className="mt-5 flex justify-end"><button onClick={()=>{setReady(false);setError('');setRevision(x=>x+1);}} className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800">รีเฟรชงานสอน ↻</button></div>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
  {ready&&<div className="mt-6 grid gap-5 lg:grid-cols-[minmax(240px,0.85fr)_minmax(0,2fr)]">
   <section className="ui-panel rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">ห้องประจำชั้นของฉัน</h2>
    <div className="mt-4 space-y-3">{visibleHomerooms.map((h,i)=>{const room=rooms.find(r=>r.id===h.classroom_id);return <div key={i} className="rounded-xl bg-slate-50 p-3">{room?label(room):'ห้องเรียน'}</div>;})}</div>
    {!visibleHomerooms.length&&<p className="mt-4 text-sm text-slate-500">ไม่มีห้องประจำชั้นในปีการศึกษาที่เลือก</p>}
   </section>
   <section className="ui-panel rounded-2xl border bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">รายวิชาที่ฉันสอน</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{mine.length} รายวิชา</span></div>
    <div className="mt-4 space-y-3">{mine.map(o=>{const room=rooms.find(r=>r.id===o.classroom_id);const sub=subjects.find(s=>s.id===o.subject_id);return <div key={o.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"><p className="font-semibold text-slate-900">{sub?.subject_code} {sub?.name_th}</p><p className="mt-1 text-sm text-slate-500">{room?label(room):'ห้องเรียน'} · ปี {years.find(y=>y.id===room?.academic_year_id)?.year_be??'—'} · ภาคเรียน {terms.find(t=>t.id===o.term_id)?.term_no??'—'}</p><button onClick={()=>{setSelectedCourse(o.id);setRoster([]);}} className="ui-primary mt-3 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">ดูรายชื่อในห้อง →</button></div>;})}</div>
    {hiddenAssignments>0&&<p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">พบการมอบหมาย {hiddenAssignments} รายการ แต่ไม่สามารถอ่านรายละเอียดรายวิชาได้ กรุณาแจ้งผู้ดูแลตรวจสอบสิทธิ์การอ่านข้อมูล</p>}
    {!mine.length&&hiddenAssignments===0&&<p className="mt-4 text-sm text-slate-500">ไม่มีรายวิชาที่ได้รับมอบหมายในปีการศึกษาที่เลือก</p>}
   </section>
  </div>}
  {ready&&selectedCourse&&mine.some(o=>o.id===selectedCourse)&&<section className="ui-panel mt-5 scroll-mt-36 rounded-2xl border bg-white p-6">
   <div className="flex items-center justify-between"><h2 className="text-xl font-bold">รายชื่อนักเรียนในวิชาที่เลือก</h2><button className="text-sm text-blue-800" onClick={()=>setSelectedCourse('')}>ปิด</button></div>
   {rosterLoading&&<p className="mt-3 text-sm text-slate-500">กำลังโหลดรายชื่อ...</p>}
   {rosterError&&<p role="alert" className="mt-3 text-sm text-red-700">{rosterError}</p>}
   {!rosterLoading&&!rosterError&&<div className="mt-4 divide-y">{roster.map(s=><div key={s.id} className="py-3 text-sm">{s.student_no} — {s.first_name_th} {s.last_name_th}</div>)}{roster.length===0&&<p className="py-4 text-sm text-slate-500">ไม่มีนักเรียนที่ลงทะเบียนในห้องนี้</p>}</div>}
  </section>}
  <p className="mt-6 text-sm text-slate-500">การบันทึกคะแนนและ ปพ.5 อยู่ระหว่างพัฒนา</p>
 </main>;
}
