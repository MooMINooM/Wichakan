'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import PageHeader from '@/components/page-header';
import AcademicDialog from '@/components/academic-dialog';
import {AcademicIcon} from '@/components/academic-visuals';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import {useTeacherWorkspace,teacherRoomLabel} from '@/lib/use-teacher-workspace';
import {teacherOverview} from '@/lib/teacher-overview';
export default function TeacherPage(){
 const {data,loading,error,reload}=useTeacherWorkspace();
 const [periodTarget,setPeriodTarget]=useState<HTMLElement|null>(null);
 useEffect(()=>{setPeriodTarget(document.getElementById('teacher-dashboard-period'));},[]);
 const [yearId,setYearId]=useState(''),[termId,setTermId]=useState(''),[rosterRoom,setRosterRoom]=useState('');
 useEffect(()=>{if(data.schoolId)setYearId(prev=>resolveYear(data.years,data.schoolId,prev));},[data.schoolId,data.years]);
 useEffect(()=>{if(!data.schoolId)return;const sync=(e:Event)=>{const d=(e as CustomEvent<{schoolId:string;yearId:string}>).detail;if(d?.schoolId===data.schoolId){setYearId(d.yearId);setTermId('');setRosterRoom('');}};window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);},[data.schoolId]);
 const yearTerms=data.terms.filter(t=>t.academic_year_id===yearId),validTerm=yearTerms.some(t=>t.id===termId)?termId:yearTerms[0]?.id??'';
 const courses=teacherOverview(data,yearId,validTerm);
 const homeRooms=data.rooms.filter(r=>r.academic_year_id===yearId&&data.homerooms.some(h=>h.classroom_id===r.id));
 const completed=courses.filter(c=>c.status==='complete').length,inProgress=courses.filter(c=>c.status==='progress').length;
 const studentCount=new Set(courses.flatMap(c=>c.studentIds)).size;
 const ready=!loading&&!error&&!!data.schoolId,contextReady=ready&&!!validTerm;
 const homeRoster=(roomId:string)=>{const ids=new Set(data.enrollments.filter(e=>e.classroom_id===roomId&&e.academic_year_id===yearId).map(e=>e.student_id));return data.students.filter(s=>ids.has(s.id));};
 const roster=homeRoster(rosterRoom),selectedHome=data.rooms.find(r=>r.id===rosterRoom);
 return <main className="wichakan-page teacher-dashboard">
  {periodTarget&&createPortal(<>
   <label>ปีการศึกษา<select aria-label="ปีการศึกษา dashboard" disabled={!ready} value={yearId} onChange={e=>{setYearId(e.target.value);setTermId('');setYearSelection(data.schoolId,e.target.value);}}>{!data.years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <label>ภาคเรียน<select aria-label="ภาคเรียน dashboard" disabled={!ready} value={validTerm} onChange={e=>{setTermId(e.target.value);}}>{!yearTerms.length&&<option value="">ยังไม่มีภาคเรียน</option>}{yearTerms.map(t=><option key={t.id} value={t.id}>ภาคเรียนที่ {t.term_no}</option>)}</select></label>
  </>,periodTarget)}
  <PageHeader title="แดชบอร์ดครู"/>
  {error&&<p role="alert" className="teacher-error">{error}<button onClick={()=>void reload()}>ลองอีกครั้ง</button></p>}
  {loading&&<p role="status" className="mb-4 text-sm text-slate-500">กำลังโหลดงานสอน...</p>}
  <section className="ui-panel teacher-dashboard-actions" aria-label="เครื่องมืองานสอน">


   <div className="teacher-filter-actions flex flex-wrap items-center justify-end gap-2"><button className="ui-secondary" disabled={loading} onClick={()=>void reload()}>อัปเดตข้อมูล</button><Link href="/teacher/timetable" className="ui-primary inline-flex items-center justify-center gap-2 whitespace-nowrap"><AcademicIcon name="calendar"/>ดูตารางสอน / ตารางเรียน</Link></div>
  </section>
  {data.hiddenAssignments>0&&ready&&<p role="alert" className="teacher-warning">มีงานสอน {data.hiddenAssignments} รายการที่อ่านรายละเอียดไม่ได้ กรุณาแจ้งผู้ดูแลระบบ</p>}
  <section className="teacher-launch-section" aria-labelledby="teacher-record-heading">
   <h2 id="teacher-record-heading"><AcademicIcon name="edit"/>บันทึกผลการเรียน</h2>
   <div className="teacher-launch-grid">{([
    {href:'/teacher/scores',title:'บันทึกคะแนน',detail:'คะแนนเก็บ กลางภาค และปลายภาค',icon:'chart',color:'green'},
    {href:'/teacher/attendance',title:'บันทึกเวลาเรียน',detail:'การมาเรียนและเวลาเรียนรายคาบ',icon:'calendar',color:'blue'},
    {href:'/teacher/assessments?group=traits',title:'คุณลักษณะอันพึงประสงค์',detail:'บันทึกผลการประเมินรายวิชา',icon:'check',color:'pink'},
    {href:'/teacher/assessments?group=reading',title:'อ่าน คิดวิเคราะห์ และเขียน',detail:'บันทึกผลการประเมินรายวิชา',icon:'book',color:'purple'},
   ] as const).map(item=><Link href={item.href} key={item.href} className={'teacher-launch-card '+item.color}><i><AcademicIcon name={item.icon}/></i><div><h3>{item.title}</h3><p>{item.detail}</p></div><span aria-hidden="true">›</span></Link>)}</div>
  </section>
  <section className="teacher-launch-section" aria-labelledby="teacher-documents-heading">
   <h2 id="teacher-documents-heading"><AcademicIcon name="file"/>เอกสารและงานประจำชั้น</h2>
   <div className="teacher-launch-grid">{([
    {href:'/teacher/courses',title:'รายวิชาที่สอน / ปพ.5',detail:'ตรวจสอบและพิมพ์บันทึกผลการเรียน',icon:'book',color:'green'},
    {href:'/teacher/pp6',title:'ปพ.6 และห้องประจำชั้น',detail:'รายงานผลการพัฒนาผู้เรียนรายบุคคล',icon:'file',color:'blue'},
    {href:'/teacher/activities',title:'กิจกรรมพัฒนาผู้เรียน',detail:'บันทึกกิจกรรมตามงานที่ได้รับมอบหมาย',icon:'check',color:'purple'},
    {href:'/teacher/timetable',title:'ตารางสอน / ตารางเรียน',detail:'ตารางของฉันและห้องประจำชั้น',icon:'calendar',color:'gold'},
   ] as const).map(item=><Link href={item.href} key={item.href} className={'teacher-launch-card '+item.color}><i><AcademicIcon name={item.icon}/></i><div><h3>{item.title}</h3><p>{item.detail}</p></div><span aria-hidden="true">›</span></Link>)}</div>
  </section>
  <section className="teacher-metrics" aria-label="สรุปงานสอน">
   <div className="teacher-metric blue"><i><AcademicIcon name="users"/></i><div><p>ห้องประจำชั้น</p><strong>{ready?(homeRooms.length?homeRooms.map(teacherRoomLabel).join(', '):'—'):'—'}</strong><span>{ready?homeRooms.length+' ห้อง':'รอข้อมูล'}</span></div></div>
   <div className="teacher-metric green"><i><AcademicIcon name="book"/></i><div><p>รายวิชาที่สอน</p><strong>{contextReady?courses.length:'—'}</strong><span>รายวิชา</span></div></div>
   <div className="teacher-metric purple"><i><AcademicIcon name="users"/></i><div><p>นักเรียนที่สอน</p><strong>{contextReady?studentCount:'—'}</strong><span>คน · ไม่นับซ้ำ</span></div></div>
   <div className="teacher-metric orange"><i><AcademicIcon name="check"/></i><div><p>วิชาที่ลงคะแนนเสร็จ</p><strong>{contextReady?completed:'—'}</strong><span>จาก {contextReady?courses.length:'—'} รายวิชา</span></div></div>
  </section>
  <div className="teacher-dashboard-grid">
   <aside className="ui-panel teacher-overview" aria-label="ภาพรวมงานของครู"><div className="teacher-panel-heading"><h2><AcademicIcon name="chart"/>ภาพรวมงานของครู</h2></div>
    <div className="teacher-overview-progress"><span>ความคืบหน้าการลงคะแนน (รายวิชา)</span><strong>{contextReady?completed+'/'+courses.length:'—'}</strong><progress max="100" value={contextReady&&courses.length?completed/courses.length*100:0} aria-label="สัดส่วนวิชาที่ลงคะแนนเสร็จ"/><b>{contextReady&&courses.length?Math.floor(completed/courses.length*100)+'%':'—'}</b></div>
    <div className="teacher-overview-legend"><p><i className="complete"/>เสร็จแล้ว <span>{contextReady?completed:'—'} รายวิชา</span></p><p><i className="progress"/>กำลังดำเนินการ <span>{contextReady?inProgress:'—'} รายวิชา</span></p><p><i className="empty"/>ยังไม่ครบ / รอตั้งค่า <span>{contextReady?courses.length-completed-inProgress:'—'} รายวิชา</span></p></div>
    <section id="homerooms" aria-labelledby="teacher-homerooms-heading" className="mt-5 border-t border-slate-200 pt-4">
     <div className="teacher-panel-heading"><h2 id="teacher-homerooms-heading"><AcademicIcon name="users"/>ห้องประจำชั้น</h2></div>
     {ready&&homeRooms.map(r=><div className="teacher-homeroom-card" key={r.id}><AcademicIcon name="users"/><div><h3>{teacherRoomLabel(r)}</h3><p>นักเรียน {homeRoster(r.id).length} คน</p><span>ปีการศึกษา {data.years.find(y=>y.id===yearId)?.year_be??'—'}</span></div><Link className="ui-secondary" href={'/teacher/pp6?room='+encodeURIComponent(r.id)}>ตรวจสอบ ปพ.6</Link><button type="button" className="ui-secondary" onClick={()=>setRosterRoom(r.id)}><AcademicIcon name="users"/>ดูรายชื่อนักเรียน</button></div>)}
     {ready&&!homeRooms.length&&<p className="teacher-empty">ไม่มีห้องประจำชั้นในปีที่เลือก</p>}
    </section>
   </aside>
  </div>
  {selectedHome&&<AcademicDialog title={'รายชื่อนักเรียน '+teacherRoomLabel(selectedHome)} onClose={()=>setRosterRoom('')}><p className="mb-3 text-sm text-slate-500">ปีการศึกษา {data.years.find(y=>y.id===yearId)?.year_be??'—'} · {roster.length} คน</p><div className="teacher-table-scroll"><table className="w-full text-left"><thead><tr><th>เลขที่</th><th>รหัส</th><th>ชื่อ–นามสกุล</th></tr></thead><tbody>{roster.map((s,i)=><tr key={s.id}><td>{i+1}</td><td>{s.student_no}</td><td>{s.name_prefix_th??''}{s.first_name_th} {s.last_name_th}</td></tr>)}</tbody></table></div>{!roster.length&&<p className="teacher-empty">ไม่มีนักเรียนลงทะเบียนในห้องนี้</p>}</AcademicDialog>}
 </main>;
}
