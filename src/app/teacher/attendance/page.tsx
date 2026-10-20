'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {eligibleForLesson,orderStudents,fullName,type Attendance} from '@/lib/pp5';
import {useCourseContext} from '@/lib/use-course-context';
import {attendancePages,attendanceChanges,attendanceKey,bangkokToday,type AttendanceStatus,type TeachingSlot} from '@/lib/attendance-grid';
import {offeringRoster,teacherRoomLabel,useTeacherWorkspace} from '@/lib/use-teacher-workspace';
const options=[['present','/'],['absent','ข'],['late','ส'],['leave','ล']];
const weekdays=['จ.','อ.','พ.','พฤ.','ศ.'];
export default function TeacherAttendancePage(){
 const {data,loading,error}=useTeacherWorkspace(),c=useCourseContext(data,loading);
 const [entries,setEntries]=useState<Attendance[]>([]),[slots,setSlots]=useState<TeachingSlot[]>([]),[dates,setDates]=useState({start:'',end:''}),[draft,setDraft]=useState<Record<string,AttendanceStatus>>({}),[page,setPage]=useState(0),[loadedId,setLoadedId]=useState(''),[fetching,setFetching]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[localError,setError]=useState(''),[retry,setRetry]=useState(0);
 const selected=c.selected,today=bangkokToday();
 useEffect(()=>{let live=true;setLoadedId('');setEntries([]);setSlots([]);setDates({start:'',end:''});setDraft({});setPage(0);setNotice('');setError('');setFetching(false);if(!selected||!c.initialized)return;setFetching(true);
 (async()=>{try{const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อฐานข้อมูล');
 const [s,t]=await Promise.all([db.from('timetable_slots').select('weekday_no,period_no').eq('school_id',data.schoolId).eq('term_id',selected.term_id).eq('course_offering_id',selected.id),db.from('terms').select('starts_on,ends_on').eq('school_id',data.schoolId).eq('id',selected.term_id).single()]);if(s.error)throw s.error;if(t.error)throw t.error;
 const records:Attendance[]=[];for(let from=0;;from+=500){const r=await db.from('course_attendance_records').select('student_id,class_date,session_no,attendance_status').eq('school_id',data.schoolId).eq('course_offering_id',selected.id).order('class_date').order('session_no').order('student_id').range(from,from+499);if(r.error)throw r.error;records.push(...r.data??[]);if((r.data?.length??0)<500)break;}
 if(live){setEntries(records);setSlots(s.data??[]);setDates({start:t.data?.starts_on??'',end:t.data?.ends_on??''});setLoadedId(selected.id);}
 }catch(e){if(live)setError((e as {message:string}).message);}finally{if(live)setFetching(false);}})();return()=>{live=false;};},[data.schoolId,selected?.id,c.initialized,retry]);
 const roster=useMemo(()=>orderStudents(selected?offeringRoster(data,selected):[]),[data,selected]);
 const pages=useMemo(()=>attendancePages(dates.start,dates.end,slots),[dates,slots]),days=pages[page]??[];
 const saved=useMemo(()=>new Map(entries.map(e=>[attendanceKey(e.student_id,e.class_date,e.session_no),e.attendance_status])),[entries]);
 const ready=!!selected&&loadedId===selected.id&&!fetching&&!error&&!c.linkError;
 const changes=useMemo(()=>selected&&ready?attendanceChanges(data,selected,roster,days,entries,draft,today):[],[data,selected,roster,days,entries,draft,today,ready]);
 const room=data.rooms.find(r=>r.id===selected?.classroom_id),subject=data.subjects.find(s=>s.id===selected?.subject_id);
 function canLeave(){return !Object.keys(draft).length||window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนรายวิชาและละทิ้งการแก้ไขหรือไม่?');}
 async function save(){if(!selected||!ready||busy||!changes.length)return;setBusy(true);setError('');setNotice('');try{const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อฐานข้อมูล');const result=await db.rpc('save_course_attendance_grid',{p_offering:selected.id,p_rows:changes});if(result.error)throw result.error;
 const keys=new Set(changes.map(r=>attendanceKey(r.student_id,r.class_date,r.session_no)));setEntries(old=>[...old.filter(r=>!keys.has(attendanceKey(r.student_id,r.class_date,r.session_no))),...changes]);setDraft(old=>Object.fromEntries(Object.entries(old).filter(([key])=>!keys.has(key))));setNotice('บันทึกทั้งตารางเรียบร้อยแล้ว');
 }catch(e){setError('ยังไม่บันทึกข้อมูล กรุณาลองอีกครั้ง: '+(e as {message:string}).message);}finally{setBusy(false);}}
 return <main className="wichakan-page teacher-attendance-page"><PageHeader title="บันทึกเวลาเรียนรายวิชา"/>
 {(error||c.linkError||localError)&&<p role="alert" className="teacher-error">{error||c.linkError||localError}{!loadedId&&<button onClick={()=>setRetry(r=>r+1)}>ลองอีกครั้ง</button>}</p>}{notice&&<p role="status" className="teacher-success">{notice}</p>}
 <section className="ui-panel mb-4 flex flex-wrap items-end gap-3"><label>ปีการศึกษา<select aria-label="ปีการศึกษา" value={c.yearId} disabled={loading||busy} className="block border p-2" onChange={e=>{if(canLeave())c.chooseYear(e.target.value);}}>{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label><label className="min-w-0 flex-1">รายวิชา / ห้องเรียน / ภาคเรียน<select aria-label="รายวิชา / ห้องเรียน / ภาคเรียน" value={selected?.id??''} disabled={loading||busy} className="block w-full min-w-0 border p-2" onChange={e=>{if(canLeave())c.chooseOffering(e.target.value);}}>{c.available.map(o=><option key={o.id} value={o.id}>{data.subjects.find(s=>s.id===o.subject_id)?.name_th} · {teacherRoomLabel(data.rooms.find(r=>r.id===o.classroom_id)!)} · ภาค {data.terms.find(t=>t.id===o.term_id)?.term_no}</option>)}</select></label><Link className="ui-secondary" href="/teacher#courses">รายวิชาที่สอน</Link></section>
 {(loading||fetching)&&<p role="status">กำลังโหลดตารางเรียน...</p>}
 {ready&&!pages.length&&<p role="alert" className="ui-panel">กรุณาให้ผู้ดูแลกำหนดวันเปิด–ปิดภาคเรียนในตั้งค่างานวิชาการ</p>}
 {ready&&!slots.length&&<p role="alert" className="ui-panel">รายวิชานี้ยังไม่มีคาบในตารางสอน กรุณาให้ผู้ดูแลจัดตารางก่อนบันทึกเวลาเรียน</p>}
 {ready&&pages.length>0&&slots.length>0&&<section className="ui-panel min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2>{subject?.name_th} · {room?teacherRoomLabel(room):''}</h2><Link className="ui-secondary" href={'/teacher/pp5?offering='+encodeURIComponent(selected!.id)}>ดู ปพ.5</Link></div>
 <nav aria-label="ช่วงสัปดาห์" className="mb-3 flex flex-wrap gap-2">{pages.map((_,i)=><button key={i} disabled={busy} aria-current={page===i?'page':undefined} className={page===i?'ui-primary':'ui-secondary'} onClick={()=>{setPage(i);setNotice('');}}>สัปดาห์ {i*5+1}–{i*5+5}</button>)}</nav>
 <p className="mb-3 text-sm text-slate-500">/ มาเรียน · ข ขาด · ส สาย · ล ลา — ตั้งมาเรียนให้ก่อน แก้เฉพาะช่องที่ต้องเปลี่ยนแล้วกดบันทึก</p>
 <div className="attendance-grid-scroll"><table className="attendance-grid"><thead><tr><th rowSpan={2} className="attendance-number">เลขที่</th><th rowSpan={2} className="attendance-name">ชื่อ–สกุล</th>{Array.from({length:5},(_,i)=><th key={i} colSpan={5}>สัปดาห์ที่ {page*5+i+1}</th>)}</tr><tr>{days.map(day=><th key={day.date} className={!day.periods.length?'attendance-off':''}>{weekdays[day.weekday-1]}<span className="block">{day.date.slice(8)}/{day.date.slice(5,7)}</span>{day.periods.length>0&&<small className="block">คาบ {day.periods.join(',')}</small>}</th>)}</tr></thead><tbody>{roster.map((s,i)=><tr key={s.id}><td className="attendance-number">{i+1}</td><th scope="row" className="attendance-name"><span className="block text-xs font-normal">{s.student_no}</span>{fullName(s)}</th>{days.map(day=>{const eligible=eligibleForLesson(data,selected!,s.id,day.date);return <td key={day.date} className={!day.periods.length||!eligible?'attendance-off':''}>{!day.periods.length||!eligible?<span title={!eligible?'นอกช่วงลงทะเบียน':'ไม่มีคาบสอน'}>—</span>:day.periods.map(period=>{const key=attendanceKey(s.id,day.date,period),future=day.date>today;return <label className="attendance-cell" key={period}>{day.periods.length>1&&<small>{period}:</small>}<select aria-label={s.student_no+' '+day.date+' คาบ '+period} title={future?'ยังไม่ถึงวันเรียน':saved.has(key)?'บันทึกแล้ว':'ยังไม่บันทึก'} value={draft[key]??saved.get(key)??'present'} disabled={busy||future} className={draft[key]!==undefined?'attendance-edited':saved.has(key)?'attendance-saved':'attendance-default'} onChange={e=>setDraft(old=>({...old,[key]:e.target.value as AttendanceStatus}))}>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>;})}</td>;})}</tr>)}</tbody></table></div>
 <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">บันทึกเฉพาะช่วงที่เปิดอยู่และวันที่ถึงแล้ว · ช่องสีเทาไม่มีคาบสอน</p><button className="ui-primary" disabled={busy||!changes.length} onClick={()=>void save()}>{busy?'กำลังบันทึก...':'บันทึกทั้งตาราง'}</button></div>
 </section>}
 {!loading&&!selected&&!c.linkError&&<p className="ui-panel">ไม่มีรายวิชาที่ได้รับมอบหมาย</p>}
 </main>;
}
