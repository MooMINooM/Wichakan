'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import AcademicDialog from '@/components/academic-dialog';
import {AcademicIcon} from '@/components/academic-visuals';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import {useTeacherWorkspace,teacherRoomLabel} from '@/lib/use-teacher-workspace';
import {teacherOverview,type CourseOverview} from '@/lib/teacher-overview';
const statusLabel={complete:'เสร็จแล้ว',progress:'กำลังดำเนินการ',empty:'ยังไม่เริ่ม',configuration:'รอตั้งคะแนนเต็ม','no-students':'ยังไม่มีนักเรียน'};
const scoreLink=(course:CourseOverview)=>'/teacher/scores?offering='+encodeURIComponent(course.offerings[0].id);
export default function TeacherPage(){
 const {data,loading,error,reload}=useTeacherWorkspace();
 const [yearId,setYearId]=useState(''),[termId,setTermId]=useState(''),[subjectId,setSubjectId]=useState(''),[rosterRoom,setRosterRoom]=useState('');
 useEffect(()=>{if(data.schoolId)setYearId(prev=>resolveYear(data.years,data.schoolId,prev));},[data.schoolId,data.years]);
 useEffect(()=>{if(!data.schoolId)return;const sync=(e:Event)=>{const d=(e as CustomEvent<{schoolId:string;yearId:string}>).detail;if(d?.schoolId===data.schoolId){setYearId(d.yearId);setTermId('');setSubjectId('');setRosterRoom('');}};window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);},[data.schoolId]);
 const yearTerms=data.terms.filter(t=>t.academic_year_id===yearId),validTerm=yearTerms.some(t=>t.id===termId)?termId:yearTerms[0]?.id??'';
 const allCourses=teacherOverview(data,yearId,validTerm),validSubject=allCourses.some(c=>c.subjectId===subjectId)?subjectId:'';
 const courses=validSubject?allCourses.filter(c=>c.subjectId===validSubject):allCourses;
 const homeRooms=data.rooms.filter(r=>r.academic_year_id===yearId&&data.homerooms.some(h=>h.classroom_id===r.id));
 const completed=courses.filter(c=>c.status==='complete').length,inProgress=courses.filter(c=>c.status==='progress').length;
 const studentCount=new Set(courses.flatMap(c=>c.studentIds)).size;
 const ready=!loading&&!error&&!!data.schoolId,contextReady=ready&&!!validTerm;
 const tasks=courses.filter(c=>c.status!=='complete').sort((a,b)=>(a.progress??-1)-(b.progress??-1));
 const homeRoster=(roomId:string)=>{const ids=new Set(data.enrollments.filter(e=>e.classroom_id===roomId&&e.academic_year_id===yearId).map(e=>e.student_id));return data.students.filter(s=>ids.has(s.id));};
 const roster=homeRoster(rosterRoom),selectedHome=data.rooms.find(r=>r.id===rosterRoom);
 return <main className="wichakan-page teacher-dashboard">
  <PageHeader title="แดชบอร์ดครู"/><div className="mb-4 flex flex-wrap gap-2"><Link href="/teacher/timetable" className="ui-primary">ดูตารางสอนของฉัน / ตารางเรียนประจำชั้น</Link></div>
  {error&&<p role="alert" className="teacher-error">{error}<button onClick={()=>void reload()}>ลองอีกครั้ง</button></p>}
  {loading&&<p role="status" className="mb-4 text-sm text-slate-500">กำลังโหลดงานสอน...</p>}
  <section className="ui-panel teacher-filters" aria-label="เลือกงานสอน">
   <label>ปีการศึกษา<select aria-label="ปีการศึกษา dashboard" disabled={!ready} value={yearId} onChange={e=>{setYearId(e.target.value);setTermId('');setSubjectId('');setYearSelection(data.schoolId,e.target.value);}}>{!data.years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <label>ภาคเรียน<select aria-label="ภาคเรียน dashboard" disabled={!ready} value={validTerm} onChange={e=>{setTermId(e.target.value);setSubjectId('');}}>{!yearTerms.length&&<option value="">ยังไม่มีภาคเรียน</option>}{yearTerms.map(t=><option key={t.id} value={t.id}>ภาคเรียนที่ {t.term_no}</option>)}</select></label>
   <label>รายวิชา<select aria-label="รายวิชา dashboard" disabled={!ready} value={validSubject} onChange={e=>setSubjectId(e.target.value)}><option value="">ทั้งหมด</option>{allCourses.map(c=><option key={c.subjectId} value={c.subjectId}>{c.code} {c.name}</option>)}</select></label>
   <button className="ui-secondary" disabled={loading} onClick={()=>void reload()}>อัปเดตข้อมูล</button>
  </section>
  {data.hiddenAssignments>0&&ready&&<p role="alert" className="teacher-warning">มีงานสอน {data.hiddenAssignments} รายการที่อ่านรายละเอียดไม่ได้ กรุณาแจ้งผู้ดูแลระบบ</p>}
  <section className="teacher-metrics" aria-label="สรุปงานสอน">
   <div className="teacher-metric blue"><i><AcademicIcon name="users"/></i><div><p>ห้องประจำชั้น</p><strong>{ready?(homeRooms.length?homeRooms.map(teacherRoomLabel).join(', '):'—'):'—'}</strong><span>{ready?homeRooms.length+' ห้อง':'รอข้อมูล'}</span></div></div>
   <div className="teacher-metric green"><i><AcademicIcon name="book"/></i><div><p>รายวิชาที่สอน</p><strong>{contextReady?courses.length:'—'}</strong><span>รายวิชา</span></div></div>
   <div className="teacher-metric purple"><i><AcademicIcon name="users"/></i><div><p>นักเรียนที่สอน</p><strong>{contextReady?studentCount:'—'}</strong><span>คน · ไม่นับซ้ำ</span></div></div>
   <div className="teacher-metric orange"><i><AcademicIcon name="check"/></i><div><p>วิชาที่ลงคะแนนเสร็จ</p><strong>{contextReady?completed:'—'}</strong><span>จาก {contextReady?courses.length:'—'} รายวิชา</span></div></div>
  </section>
  <div className="teacher-dashboard-grid">
   <div className="teacher-dashboard-main">
    <section className="ui-panel teacher-courses" id="courses" aria-labelledby="teacher-courses-heading">
     <div className="teacher-panel-heading"><h2 id="teacher-courses-heading"><AcademicIcon name="book"/>รายวิชาที่สอน</h2></div>
     <div className="teacher-table-scroll"><table className="teacher-course-table"><thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>ห้องเรียน</th><th>นักเรียน</th><th>ความคืบหน้าการลงคะแนน</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{contextReady&&courses.map(c=><tr key={c.subjectId}><td>{c.code}</td><th scope="row">{c.name}</th><td>{c.roomIds.map(id=>data.rooms.find(r=>r.id===id)).filter(r=>!!r).map(teacherRoomLabel).join(', ')}</td><td>{c.studentIds.length}</td><td><div className={'teacher-progress '+c.status}><progress max="100" value={c.progress??0} aria-label={'ความคืบหน้า '+c.name}/><span>{c.progress===null?'—':c.progress+'%'}</span></div></td><td><span className={'teacher-state '+c.status}>{statusLabel[c.status]}</span></td><td><Link className="ui-primary teacher-table-button" href={scoreLink(c)}>บันทึกคะแนน</Link></td></tr>)}</tbody></table></div>
     {!loading&&!error&&(!validTerm||!courses.length)&&<p className="teacher-empty">{!validTerm?'ยังไม่มีภาคเรียนในปีที่เลือก':'ยังไม่มีรายวิชาที่ได้รับมอบหมายในภาคเรียนนี้'}</p>}
    </section>
    <section className="ui-panel" id="homerooms" aria-labelledby="teacher-homerooms-heading"><div className="teacher-panel-heading"><h2 id="teacher-homerooms-heading"><AcademicIcon name="users"/>ห้องประจำชั้น</h2></div>
     {ready&&homeRooms.map(r=><div className="teacher-homeroom-card" key={r.id}><AcademicIcon name="users"/><div><h3>{teacherRoomLabel(r)}</h3><p>นักเรียน {homeRoster(r.id).length} คน</p><span>ปีการศึกษา {data.years.find(y=>y.id===yearId)?.year_be??'—'}</span></div><Link className="ui-secondary" href={'/teacher/pp6?room='+encodeURIComponent(r.id)}>ตรวจสอบ ปพ.6</Link><button className="ui-secondary" onClick={()=>setRosterRoom(r.id)}><AcademicIcon name="users"/>ดูรายชื่อนักเรียน</button></div>)}
     {ready&&!homeRooms.length&&<p className="teacher-empty">ไม่มีห้องประจำชั้นในปีที่เลือก</p>}
    </section>
   </div>
   <aside className="ui-panel teacher-overview" aria-label="ภาพรวมงานของครู"><div className="teacher-panel-heading"><h2><AcademicIcon name="chart"/>ภาพรวมงานของครู</h2></div>
    <div className="teacher-overview-progress"><span>ความคืบหน้าการลงคะแนน (รายวิชา)</span><strong>{contextReady?completed+'/'+courses.length:'—'}</strong><progress max="100" value={contextReady&&courses.length?completed/courses.length*100:0} aria-label="สัดส่วนวิชาที่ลงคะแนนเสร็จ"/><b>{contextReady&&courses.length?Math.floor(completed/courses.length*100)+'%':'—'}</b></div>
    <div className="teacher-overview-legend"><p><i className="complete"/>เสร็จแล้ว <span>{contextReady?completed:'—'} รายวิชา</span></p><p><i className="progress"/>กำลังดำเนินการ <span>{contextReady?inProgress:'—'} รายวิชา</span></p><p><i className="empty"/>ยังไม่ครบ / รอตั้งค่า <span>{contextReady?courses.length-completed-inProgress:'—'} รายวิชา</span></p></div>
    <h3 className="teacher-tasks-heading"><AcademicIcon name="file"/>งานที่ต้องดำเนินการ</h3>
    {contextReady&&tasks.map(c=><Link href={scoreLink(c)} className={'teacher-task '+c.status} key={c.subjectId}><i aria-hidden="true"/><div><strong>{c.name}</strong><p>{c.status==='configuration'?'รอ Admin ตั้งคะแนนเต็ม':c.status==='no-students'?'ยังไม่มีนักเรียนในห้อง':c.saved+'/'+c.expected+' รายการ · '+statusLabel[c.status]}</p></div><span aria-hidden="true">›</span></Link>)}
    {contextReady&&!tasks.length&&<p className="teacher-empty">{courses.length?'ลงคะแนนครบทุกวิชาแล้ว':'ยังไม่มีงานสอนในภาคเรียนนี้'}</p>}
   </aside>
  </div>
  {selectedHome&&<AcademicDialog title={'รายชื่อนักเรียน '+teacherRoomLabel(selectedHome)} onClose={()=>setRosterRoom('')}><p className="mb-3 text-sm text-slate-500">ปีการศึกษา {data.years.find(y=>y.id===yearId)?.year_be??'—'} · {roster.length} คน</p><div className="teacher-table-scroll"><table className="w-full text-left"><thead><tr><th>เลขที่</th><th>รหัส</th><th>ชื่อ–นามสกุล</th></tr></thead><tbody>{roster.map((s,i)=><tr key={s.id}><td>{i+1}</td><td>{s.student_no}</td><td>{s.name_prefix_th??''}{s.first_name_th} {s.last_name_th}</td></tr>)}</tbody></table></div>{!roster.length&&<p className="teacher-empty">ไม่มีนักเรียนลงทะเบียนในห้องนี้</p>}</AcademicDialog>}
 </main>;
}
