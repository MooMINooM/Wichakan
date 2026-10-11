'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number};
type Room={id:string;academic_year_id:string;level_code:string;room_code:string};
type Member={user_id:string;role:string};
type Teacher={user_id:string;display_name:string};
type Homeroom={id:string;classroom_id:string;teacher_user_id:string};
type Term={id:string;academic_year_id:string;term_no:number};
type Subject={id:string;subject_code:string;name_th:string};
type Offering={id:string;term_id:string;classroom_id:string;subject_id:string};
type Assignment={id:string;course_offering_id:string;teacher_user_id:string};
const roomName=(r:Room)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
export default function TeachersPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [schoolId,setSchoolId]=useState(''),[canWrite,setCanWrite]=useState(false);
 const [years,setYears]=useState<Year[]>([]),[rooms,setRooms]=useState<Room[]>([]),[members,setMembers]=useState<Member[]>([]),[teachers,setTeachers]=useState<Teacher[]>([]);
 const [homerooms,setHomerooms]=useState<Homeroom[]>([]),[terms,setTerms]=useState<Term[]>([]),[subjects,setSubjects]=useState<Subject[]>([]),[offerings,setOfferings]=useState<Offering[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]);
 const [yearId,setYearId]=useState(''),[classId,setClassId]=useState(''),[teacherId,setTeacherId]=useState('');
 const [termId,setTermId]=useState(''),[subjectId,setSubjectId]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;(async()=>{
  if(!db){setError('ยังไม่ได้เชื่อม Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('school_id,role').eq('user_id',user.id).eq('active',true);
  if(!active)return;if(e){setError(e.message);return;}
  const membership=(data??[]).find(m=>['school_admin','academic'].includes(m.role))??data?.[0];
  if(!membership){setError('บัญชีนี้ไม่มีสิทธิ์เข้าถึงโรงเรียน');return;}
  setSchoolId(membership.school_id);setCanWrite(['school_admin','academic'].includes(membership.role));
 })();return()=>{active=false;};},[db,router]);
 useEffect(()=>{if(!db||!schoolId)return;let active=true;(async()=>{
 const requests=await Promise.all([
  db.from('academic_years').select('id,year_be').eq('school_id',schoolId).order('year_be',{ascending:false}),
  db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',schoolId),
  db.from('school_memberships').select('user_id,role').eq('school_id',schoolId).eq('active',true),
  db.from('homeroom_assignments').select('id,classroom_id,teacher_user_id').eq('school_id',schoolId),
  db.from('terms').select('id,academic_year_id,term_no').eq('school_id',schoolId),
  db.from('subjects').select('id,subject_code,name_th').eq('school_id',schoolId),
  db.from('course_offerings').select('id,term_id,classroom_id,subject_id').eq('school_id',schoolId),
  db.from('teaching_assignments').select('id,course_offering_id,teacher_user_id').eq('school_id',schoolId),
 ]);
 if(!active)return;
 const bad=requests.find(x=>x.error);if(bad?.error){setError(bad.error.message);return;}
 const [y,r,m,h,t,s,o,a]=requests;
 const ids=(m.data??[]).filter(x=>x.role==='teacher').map(x=>x.user_id);
 const p=ids.length?await db.from('profiles').select('user_id,display_name').in('user_id',ids):{data:[],error:null};
 if(!active)return;if(p.error){setError(p.error.message);return;}
 setYears((y.data??[]) as Year[]);setRooms((r.data??[]) as Room[]);setMembers((m.data??[]) as Member[]);
 setHomerooms((h.data??[]) as Homeroom[]);setTerms((t.data??[]) as Term[]);setSubjects((s.data??[]) as Subject[]);
 setOfferings((o.data??[]) as Offering[]);setAssignments((a.data??[]) as Assignment[]);setTeachers((p.data??[]) as Teacher[]);
 setYearId(prev=>(y.data??[]).some(v=>v.id===prev)?prev:y.data?.[0]?.id??'');
 })();return()=>{active=false;};},[db,schoolId,revision]);
 const yearRooms=rooms.filter(r=>r.academic_year_id===yearId);
 const validRoom=yearRooms.some(r=>r.id===classId)?classId:yearRooms[0]?.id??'';
 const validTeacher=teachers.some(t=>t.user_id===teacherId)?teacherId:teachers[0]?.user_id??'';
 const yearTerms=terms.filter(t=>t.academic_year_id===yearId);
 const validTerm=yearTerms.some(t=>t.id===termId)?termId:yearTerms[0]?.id??'';
 const currentOfferings=offerings.filter(o=>o.classroom_id===validRoom&&o.term_id===validTerm);
 const name=(id:string)=>teachers.find(t=>t.user_id===id)?.display_name??'ไม่พบชื่อครู';
 async function act(task:()=>PromiseLike<{error:{message:string}|null}>,success:string){
  if(!db||!canWrite||busy)return;setBusy(true);setError('');setNotice('');
  try{const result=await task();if(result.error)setError(result.error.message);else{setNotice(success);setRevision(v=>v+1);}}
  catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-6xl px-5 py-8">
  <Link href="/academic" className="text-sm text-blue-700">← ตั้งค่างานวิชาการ</Link>
  <h1 className="mt-3 text-3xl font-bold">มอบหมายครู</h1><p className="mt-2 text-sm text-slate-500">Teacher Assignments · ครูประจำชั้นและครูผู้สอนตามปีการศึกษา</p>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
  {notice&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-green-700">{notice}</p>}
  {schoolId&&<div className="mt-6 space-y-5">
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3">
       <label className="text-sm">ปีการศึกษา<select className="mt-2 w-full rounded-xl border p-3" value={yearId} onChange={e=>{setYearId(e.target.value);setClassId('');setTermId('');}}>
       {years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
       <label className="text-sm">ห้องเรียน<select className="mt-2 w-full rounded-xl border p-3" value={validRoom} onChange={e=>setClassId(e.target.value)}>{yearRooms.map(r=><option key={r.id} value={r.id}>{roomName(r)}</option>)}</select></label>
       <label className="text-sm">ภาคเรียน<select className="mt-2 w-full rounded-xl border p-3" value={validTerm} onChange={e=>setTermId(e.target.value)}>{yearTerms.map(t=><option key={t.id} value={t.id}>ภาคเรียน {t.term_no}</option>)}</select></label>
      </div>
    </section>
    <div className="grid gap-5 lg:grid-cols-2">
     <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">ครูประจำชั้น</h2><p className="mt-2 text-sm text-slate-500">ครูประจำชั้นสามารถเปลี่ยนได้ในแต่ละปี โดยไม่กระทบปีเก่า</p>
      <div className="mt-4 flex gap-2">
       <select aria-label="ครูประจำชั้น" className="min-w-0 flex-1 rounded-xl border p-3" value={validTeacher} onChange={e=>setTeacherId(e.target.value)}>
        {teachers.map(t=><option key={t.user_id} value={t.user_id}>{t.display_name}</option>)}</select>
       <button disabled={!canWrite||busy||!validRoom||!validTeacher} onClick={()=>act(()=>db!.from('homeroom_assignments').insert({school_id:schoolId,classroom_id:validRoom,teacher_user_id:validTeacher}),'มอบหมายครูประจำชั้นสำเร็จ')} className="rounded-xl bg-blue-800 px-4 text-white disabled:opacity-40">มอบหมาย</button>
      </div>
      <div className="mt-4 space-y-2">{homerooms.filter(h=>h.classroom_id===validRoom).map(h=><div key={h.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{name(h.teacher_user_id)}</span><button disabled={!canWrite||busy} className="text-red-700 disabled:opacity-40" onClick={()=>act(()=>db!.from('homeroom_assignments').delete().eq('id',h.id).eq('school_id',schoolId),'ยกเลิกมอบหมายแล้ว')}>ยกเลิก</button></div>)}</div>
      {teachers.length===0&&<p className="mt-4 text-sm text-amber-700">ยังไม่มีบัญชีที่ได้รับบทบาท teacher ในโรงเรียนนี้</p>}
     </section>
     <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">ครูผู้สอนรายวิชา</h2><p className="mt-2 text-sm text-slate-500">ขั้นที่ 1 เปิดสอนรายวิชา → ขั้นที่ 2 กดมอบหมายให้ครูในรายการวิชาด้านล่าง (การเปิดสอนไม่ได้มอบหมายครูอัตโนมัติ)</p>
      <div className="mt-4 flex gap-2">
       <select aria-label="รายวิชา" className="min-w-0 flex-1 rounded-xl border p-3" value={subjectId} onChange={e=>setSubjectId(e.target.value)}>
        <option value="">เลือกรายวิชา</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.subject_code} {s.name_th}</option>)}</select>
       <button disabled={!canWrite||busy||!subjectId||!validRoom||!validTerm} onClick={()=>act(()=>db!.from('course_offerings').insert({school_id:schoolId,term_id:validTerm,classroom_id:validRoom,subject_id:subjectId}),'เปิดสอนรายวิชาแล้ว')} className="rounded-xl bg-blue-800 px-4 text-white disabled:opacity-40">1. เปิดสอน</button>
      </div>
      <div className="mt-5 space-y-3">{currentOfferings.map(o=><div key={o.id} className="rounded-xl border p-3">
       <p className="font-medium">{subjects.find(s=>s.id===o.subject_id)?.subject_code} {subjects.find(s=>s.id===o.subject_id)?.name_th}</p><p className="mt-1 text-xs text-amber-700">{assignments.some(a=>a.course_offering_id===o.id)?"มอบหมายครูแล้ว":"ยังไม่ได้มอบหมายครูผู้สอน"}</p>
       {assignments.filter(a=>a.course_offering_id===o.id).map(a=><div key={a.id} className="mt-2 flex justify-between text-sm"><span>{name(a.teacher_user_id)}</span><button disabled={!canWrite||busy} className="text-red-700 disabled:opacity-40" onClick={()=>act(()=>db!.from('teaching_assignments').delete().eq('id',a.id).eq('school_id',schoolId),'ยกเลิกครูผู้สอนแล้ว')}>ยกเลิก</button></div>)}
       <button disabled={!canWrite||busy||!validTeacher} onClick={()=>act(()=>db!.from('teaching_assignments').insert({school_id:schoolId,course_offering_id:o.id,teacher_user_id:validTeacher}),'มอบหมายครูผู้สอนสำเร็จ')} className="mt-3 rounded-lg border px-3 py-2 text-xs text-blue-800 disabled:opacity-40">2. มอบหมายให้ครู: {name(validTeacher)}</button>
      </div>)}</div>
      {currentOfferings.length===0&&<p className="mt-4 text-sm text-slate-500">ยังไม่มีวิชาเปิดสอนสำหรับห้องและภาคเรียนที่เลือก</p>}{subjects.length===0&&<Link href="/curriculum" className="mt-4 inline-block text-sm text-blue-700">ยังไม่มีรายวิชา ไปตั้งค่าหลักสูตร →</Link>}
     </section>
    </div>
  </div>}
 </main>;
}