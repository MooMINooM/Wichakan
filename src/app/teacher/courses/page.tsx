'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import {AcademicIcon} from '@/components/academic-visuals';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import {useTeacherWorkspace,teacherRoomLabel} from '@/lib/use-teacher-workspace';
import {teacherOverview} from '@/lib/teacher-overview';
const statusLabel={complete:'เสร็จแล้ว',progress:'กำลังดำเนินการ',empty:'ยังไม่เริ่ม',configuration:'รอตั้งคะแนนเต็ม','no-students':'ยังไม่มีนักเรียน'};
export default function TeacherCoursesPage(){
 const {data,loading,error,reload}=useTeacherWorkspace();
 const [yearId,setYearId]=useState(''),[termId,setTermId]=useState(''),[subjectId,setSubjectId]=useState('');
 useEffect(()=>{if(data.schoolId)setYearId(prev=>resolveYear(data.years,data.schoolId,prev));},[data.schoolId,data.years]);
 useEffect(()=>{if(!data.schoolId)return;const sync=(e:Event)=>{const d=(e as CustomEvent<{schoolId:string;yearId:string}>).detail;if(d?.schoolId===data.schoolId){setYearId(d.yearId);setTermId('');setSubjectId('');}};window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);},[data.schoolId]);
 const yearTerms=data.terms.filter(t=>t.academic_year_id===yearId),validTerm=yearTerms.some(t=>t.id===termId)?termId:yearTerms[0]?.id??'';
 const allCourses=teacherOverview(data,yearId,validTerm),validSubject=allCourses.some(c=>c.subjectId===subjectId)?subjectId:'';
 const courses=validSubject?allCourses.filter(c=>c.subjectId===validSubject):allCourses;
 const ready=!loading&&!error&&!!data.schoolId,contextReady=ready&&!!validTerm;
 return <main className="wichakan-page teacher-dashboard teacher-courses-page">
  <PageHeader title="รายวิชาที่สอน" context="เลือกรายวิชาเพื่อบันทึกผลการเรียนและจัดทำ ปพ.5"/>
  {error&&<p role="alert" className="teacher-error">{error}<button onClick={()=>void reload()}>ลองอีกครั้ง</button></p>}
  {loading&&<p role="status" className="mb-4 text-sm text-slate-500">กำลังโหลดรายวิชาที่สอน...</p>}
  <section className="ui-panel teacher-filters" aria-label="เลือกงานสอน">
   <label>ปีการศึกษา<select aria-label="ปีการศึกษารายวิชา" disabled={!ready} value={yearId} onChange={e=>{setYearId(e.target.value);setTermId('');setSubjectId('');setYearSelection(data.schoolId,e.target.value);}}>{!data.years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <label>ภาคเรียน<select aria-label="ภาคเรียนรายวิชา" disabled={!ready} value={validTerm} onChange={e=>{setTermId(e.target.value);setSubjectId('');}}>{!yearTerms.length&&<option value="">ยังไม่มีภาคเรียน</option>}{yearTerms.map(t=><option key={t.id} value={t.id}>ภาคเรียนที่ {t.term_no}</option>)}</select></label>
   <label>รายวิชา<select aria-label="กรองรายวิชาที่สอน" disabled={!ready} value={validSubject} onChange={e=>setSubjectId(e.target.value)}><option value="">ทั้งหมด</option>{allCourses.map(c=><option key={c.subjectId} value={c.subjectId}>{c.code} {c.name}</option>)}</select></label>
   <div className="teacher-filter-actions flex flex-wrap items-center justify-end gap-2"><button className="ui-secondary" disabled={loading} onClick={()=>void reload()}>อัปเดตข้อมูล</button><Link href="/teacher/timetable" className="ui-primary inline-flex items-center justify-center gap-2 whitespace-nowrap"><AcademicIcon name="calendar"/>ดูตารางสอน / ตารางเรียน</Link></div>
  </section>
  {data.hiddenAssignments>0&&ready&&<p role="alert" className="teacher-warning">มีงานสอน {data.hiddenAssignments} รายการที่อ่านรายละเอียดไม่ได้ กรุณาแจ้งผู้ดูแลระบบ</p>}
    <section className="ui-panel teacher-courses" id="courses" aria-labelledby="teacher-courses-heading">
     <div className="teacher-panel-heading"><h2 id="teacher-courses-heading"><AcademicIcon name="book"/>รายวิชาที่สอน</h2></div>
     <div className="teacher-table-scroll"><table className="teacher-course-table"><thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ห้องเรียน</th><th>นักเรียน</th><th>ความคืบหน้าการลงคะแนน</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{contextReady&&courses.map(c=><tr key={c.subjectId}><td>{c.code}</td><th scope="row">{c.name}</th><td>{c.roomIds.map(id=>data.rooms.find(r=>r.id===id)).filter(r=>!!r).map(teacherRoomLabel).join(', ')}</td><td>{c.studentIds.length}</td><td><div className={'teacher-progress '+c.status}><progress max="100" value={c.progress??0} aria-label={'ความคืบหน้า '+c.name}/><span>{c.progress===null?'—':c.progress+'%'}</span></div>{c.configured&&c.expected>0&&<small className="block text-xs text-slate-500">กรอกครบ {c.saved}/{c.expected} คน · ภาคเรียนที่ {data.terms.find(t=>t.id===validTerm)?.term_no}</small>}</td><td><span className={'teacher-state '+c.status}>{statusLabel[c.status]}</span></td><td><div className="course-actions">{c.offerings.map(o=><div key={o.id} className="course-action-row">{c.offerings.length>1&&<span>{teacherRoomLabel(data.rooms.find(r=>r.id===o.classroom_id)!)}</span>}<Link className="ui-primary teacher-table-button" href={'/teacher/scores?offering='+encodeURIComponent(o.id)}>บันทึก</Link><Link className="ui-secondary teacher-table-button" href={'/teacher/pp5?offering='+encodeURIComponent(o.id)}>ปพ.5</Link></div>)}</div></td></tr>)}</tbody></table></div>
     {!loading&&!error&&(!validTerm||!courses.length)&&<p className="teacher-empty">{!validTerm?'ยังไม่มีภาคเรียนในปีที่เลือก':'ยังไม่มีรายวิชาที่ได้รับมอบหมายในภาคเรียนนี้'}</p>}
    </section>
 </main>;
}
