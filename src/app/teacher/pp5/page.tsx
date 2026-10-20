'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {resolveYear} from '@/lib/academic-year-selection';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {useTeacherWorkspace,teacherRoomLabel,offeringRoster} from '@/lib/use-teacher-workspace';
import {evaluateScore,scoreMode,settingCaps,SCORE_FIELDS,validCaps} from '@/lib/teacher-scores';

type Target={id:string;target_type:'indicator'|'learning_outcome';standard_code:string|null;target_code:string|null;target_description:string;indicator_phase:string|null;display_order:number};
const gender=(prefix:string|null)=>/^(เด็กชาย|ด\.ช\.|นาย)(?:\s|$)/.test((prefix??'').trim())?0:/^(เด็กหญิง|ด\.ญ\.|นางสาว|นาง)(?:\s|$)/.test((prefix??'').trim())?1:2;
const scoreText=(value:number|null)=>value===null?'—':String(value);
export default function TeacherPp5Page(){
 const {data,loading,error,reload}=useTeacherWorkspace();
 const [yearId,setYearId]=useState(''),[offeringId,setOfferingId]=useState(''),[targets,setTargets]=useState<Target[]>([]),[targetLoading,setTargetLoading]=useState(false),[targetError,setTargetError]=useState('');
 const [attendance,setAttendance]=useState<{student_id:string;class_date:string;session_no:number;attendance_status:string}[]>([]),[attendanceLoading,setAttendanceLoading]=useState(false),[attendanceError,setAttendanceError]=useState('');
 useEffect(()=>{if(!loading&&data.schoolId)setYearId(v=>data.years.some(y=>y.id===v)?v:resolveYear(data.years,data.schoolId));},[loading,data.schoolId,data.years]);
 const year=data.years.find(y=>y.id===yearId);
 const available=data.offerings.filter(o=>data.rooms.some(r=>r.id===o.classroom_id&&r.academic_year_id===yearId));
 const selected=available.find(o=>o.id===offeringId)??available[0];
 const subject=data.subjects.find(s=>s.id===selected?.subject_id);
 const room=data.rooms.find(r=>r.id===selected?.classroom_id);
 const term=data.terms.find(t=>t.id===selected?.term_id);
 const mode=scoreMode(room?.level_code);
 const setting=data.settings.find(s=>s.subject_id===selected?.subject_id&&s.academic_year_id===yearId);
 const caps=settingCaps(setting);
 const capsReady=validCaps(caps,mode);
 const roster=selected?offeringRoster(data,selected).sort((a,b)=>gender(a.name_prefix_th)-gender(b.name_prefix_th)||a.student_no.localeCompare(b.student_no,'th',{numeric:true})): [];
 const rows=roster.map((student,i)=>{
  const record=data.scores.find(r=>r.course_offering_id===selected?.id&&r.student_id===student.id);
  const result=evaluateScore(SCORE_FIELDS.map(f=>record?.[f]==null?'':String(record[f])),record?.special_result??'',caps,mode,term?.term_no??1);
  const offset=(term?.term_no??1)===1?0:3;
  return {student,i,record,result,scores:SCORE_FIELDS.slice(offset,offset+3).map(f=>record?.[f]??null),termTotal:(term?.term_no??1)===1?result.term1:result.term2,complete:!!record?.is_complete&&result.complete};
 });
 const done=rows.filter(r=>r.complete).length;
 useEffect(()=>{let live=true;(async()=>{
  setTargets([]);setTargetError('');if(!selected?.subject_id||!data.schoolId)return;
  setTargetLoading(true);
  const db=getSupabaseBrowserClient();if(!db){setTargetError('ยังไม่ได้เชื่อมต่อฐานข้อมูล');setTargetLoading(false);return;}
  const res=await db.from('subject_learning_targets').select('id,target_type,standard_code,target_code,target_description,indicator_phase,display_order').eq('school_id',data.schoolId).eq('subject_id',selected.subject_id).order('display_order').order('target_code');
  if(live){if(res.error)setTargetError(res.error.message);else setTargets((res.data??[]) as Target[]);setTargetLoading(false);}
 })();return()=>{live=false};},[data.schoolId,selected?.subject_id]);
 useEffect(()=>{let active=true;(async()=>{setAttendance([]);setAttendanceError('');if(!selected?.id||!data.schoolId)return;setAttendanceLoading(true);const db=getSupabaseBrowserClient();if(!db){setAttendanceError('ไม่พบการเชื่อมต่อฐานข้อมูล');setAttendanceLoading(false);return;}const r=await db.from('course_attendance_records').select('student_id,class_date,session_no,attendance_status').eq('school_id',data.schoolId).eq('course_offering_id',selected.id).order('class_date').limit(10000);if(active){if(r.error)setAttendanceError(r.error.message);else setAttendance(r.data??[]);setAttendanceLoading(false);}})();return()=>{active=false};},[data.schoolId,selected?.id]);
 const recordedSessions=new Set(attendance.map(a=>a.class_date+'#'+a.session_no)).size;
 return <main className="wichakan-page pp5-page">
  <PageHeader title="ปพ.5 รายวิชา"/>
  <p className="mb-4 text-sm text-slate-500">รายงานผลการพัฒนาคุณภาพผู้เรียนรายวิชา โดยใช้ข้อมูลคะแนนจากหน้าบันทึกคะแนนเดิม (ไม่ต้องกรอกซ้ำ)</p>
  {error&&<p role="alert" className="teacher-error">{error}<button onClick={()=>void reload()}>ลองอีกครั้ง</button></p>}
  {loading&&<p role="status" className="teacher-empty">กำลังโหลดข้อมูลรายวิชา...</p>}
  <section className="ui-panel mb-4 flex flex-wrap items-end gap-3 print:hidden" aria-label="เลือกรายงาน ปพ.5">
   <label className="min-w-[130px] flex-1 text-sm font-semibold">ปีการศึกษา<select className="mt-1 w-full rounded-lg border p-2" value={yearId} onChange={e=>{setYearId(e.target.value);setOfferingId('')}} disabled={loading}>{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <label className="min-w-[250px] flex-[3] text-sm font-semibold">รายวิชา / ห้องเรียน / ภาคเรียน<select className="mt-1 w-full rounded-lg border p-2" value={selected?.id??''} onChange={e=>setOfferingId(e.target.value)} disabled={loading}>{available.map(o=>{const s=data.subjects.find(s=>s.id===o.subject_id),r=data.rooms.find(r=>r.id===o.classroom_id),t=data.terms.find(t=>t.id===o.term_id);return <option key={o.id} value={o.id}>{s?.subject_code} {s?.name_th} · {r?teacherRoomLabel(r):'—'} · ภาค {t?.term_no??'—'}</option>})}</select></label>
   <button type="button" className="ui-primary" onClick={()=>window.print()} disabled={!selected||loading}>พิมพ์ / บันทึก PDF</button>
   {selected&&<Link className="ui-secondary" href={'/teacher/scores?offering='+encodeURIComponent(selected.id)}>ไปหน้าบันทึกคะแนน</Link>}\n   {selected&&<Link className="ui-secondary" href="/teacher/attendance">บันทึกเวลาเรียน</Link>}
  </section>
  {!loading&&!selected&&<p className="ui-panel teacher-empty">ยังไม่มีรายวิชาที่ได้รับมอบหมายในปีการศึกษานี้</p>}
  {selected&&<div className="pp5-print space-y-4 bg-white text-slate-900">
   <header className="border-b-2 border-blue-800 pb-4">
    <p className="text-xs font-semibold uppercase tracking-widest text-blue-800">WICHAKAN · Academic Record</p>
    <h1 className="mt-2 text-2xl font-bold">แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)</h1>
    <p className="mt-1 text-sm text-slate-600">รหัสวิชา {subject?.subject_code??'—'} · {subject?.name_th??'—'}</p>
    <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm"><span>ชั้น/ห้อง: <strong>{room?teacherRoomLabel(room):'—'}</strong></span><span>ปีการศึกษา: <strong>{year?.year_be??'—'}</strong></span><span>ภาคเรียนที่: <strong>{term?.term_no??'—'}</strong></span><span>นักเรียน: <strong>{roster.length} คน</strong></span></div>
   </header>
   <section className="flex flex-wrap gap-5 border-b border-slate-200 pb-3 text-sm"><span>สถานะบันทึกครบ <strong>{done}/{roster.length}</strong></span><span>โครงสร้างคะแนน: <strong>{capsReady?'กำหนดแล้ว':'ยังไม่ครบ'}</strong></span><span>มาตรฐานและตัวชี้วัด: <strong>{targets.length} รายการ</strong></span></section>
   <section><h2 className="mb-2 text-lg font-bold">ข้อมูลคะแนนรายวิชา</h2><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="bg-blue-50 text-blue-950"><th className="border-b p-2 text-left">เลขที่</th><th className="border-b p-2 text-left">รหัส</th><th className="border-b p-2 text-left">ชื่อ–สกุล</th><th className="border-b p-2 text-right">เก็บ ({caps[term?.term_no===1?0:3]??'—'})</th><th className="border-b p-2 text-right">กลาง ({caps[term?.term_no===1?1:4]??'—'})</th><th className="border-b p-2 text-right">ปลาย ({caps[term?.term_no===1?2:5]??'—'})</th><th className="border-b p-2 text-right">รวมภาค</th><th className="border-b p-2 text-center">ผลการเรียน</th></tr></thead><tbody>{rows.map(({student,i,result,scores,termTotal,complete})=><tr key={student.id} className="border-b border-slate-100"><td className="p-2">{i+1}</td><td className="p-2">{student.student_no}</td><td className="p-2">{student.name_prefix_th??''}{student.first_name_th} {student.last_name_th}</td>{scores.map((v,j)=><td className="p-2 text-right" key={j}>{scoreText(v)}</td>)}<td className="p-2 text-right font-semibold">{scoreText(termTotal)}</td><td className="p-2 text-center">{complete?result.grade:'—'}</td></tr>)}</tbody></table></div>
    {!capsReady&&<p className="mt-2 text-sm text-amber-800">ยังไม่ได้ตั้งค่าโครงสร้างคะแนนให้ถูกต้อง — ต้องตรวจสอบก่อนรับรองผลการเรียน</p>}
    {mode==='annual'&&<p className="mt-2 text-xs text-slate-500">ระดับประถมศึกษา: คะแนนภาคเรียนละ 50 คะแนน ระดับผลการเรียนประจำปีจะแสดงเมื่อมีคะแนนครบทั้งสองภาคเรียน</p>}
   </section>
   <section className="border-t border-slate-200 pt-3"><h2 className="mb-2 text-lg font-bold">มาตรฐานการเรียนรู้ / ตัวชี้วัด / ผลการเรียนรู้</h2>
    {targetLoading?<p className="text-sm text-slate-500">กำลังโหลดตัวชี้วัด...</p>:targetError?<p role="alert" className="text-sm text-red-700">{targetError}</p>:targets.length?<ol className="space-y-2 text-sm">{targets.map((t,i)=><li key={t.id} className="border-b border-slate-100 pb-2"><span className="mr-2 font-semibold">{i+1}.</span>{t.target_code&&<strong className="mr-2">{t.target_code}</strong>}{t.target_description}<span className="ml-2 text-xs text-slate-500">({t.target_type==='learning_outcome'?'ผลการเรียนรู้':t.indicator_phase==='intermediate'?'ระหว่างทาง':t.indicator_phase==='final'?'ปลายทาง':'ตัวชี้วัด'})</span></li>)}</ol>:<p className="text-sm text-slate-500">ยังไม่ได้กำหนดตัวชี้วัดสำหรับรายวิชานี้ — ให้ Admin เพิ่มในเมนูหลักสูตรและรายวิชา</p>}
   </section>
   <section className="border-t border-slate-200 pt-3"><h2 className="mb-2 text-lg font-bold">สรุปเวลาเรียนรายวิชา</h2>{attendanceLoading?<p className="text-sm text-slate-500">กำลังโหลดเวลาเรียน...</p>:attendanceError?<p role="alert" className="text-sm text-red-700">{attendanceError}</p>:<><p className="mb-2 text-xs text-slate-600">จำนวนคาบที่มีบันทึก: {recordedSessions} คาบ (นับเฉพาะคาบที่มีการเช็กชื่อ ไม่ใช่จำนวนคาบทั้งหมดตามแผนการสอน)</p><table className="w-full border-collapse text-sm"><thead><tr className="bg-blue-50"><th className="border-b p-2 text-left">นักเรียน</th><th className="border-b p-2 text-right">มา</th><th className="border-b p-2 text-right">ขาด</th><th className="border-b p-2 text-right">สาย</th><th className="border-b p-2 text-right">ลา</th><th className="border-b p-2 text-right">คาบที่บันทึก</th></tr></thead><tbody>{roster.map(student=>{const a=attendance.filter(e=>e.student_id===student.id);return <tr className="border-b border-slate-100" key={student.id}><td className="p-2">{student.name_prefix_th??''}{student.first_name_th} {student.last_name_th}</td>{(['present','absent','late','leave'] as const).map(v=><td className="p-2 text-right" key={v}>{a.filter(e=>e.attendance_status===v).length}</td>)}<td className="p-2 text-right">{a.length}/{recordedSessions}</td></tr>})}</tbody></table></>}<p className="mt-2 text-xs text-slate-500">รายงานยังเป็นฉบับร่าง การพิจารณา มส. ต้องอาศัยเกณฑ์เวลาเรียนและคาบเรียนจริงที่กำหนดโดยโรงเรียน</p></section>
   <footer className="border-t border-slate-200 pt-4 text-sm"><p className="font-semibold">เอกสารฉบับร่างจาก Wichakan — ยังไม่ผ่านการรับรอง</p><p className="mt-1 text-xs text-slate-500">ข้อมูลคะแนนและตัวชี้วัดแสดงจากฐานข้อมูล ณ เวลาที่เรียกรายงาน ไม่ใช่เอกสารรับรองผลการเรียน</p></footer>
  </div>}
  <style jsx global>{`@media print{@page{size:A4 landscape;margin:12mm}body *{visibility:hidden!important}.pp5-print,.pp5-print *{visibility:visible!important}.pp5-print{position:absolute!important;top:0;left:0;width:100%;font-size:10pt!important}.pp5-print table{width:100%;font-size:9pt!important}.pp5-print tr{break-inside:avoid}.pp5-print section{break-inside:auto}.pp5-print header{break-after:avoid}.pp5-print h2{break-after:avoid}}`}</style>
 </main>;
}
