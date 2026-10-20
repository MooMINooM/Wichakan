'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import TeacherRecordTabs from '@/components/teacher-record-tabs';
import TeacherScoreGrid from '@/components/teacher-score-grid';
import {scoreMode} from '@/lib/teacher-scores';
import {resolveYear,setYearSelection} from '@/lib/academic-year-selection';
import {useTeacherWorkspace,teacherRoomLabel,offeringRoster} from '@/lib/use-teacher-workspace';
export default function TeacherScoresPage(){
 const {data,loading,error,reload,recordSaved}=useTeacherWorkspace();
 const [yearId,setYearId]=useState(''),[subjectId,setSubjectId]=useState(''),[roomId,setRoomId]=useState(''),[termId,setTermId]=useState('');
 const [initialized,setInitialized]=useState(false),[linkError,setLinkError]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(loading||error||initialized||!data.schoolId)return;
  const requested=new URLSearchParams(window.location.search).get('offering'),offering=data.offerings.find(o=>o.id===requested);
  if(requested&&!offering)setLinkError('ไม่ได้รับมอบหมายรายวิชาที่เปิดจากลิงก์นี้ กรุณาเลือกรายวิชาที่มีสิทธิ์');
  const room=data.rooms.find(r=>r.id===offering?.classroom_id);
  setYearId(room?.academic_year_id??resolveYear(data.years,data.schoolId));setSubjectId(offering?.subject_id??'');setRoomId(offering?.classroom_id??'');setTermId(offering?.term_id??'');setInitialized(true);
 },[data,loading,error,initialized]);
 useEffect(()=>{
  function unload(e:BeforeUnloadEvent){if(dirty||busy){e.preventDefault();e.returnValue='';}}
  function navigate(e:MouseEvent){const target=e.target as Element,anchor=target.closest?.('a');if(!anchor||e.defaultPrevented||anchor.target==='_blank'||anchor.hasAttribute('download'))return;const href=anchor.getAttribute('href');if(!href||href.startsWith('#'))return;if(busy||(dirty&&!window.confirm('มีคะแนนที่ยังไม่บันทึก ยืนยันออกจากหน้านี้?'))){e.preventDefault();e.stopPropagation();}}
  function beforeLeave(e:Event){if(busy||(dirty&&!window.confirm('มีคะแนนที่ยังไม่บันทึก ยืนยันออกจากหน้านี้?')))e.preventDefault();}
  window.addEventListener('wichakan:before-leave',beforeLeave);
  window.addEventListener('beforeunload',unload);document.addEventListener('click',navigate,true);return()=>{window.removeEventListener('wichakan:before-leave',beforeLeave);window.removeEventListener('beforeunload',unload);document.removeEventListener('click',navigate,true);};
 },[dirty,busy]);
 const validYear=data.years.some(y=>y.id===yearId)?yearId:data.years[0]?.id??'';
 const yearOfferings=data.offerings.filter(o=>data.rooms.some(r=>r.id===o.classroom_id&&r.academic_year_id===validYear));
 const availableSubjects=data.subjects.filter(s=>yearOfferings.some(o=>o.subject_id===s.id));
 const validSubject=availableSubjects.some(s=>s.id===subjectId)?subjectId:availableSubjects[0]?.id??'';
 const subjectOfferings=yearOfferings.filter(o=>o.subject_id===validSubject);
 const rooms=data.rooms.filter(r=>subjectOfferings.some(o=>o.classroom_id===r.id));
 const validRoom=rooms.some(r=>r.id===roomId)?roomId:rooms[0]?.id??'';
 const roomOfferings=subjectOfferings.filter(o=>o.classroom_id===validRoom);
 const terms=data.terms.filter(t=>roomOfferings.some(o=>o.term_id===t.id));
 const validTerm=terms.some(t=>t.id===termId)?termId:terms[0]?.id??'';
 const selected=roomOfferings.find(o=>o.term_id===validTerm);
 const setting=data.settings.find(s=>s.subject_id===validSubject&&s.academic_year_id===validYear),students=selected?offeringRoster(data,selected):[];
 const ready=!loading&&!error&&initialized;
 function change(fn:()=>void){if(busy)return;if(dirty&&!window.confirm('มีคะแนนที่ยังไม่บันทึก ยืนยันเปลี่ยนรายวิชา?'))return;setDirty(false);setLinkError('');fn();}
 return <main className="wichakan-page teacher-score-page">
  <PageHeader title="บันทึกข้อมูลรายวิชา"/><TeacherRecordTabs offeringId={selected?.id} active="scores"/>
  {error&&<p role="alert" className="teacher-error">{error}<button onClick={()=>void reload()}>ลองอีกครั้ง</button></p>}
  {linkError&&<p role="alert" className="teacher-warning">{linkError}<button className="ml-3 underline" disabled={!ready||busy||!selected} onClick={()=>setLinkError('')}>เปิดรายวิชาของฉัน</button></p>}
  <section className="ui-panel score-selection" aria-label="เลือกรายวิชาบันทึกคะแนน">
   <label>ปีการศึกษา<select aria-label="ปีการศึกษาคะแนน" disabled={!ready||busy} value={validYear} onChange={e=>change(()=>{setYearId(e.target.value);setSubjectId('');setRoomId('');setTermId('');setYearSelection(data.schoolId,e.target.value);})}>{!data.years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <label>รายวิชา<select aria-label="รายวิชาคะแนน" disabled={!ready||busy} value={validSubject} onChange={e=>change(()=>{setSubjectId(e.target.value);setRoomId('');setTermId('');})}>{!availableSubjects.length&&<option value="">ยังไม่มีงานสอน</option>}{availableSubjects.map(s=><option key={s.id} value={s.id}>{s.subject_code} {s.name_th}</option>)}</select></label>
   <label>ห้องเรียน<select aria-label="ห้องเรียนคะแนน" disabled={!ready||busy} value={validRoom} onChange={e=>change(()=>{setRoomId(e.target.value);setTermId('');})}>{!rooms.length&&<option value="">ยังไม่มีห้องเรียน</option>}{rooms.map(r=><option key={r.id} value={r.id}>{teacherRoomLabel(r)}</option>)}</select></label>
   <label>ภาคเรียนที่เปิดสอน<select aria-label="ภาคเรียนที่เปิดสอนคะแนน" disabled={!ready||busy} value={validTerm} onChange={e=>change(()=>setTermId(e.target.value))}>{!terms.length&&<option value="">ยังไม่มีภาคเรียน</option>}{terms.map(t=><option key={t.id} value={t.id}>ภาคเรียนที่ {t.term_no}</option>)}</select></label>
   <Link className="ui-secondary" href="/teacher#courses">← กลับหน้ารายวิชาที่สอน</Link>
  </section>
  {loading&&<p role="status" className="teacher-empty">กำลังโหลดรายวิชาและคะแนน...</p>}
  {ready&&!linkError&&selected&&<TeacherScoreGrid key={selected.id} offeringId={selected.id} students={students} records={data.scores} setting={setting} mode={scoreMode(data.subjects.find(s=>s.id===validSubject)?.grade_level)} termNo={data.terms.find(t=>t.id===validTerm)?.term_no??1} onDirty={setDirty} onBusy={setBusy} onSaved={recordSaved}/>}
  {ready&&!selected&&<p className="ui-panel teacher-empty">ไม่มีรายวิชาที่ได้รับมอบหมายในปีที่เลือก</p>}
 </main>;
}
