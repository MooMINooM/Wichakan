'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Room={id:string;level_code:string;room_code:string;academic_year_id:string};
type Student={id:string;student_no:string;name_prefix_th:string|null;first_name_th:string;last_name_th:string};
type Obs={student_id:string;indicator_code:string;result:'met'|'not_met';note:string};
type Topic={code:string;title:string};
const codes=['1.1.1','1.1.2','1.1.3','1.1.4','1.1.5','1.1.6','1.2.1','1.2.2','1.2.3','1.2.4'];
export default function SarStudentAssessment(){
 const db=getSupabaseBrowserClient();const [school,setSchool]=useState(''),[uid,setUid]=useState(''),[years,setYears]=useState<Year[]>([]),[year,setYear]=useState('');
 const [roomList,setRoomList]=useState<Room[]>([]),[room,setRoom]=useState(''),[students,setStudents]=useState<Student[]>([]);
 const [selected,setSelected]=useState(''),[topics,setTopics]=useState<Topic[]>([]),[obs,setObs]=useState<Obs[]>([]);
 const [answers,setAnswers]=useState<Record<string,'met'|'not_met'|''>>({}),[notes,setNotes]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ไม่พบฐานข้อมูล');const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบครู');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('active',true).in('role',['teacher','school_admin']).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('ไม่มีสิทธิ์เข้าระบบประเมิน');
  const sid=m.data.school_id as string;
  const [y,t]=await Promise.all([db.from('academic_years').select('id,year_be,is_active').eq('school_id',sid).order('year_be',{ascending:false}),
   db.from('sar_target_topics').select('code,title').in('code',codes)]);
  if(y.error||t.error)throw Error(y.error?.message||t.error?.message);
  if(!live)return;const ys=y.data as Year[];setSchool(sid);setUid(user.id);setYears(ys);setTopics(t.data as Topic[]);
  setYear(ys.find(y=>y.is_active)?.id??ys[0]?.id??'');
 }catch(e){if(live)setError(e instanceof Error?e.message:'ไม่สามารถเปิดหน้านี้ได้')}finally{if(live)setLoading(false)}})();return()=>{live=false};},[db]);
 useEffect(()=>{if(!db||!school||!year||!uid)return;let live=true;setError('');
  (async()=>{try{
   const [h,c]=await Promise.all([db.from('homeroom_assignments').select('classroom_id').eq('school_id',school).eq('teacher_user_id',uid),
    db.from('classrooms').select('id,level_code,room_code,academic_year_id').eq('school_id',school).eq('academic_year_id',year)]);
   if(h.error||c.error)throw Error(h.error?.message||c.error?.message);
   const mine=new Set((h.data??[]).map(x=>x.classroom_id));const rooms=(c.data as Room[]).filter(r=>mine.has(r.id));
   if(!live)return;setRoomList(rooms);setRoom(rooms[0]?.id??'');setSelected('');
  }catch(e){if(live)setError((e as Error).message)}})();return()=>{live=false};
 },[db,school,year,uid]);
 useEffect(()=>{if(!db||!school||!year||!room)return;let live=true;setLoading(true);setError('');setNotice('');
  (async()=>{try{
   const e=await db.from('enrollments').select('student_id').eq('school_id',school).eq('academic_year_id',year).eq('classroom_id',room).in('status',['active','completed']);
   if(e.error)throw e.error;
   const ids=[...new Set((e.data??[]).map(x=>x.student_id))];
   if(!ids.length){if(live){setStudents([]);setSelected('');setObs([]);}return;}
   const [s,o]=await Promise.all([db.from('students').select('id,student_no,name_prefix_th,first_name_th,last_name_th').eq('school_id',school).in('id',ids).order('student_no'),
    db.from('sar_student_observations').select('student_id,indicator_code,result,note').eq('school_id',school).eq('academic_year_id',year).in('student_id',ids)]);
   if(s.error||o.error)throw Error(s.error?.message||o.error?.message);
   if(!live)return;const list=s.data as Student[];setStudents(list);setObs(o.data as Obs[]);setSelected(list[0]?.id??'');
  }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดนักเรียนไม่ได้')}finally{if(live)setLoading(false)}})();
  return()=>{live=false};
 },[db,school,year,room]);
 useEffect(()=>{
  const mine=obs.filter(x=>x.student_id===selected);
  setAnswers(Object.fromEntries(mine.map(x=>[x.indicator_code,x.result])));setNotes(Object.fromEntries(mine.map(x=>[x.indicator_code,x.note])));
 },[selected,obs]);
 async function save(){
  if(!db||!year||!selected||busy)return;
  const rows=codes.filter(code=>answers[code]==='met'||answers[code]==='not_met').map(code=>({code,result:answers[code],note:notes[code]??''}));
  setBusy(true);setError('');setNotice('');
  try{
   const r=await db.rpc('sar_save_student_observations',{p_year:year,p_student:selected,p_answers:rows});
   if(r.error)throw Error(r.error.message);
   const refreshed=await db.from('sar_student_observations').select('student_id,indicator_code,result,note').eq('school_id',school).eq('academic_year_id',year).in('student_id',students.map(s=>s.id));
   if(refreshed.error)throw Error(refreshed.error.message);
   setObs(refreshed.data as Obs[]);setNotice('บันทึกผลประเมินผู้เรียนแล้ว');
  }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่ได้')}finally{setBusy(false)}
 }
 const name=(s:Student)=>[s.name_prefix_th,s.first_name_th,s.last_name_th].filter(Boolean).join(' ');
 const done=obs.filter(x=>x.student_id===selected).length;
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-12">
  <PageHeader title="ประเมินคุณภาพผู้เรียน — มาตรฐานที่ 1" context="ครูประจำชั้นบันทึกผลการประเมินรายบุคคลและเก็บเป็นข้อมูลเฉพาะผู้มีสิทธิ์"/>
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3">
   <label className="text-sm">ปีการศึกษา<select className="mt-1 block rounded-md border border-slate-300 bg-white p-2" value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <label className="text-sm">ห้องประจำชั้น<select className="mt-1 block rounded-md border border-slate-300 bg-white p-2" value={room} onChange={e=>setRoom(e.target.value)}>{roomList.map(r=><option key={r.id} value={r.id}>{r.level_code}/{r.room_code}</option>)}</select></label>
  </div><Link href="/teacher/sar" className="text-sm text-blue-700 underline">← กลับหน้าครู SAR</Link></div>
  {error&&<p role="alert" className="teacher-error mb-3">{error}</p>}{notice&&<p role="status" className="teacher-success mb-3">{notice}</p>}
  {!roomList.length&&!loading&&<p className="mb-4 text-sm text-slate-600">ยังไม่ได้รับมอบหมายห้องประจำชั้นในปีนี้</p>}
  {!!room&&<div className="grid gap-5 lg:grid-cols-[280px_1fr]">
   <nav className="max-h-[65vh] overflow-y-auto border-y border-slate-200" aria-label="รายชื่อนักเรียน">
    {students.map(s=><button type="button" key={s.id} className={'flex w-full items-center justify-between gap-2 border-b border-slate-100 p-3 text-left text-sm '+(selected===s.id?'bg-blue-50 text-blue-900':'hover:bg-slate-50')} onClick={()=>setSelected(s.id)}>
     <span>{name(s)}</span><span className="shrink-0 text-xs text-slate-500">{obs.filter(x=>x.student_id===s.id).length}/10</span>
    </button>)}
    {!students.length&&<p className="p-4 text-sm text-slate-500">ยังไม่มีนักเรียนในห้องนี้</p>}
   </nav>
   {selected&&<section>
    <h2 className="mb-2 text-lg font-semibold">{name(students.find(s=>s.id===selected)!)}</h2>
    <p className="mb-4 text-sm text-slate-600">ประเมินแล้ว {done}/10 ข้อ · ข้อที่ยังไม่ได้ประเมินจะไม่นับเป็นผ่านหรือไม่ผ่าน</p>
    <div className="divide-y divide-slate-100">{codes.map(code=>{
     const title=topics.find(t=>t.code===code)?.title??code;
     return <div className="py-4" key={code}>
      <p className="mb-2 text-sm font-semibold">{code} {title}</p>
      <div className="flex flex-wrap gap-4 text-sm">{([['met','ผ่านเกณฑ์'],['not_met','ยังไม่ผ่านเกณฑ์']] as const).map(([v,label])=><label key={v} className="flex items-center gap-2"><input type="radio" name={'sar-'+code} checked={answers[code]===v} onChange={()=>setAnswers(old=>({...old,[code]:v}))}/>{label}</label>)}</div>
      <input maxLength={1000} className="mt-2 w-full rounded-md border border-slate-300 bg-white p-2 text-sm" placeholder="หมายเหตุ / หลักฐานประกอบ (ถ้ามี)" value={notes[code]??''} onChange={e=>setNotes(old=>({...old,[code]:e.target.value}))}/>
     </div>;
    })}</div>
    <button type="button" className="ui-primary mt-4" disabled={busy||loading} onClick={()=>void save()}>{busy?'กำลังบันทึก...':'บันทึกผลประเมิน'}</button>
   </section>}
  </div>}
  <p className="mt-5 text-xs text-slate-500">รายการนี้เป็นแบบสรุปการประเมินหลัก 10 ประเด็น ต้องตรวจสอบกับเครื่องมือและหลักฐานจริงก่อนนำไปสรุปคุณภาพระดับโรงเรียน โดยเฉพาะข้อมูลสุขภาวะที่ควรจำกัดการเปิดเผย</p>
 </main>;
}
