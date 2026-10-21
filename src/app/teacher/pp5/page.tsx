'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {useTeacherWorkspace,offeringRoster,teacherRoomLabel} from '@/lib/use-teacher-workspace';
import {useCourseContext} from '@/lib/use-course-context';
import {orderStudents,pp5Readiness,type CourseAssessment,type Attendance,type Target} from '@/lib/pp5';
import type {Pp5Book} from '@/lib/pp5-pdf';
export default function TeacherPp5Page(){
 const {data,loading,error,reload}=useTeacherWorkspace(),c=useCourseContext(data,loading);
 const [book,setBook]=useState<Pp5Book|null>(null),[fetching,setFetching]=useState(false),[localError,setError]=useState(''),[pdfUrl,setPdfUrl]=useState(''),[generating,setGenerating]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setBook(null);setError('');setFetching(false);if(!c.selected||!c.initialized)return;setFetching(true);
 (async()=>{try{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อฐานข้อมูล');const o=c.selected!;
  async function all<T>(query:(from:number,to:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>){const rows:T[]=[];for(let i=0;;i+=500){const r=await query(i,i+499);if(r.error)throw r.error;rows.push(...((r.data??[]) as T[]));if((r.data?.length??0)<500)break;}return rows as T[];}
  const [auth,school,subject,term,homes,targets,attendance,assessments]=await Promise.all([
   db.auth.getUser(),db.from('schools').select('name_th').eq('id',data.schoolId).limit(1),
   db.from('subjects').select('learning_hours,hour_basis').eq('school_id',data.schoolId).eq('id',o.subject_id).limit(1),
   db.from('terms').select('starts_on,ends_on').eq('school_id',data.schoolId).eq('id',o.term_id).limit(1),
   db.from('homeroom_assignments').select('teacher_user_id').eq('school_id',data.schoolId).eq('classroom_id',o.classroom_id),
   all<Target>((a,b)=>db.from('subject_learning_targets').select('id,target_type,standard_code,target_code,target_description,indicator_phase,display_order').eq('school_id',data.schoolId).eq('subject_id',o.subject_id).order('display_order').order('id').range(a,b)),
   all<Attendance>((a,b)=>db.from('effective_course_attendance').select('student_id,class_date,session_no,attendance_status').eq('school_id',data.schoolId).eq('course_offering_id',o.id).order('class_date').order('session_no').order('student_id').range(a,b)),
   all<CourseAssessment>((a,b)=>db.from('course_student_assessments').select('student_id,trait_scores,reading_scores').eq('school_id',data.schoolId).eq('course_offering_id',o.id).order('student_id').range(a,b))
  ]);
  for(const r of [school,subject,term,homes])if(r.error)throw r.error;if(auth.error)throw auth.error;if(!auth.data.user)throw Error('กรุณาเข้าสู่ระบบอีกครั้ง');
  const ids=[...new Set([auth.data.user.id,...(homes.data??[]).map(h=>h.teacher_user_id)])];
  const profiles=await db.from('profiles').select('user_id,display_name').in('user_id',ids);if(profiles.error)throw profiles.error;
  const teacher=profiles.data?.find(p=>p.user_id===auth.data.user!.id)?.display_name?.trim();if(!teacher||!school.data?.[0]?.name_th)throw Error('ข้อมูลชื่อครูผู้สอนหรือโรงเรียนไม่ครบ');
  const hours=subject.data?.[0]?.learning_hours??0,basis=subject.data?.[0]?.hour_basis??'';
  const expected=hours>0&&['year','term'].includes(basis)?Math.ceil(hours/(basis==='year'?2:1)):0;
  if(live)setBook({data,offering:o,roster:orderStudents(offeringRoster(data,o)),attendance:attendance.filter(a=>(!term.data?.[0]?.starts_on||a.class_date>=term.data[0].starts_on)&&(!term.data?.[0]?.ends_on||a.class_date<=term.data[0].ends_on)),assessments,targets,expected,schoolName:school.data![0].name_th,teacherName:teacher,homeroomNames:(homes.data??[]).map(h=>profiles.data?.find(p=>p.user_id===h.teacher_user_id)?.display_name??'ไม่พบชื่อครู'),learningHours:hours,hourBasis:basis,termStart:term.data?.[0]?.starts_on??null});
 }catch(e){if(live)setError((e as {message:string}).message);}finally{if(live)setFetching(false);}})();return()=>{live=false;};},[data,c.selected?.id,c.initialized]);
 const currentBook=book?.offering.id===c.selected?.id?book:null;
 const readiness=useMemo(()=>currentBook?pp5Readiness(currentBook.data,currentBook.offering,currentBook.roster,currentBook.attendance,currentBook.assessments,currentBook.expected):null,[currentBook]);
 useEffect(()=>{let live=true,url='';setPdfUrl('');setGenerating(false);if(!book||!readiness?.ready||error||c.linkError)return;setGenerating(true);
 (async()=>{try{const {createPp5Pdf}=await import('@/lib/pp5-pdf');const bytes=await createPp5Pdf(book);if(!live)return;url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));setPdfUrl(url);}catch(e){if(live)setError((e as {message:string}).message);}finally{if(live)setGenerating(false);}})();return()=>{live=false;if(url)URL.revokeObjectURL(url);};},[book,readiness,error,c.linkError,attempt]);
 const subject=data.subjects.find(s=>s.id===c.selected?.subject_id);
 const link=(path:string)=>path+'?offering='+encodeURIComponent(c.selected?.id??'');
 return <main className="wichakan-page pp5-page"><PageHeader title="ปพ.5 รายวิชา"/>
 <section className="ui-panel mb-4 flex flex-wrap items-end gap-3"><label>ปีการศึกษา<select aria-label="ปีการศึกษา" className="block border p-2" value={c.yearId} disabled={loading} onChange={e=>c.chooseYear(e.target.value)}>{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label><label className="min-w-0 flex-1">รายวิชา / ห้อง / ภาคเรียน<select aria-label="รายวิชา" className="block w-full min-w-0 border p-2" value={c.selected?.id??''} disabled={loading} onChange={e=>c.chooseOffering(e.target.value)}>{c.available.map(o=><option key={o.id} value={o.id}>{data.subjects.find(s=>s.id===o.subject_id)?.name_th} · {teacherRoomLabel(data.rooms.find(r=>r.id===o.classroom_id)!)} · ภาค {data.terms.find(t=>t.id===o.term_id)?.term_no}</option>)}</select></label><Link className="ui-secondary" href="/teacher#courses">รายวิชาที่สอน</Link></section>
 {(error||localError||c.linkError)&&<p role="alert" className="teacher-error">{error||localError||c.linkError}<button onClick={()=>{setError('');setAttempt(a=>a+1);void reload();}}>ลองอีกครั้ง</button></p>}
 {(loading||fetching||generating)&&<p role="status">{generating?'กำลังสร้าง PDF พร้อมพิมพ์...':'กำลังตรวจสอบข้อมูลรายวิชา...'}</p>}
 {!loading&&!c.selected&&!c.linkError&&<p className="ui-panel">ไม่มีรายวิชาที่ได้รับมอบหมาย</p>}
 {readiness&&!readiness.ready&&<section className="ui-panel" aria-label="ความพร้อม ปพ.5"><h2>บันทึกข้อมูลให้ครบก่อนออก ปพ.5</h2><ul className="my-4 space-y-3"><li>คะแนน: {readiness.scoreMissing?'ยังไม่ครบ '+readiness.scoreMissing+' คน':'ครบแล้ว'} · <Link href={link('/teacher/scores')} className="text-blue-700 underline">บันทึกคะแนน</Link></li><li>เวลาเรียน: {readiness.sessions}/{readiness.expected||'ยังไม่กำหนด'} คาบ {readiness.missingCells?'· ขาดสถานะ '+readiness.missingCells+' ช่อง':''} · <Link href={link('/teacher/attendance')} className="text-blue-700 underline">บันทึกเวลาเรียน</Link></li><li>คุณลักษณะฯ: {readiness.traitsMissing?'ยังไม่ครบ '+readiness.traitsMissing+' คน':'ครบแล้ว'} · <Link href={link('/teacher/assessments')+'&group=traits'} className="text-blue-700 underline">บันทึกคุณลักษณะฯ</Link></li><li>อ่านคิดเขียน: {readiness.readingMissing?'ยังไม่ครบ '+readiness.readingMissing+' คน':'ครบแล้ว'} · <Link href={link('/teacher/assessments')+'&group=reading'} className="text-blue-700 underline">บันทึกอ่านคิดเขียน</Link></li></ul><p className="text-sm text-slate-500">เวลาเรียนต้องครบตามชั่วโมงรายวิชา และทุกคาบที่บันทึกต้องมีสถานะนักเรียนครบทุกคน</p><button className="ui-primary mt-4" disabled>สร้าง PDF ปพ.5</button></section>}
 {pdfUrl&&readiness?.ready&&!loading&&!fetching&&!error&&<section aria-label="PDF ปพ.5"><div className="mb-3 flex flex-wrap gap-3"><a className="ui-primary" href={pdfUrl} download={'PP5-'+subject?.subject_code+'.pdf'}>ดาวน์โหลด PDF</a><a className="ui-secondary" href={pdfUrl} target="_blank" rel="noreferrer">เปิด PDF เพื่อพิมพ์</a></div><iframe title="PDF ปพ.5 พร้อมพิมพ์" src={pdfUrl} className="h-[80vh] w-full border border-slate-200"/></section>}
 </main>;
}
