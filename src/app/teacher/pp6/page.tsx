'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import Pp6Report from '@/components/pp6-report';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {resolveYear} from '@/lib/academic-year-selection';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {useTeacherWorkspace,teacherRoomLabel} from '@/lib/use-teacher-workspace';
import {pp6Matrix,provisionalGpa,type Pp6Subject,type Pp6Offering} from '@/lib/pp6-grades';
import type {ScoreRecord,ScoreSetting} from '@/lib/teacher-scores';
type Assessment={student_id:string;term_no:number;desirable_traits:string|null;reading_thinking_writing:string|null;learner_activities:string|null;comment:string|null};
type Report={directorName:string;subjects:Pp6Subject[];offerings:Pp6Offering[];scores:ScoreRecord[];settings:ScoreSetting[]};
export default function HomeroomPp6(){
 const {data,loading,error}=useTeacherWorkspace();
 const [printerName,setPrinterName]=useState(''),[printerError,setPrinterError]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  const db=getSupabaseBrowserClient();if(!db)return;const {data:{user},error:authError}=await db.auth.getUser();
  if(authError)throw authError;if(!user)return;
  const {data:profile,error:e}=await db.from('profiles').select('display_name').eq('user_id',user.id).limit(1);
  if(e)throw e;if(!live)return;
  const name=profile?.[0]?.display_name?.trim();if(!name){setPrinterError('ไม่พบชื่อครูในบัญชีผู้พิมพ์ กรุณาติดต่อผู้ดูแลระบบ');return;}setPrinterName(name);
 }catch(e){if(live)setPrinterError(e instanceof Error?e.message:'โหลดชื่อครูผู้พิมพ์ไม่สำเร็จ');}})();return()=>{live=false;};},[]);
 const [assessments,setAssessments]=useState<Assessment[]>([]),[draft,setDraft]=useState<Assessment|null>(null),[editingId,setEditingId]=useState(''),[saving,setSaving]=useState(false),[assessmentMsg,setAssessmentMsg]=useState('');
 const [roomId,setRoomId]=useState(''),[termNo,setTermNo]=useState(1),[report,setReport]=useState<Report|null>(null),[fetchError,setFetchError]=useState(''),[fetching,setFetching]=useState(false),[query,setQuery]=useState(''),[printId,setPrintId]=useState(''),[printing,setPrinting]=useState(false),[printError,setPrintError]=useState('');
 const homeRooms=data.rooms.filter(r=>data.homerooms.some(h=>h.classroom_id===r.id));
 useEffect(()=>{
  const requested=new URLSearchParams(window.location.search).get('room');
  const preferredYear=resolveYear(data.years,data.schoolId);
  const rooms=data.rooms.filter(r=>data.homerooms.some(h=>h.classroom_id===r.id));
  setRoomId(previous=>rooms.some(r=>r.id===previous)?previous:rooms.find(r=>r.id===requested)?.id??rooms.find(r=>r.academic_year_id===preferredYear)?.id??rooms[0]?.id??'');
 },[data.rooms,data.homerooms,data.years,data.schoolId]);
 const actualRoom=homeRooms.find(r=>r.id===roomId);
 const id=actualRoom?.id??'',year=data.years.find(y=>y.id===actualRoom?.academic_year_id);
 useEffect(()=>{let active=true;(async()=>{
  setReport(null);setAssessments([]);setEditingId('');setFetchError('');if(!id||!data.schoolId)return;
  const db=getSupabaseBrowserClient();if(!db)return;setFetching(true);
  const roomFound=data.rooms.find(r=>r.id===id);if(!roomFound)return;
  const [s,o,set,signerConfig]=await Promise.all([
    db.from('subjects').select('id,subject_code,name_th,grade_level,category,learning_hours').eq('school_id',data.schoolId).eq('grade_level',roomFound.level_code),
    db.from('course_offerings').select('id,subject_id,classroom_id,term_id').eq('school_id',data.schoolId).eq('classroom_id',id),
    db.from('subject_score_settings').select('subject_id,academic_year_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final').eq('school_id',data.schoolId).eq('academic_year_id',roomFound.academic_year_id),
    db.from('pp5_signatories').select('director_name').eq('school_id',data.schoolId).eq('academic_year_id',roomFound.academic_year_id).maybeSingle()
  ]);
  if(!active)return;
  const fail=s.error||o.error||set.error||signerConfig.error;
  if(fail){setFetchError(fail.message);setFetching(false);return;}
  const offerings=(o.data??[]).filter(x=>data.terms.some(t=>t.id===x.term_id&&t.academic_year_id===roomFound.academic_year_id));
  const filteredSubjects=(s.data??[]).filter(x=>offerings.some(y=>y.subject_id===x.id)&&(!roomFound.level_code.startsWith('ม.')||offerings.some(y=>y.subject_id===x.id&&data.terms.some(t=>t.id===y.term_id&&t.term_no===termNo)))) as Pp6Subject[];
  const scores:ScoreRecord[]=[];
  for(let i=0;i<offerings.length;i+=50){
   const ids=offerings.slice(i,i+50).map(x=>x.id);
   if(!ids.length)continue;
   const r=await db.from('student_course_scores').select('course_offering_id,student_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final,special_result,is_complete').in('course_offering_id',ids).eq('school_id',data.schoolId);
   if(r.error){setFetchError(r.error.message);setFetching(false);return;}
   scores.push(...r.data??[]);
  }
  const ass=await db.from('pp6_student_assessments').select('student_id,term_no,desirable_traits,reading_thinking_writing,learner_activities,comment').eq('classroom_id',id).eq('academic_year_id',roomFound.academic_year_id);
  if(!active)return;if(ass.error){setFetchError(ass.error.message);setFetching(false);return;}
  setAssessments(ass.data??[]);setReport({directorName:signerConfig.data?.director_name?.trim()??'',subjects:filteredSubjects,offerings,scores,settings:set.data??[]});setFetching(false);
 })();return()=>{active=false;};},[id,data,termNo]);
 const enrolled=actualRoom?data.enrollments.filter(e=>e.classroom_id===actualRoom.id&&e.academic_year_id===actualRoom.academic_year_id).map(e=>e.student_id):[];
 const roster=data.students.filter(s=>enrolled.includes(s.id));
 const students=roster.filter(s=>[s.student_no,s.name_prefix_th,s.first_name_th,s.last_name_th].join(' ').includes(query));
 const matrix=(sid:string)=>report&&actualRoom?pp6Matrix(report.subjects,report.offerings,data.terms,report.scores,report.settings,sid,actualRoom.academic_year_id,termNo,actualRoom.level_code):[];
 const assess=(sid:string)=>assessments.find(a=>a.student_id===sid&&a.term_no===termNo);
 const assessmentComplete=(sid:string)=>{const a=assess(sid);return !!(a?.desirable_traits&&a?.reading_thinking_writing&&a?.learner_activities);};
 function openAssessment(sid:string){setEditingId(sid);setAssessmentMsg('');setDraft(assess(sid)??{student_id:sid,term_no:termNo,desirable_traits:null,reading_thinking_writing:null,learner_activities:null,comment:null});}
 async function saveAssessment(){if(!draft||!id||saving)return;const db=getSupabaseBrowserClient();if(!db)return;setSaving(true);setAssessmentMsg('');const {error:e}=await db.rpc('save_pp6_assessment',{p_classroom_id:id,p_student_id:draft.student_id,p_term_no:termNo,p_traits:draft.desirable_traits,p_reading:draft.reading_thinking_writing,p_activities:draft.learner_activities,p_comment:draft.comment});if(e)setAssessmentMsg(e.message);else{setAssessments(old=>[...old.filter(x=>!(x.student_id===draft.student_id&&x.term_no===termNo)),draft]);setEditingId('');setDraft(null);}setSaving(false);}
 const valid=!!report&&students.length>0&&report.subjects.length>0;
 const readyToReview=(sid:string)=>!!report&&report.subjects.length>0&&assessmentComplete(sid)&&matrix(sid).every(x=>x.state==='complete')&&!!(actualRoom&&provisionalGpa(report.subjects,matrix(sid),actualRoom.level_code,termNo));
 const readyCount=students.filter(s=>readyToReview(s.id)).length;
 const alerts=students.filter(s=>matrix(s.id).some(c=>c.state!=='complete')||!assessmentComplete(s.id)).length;
 async function printReport(){
  if(printing||!printerName)return;setPrinting(true);setPrintError('');
  try{
   await Promise.all([document.fonts.load('14px "TH Sarabun PP6"'),document.fonts.load('700 20px "TH Sarabun PP6"'),new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(Error('โหลดตราโรงเรียนไม่สำเร็จ กรุณาลองอีกครั้ง'));image.src=(process.env.NEXT_PUBLIC_BASE_PATH||'')+'/pp6/school-emblem.png';})]);
   await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));window.print();
  }catch(e){setPrintError(e instanceof Error?e.message:'เตรียมเอกสารไม่สำเร็จ');}finally{setPrinting(false);}
 }
 return <main className="wichakan-page mx-auto max-w-[1500px] px-4 py-5">
 <div className="print:hidden"><PageHeader title="ห้องประจำชั้น"/>
 <p className="mb-4 text-sm text-slate-500">ตรวจผลการเรียน ประเมินผู้เรียน และพิมพ์ ปพ.6</p>
 <div className="ui-panel mb-4 flex flex-wrap items-end gap-3 p-4"><label className="text-sm">ห้องประจำชั้น<select aria-label="ห้องประจำชั้น" className="ml-2 rounded-lg border p-2" value={id} onChange={e=>setRoomId(e.target.value)}>{homeRooms.map(r=><option value={r.id} key={r.id}>{teacherRoomLabel(r)}</option>)}</select></label><label className="text-sm">งวดรายงาน<select aria-label="งวดรายงาน" className="ml-2 rounded-lg border p-2" value={termNo} onChange={e=>setTermNo(Number(e.target.value))}><option value={1}>สิ้นภาคเรียนที่ 1</option><option value={2}>สิ้นภาคเรียนที่ 2</option></select></label><input aria-label="ค้นหานักเรียน" className="rounded-lg border p-2 text-sm" placeholder="ค้นหารหัสหรือชื่อ" value={query} onChange={e=>setQuery(e.target.value)}/><Link className="ui-secondary" href="/teacher">กลับแดชบอร์ดครู</Link></div>
 {(error||fetchError||printerError)&&<p role="alert" className="teacher-error">{error||fetchError||printerError}</p>}
 {loading||fetching?<p>กำลังรวบรวมผลรายวิชา...</p>:!homeRooms.length?<p className="ui-panel p-5">ไม่มีห้องประจำชั้นที่ได้รับมอบหมาย</p>:<><div className="teacher-metrics mb-4"><div className="teacher-metric blue"><div><p>นักเรียนทั้งหมด</p><strong>{students.length}</strong></div></div><div className="teacher-metric orange"><div><p>ต้องตรวจสอบ</p><strong>{alerts}</strong></div></div><div className="teacher-metric green"><div><p>ข้อมูลพร้อมตรวจ</p><strong>{readyCount}</strong></div></div><div className="teacher-metric blue"><div><p>รายวิชา</p><strong>{report?.subjects.length??0}</strong></div></div></div>
 <section className="ui-panel p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">ตารางสรุปผลการเรียนทั้งห้อง</h2><button type="button" className="ui-secondary" disabled={!report||!students.length||!printerName} onClick={()=>setPrintId('__all__')}>พิมพ์ ปพ.6 ทั้งห้อง</button></div><p className="mb-3 text-xs text-amber-800">สถานะ “ยังไม่พร้อม” เป็นคำเตือนเท่านั้น สามารถพิมพ์ ปพ.6 ได้ทุกคน ช่องที่ยังไม่มีคะแนนหรือผลประเมินจะแสดงตามข้อมูลจริง</p><div className="max-h-[65vh] overflow-auto"><table className="min-w-max border-collapse text-xs"><thead className="sticky top-0 bg-blue-50"><tr><th className="sticky left-0 border bg-blue-50 p-2">นักเรียน</th>{report?.subjects.map(s=><th className="min-w-24 border p-2" key={s.id} title={s.name_th}>{s.subject_code}<div className="font-normal">{s.name_th}</div></th>)}<th className="border p-2">คุณลักษณะ</th><th className="border p-2">อ่าน/คิด/เขียน</th><th className="border p-2">กิจกรรม</th><th className="border p-2">สถานะ ปพ.6</th><th className="border p-2">ปัญหา</th><th className="border p-2">ตรวจสอบ</th></tr></thead><tbody>{students.map(s=>{const row=matrix(s.id),issues=row.filter(c=>c.state!=='complete');return <tr key={s.id}><th className="sticky left-0 border bg-white p-2 text-left">{s.student_no} {s.name_prefix_th??''}{s.first_name_th} {s.last_name_th}</th>{row.map(c=><td key={c.subjectId} className={'border p-2 text-center '+(c.state==='complete'?'text-green-800':'bg-amber-50 text-amber-900')}>{c.grade}</td>)}<td className="border p-2 text-center"><button className="text-blue-700 underline" onClick={()=>openAssessment(s.id)}>{assess(s.id)?.desirable_traits??'ยังไม่ประเมิน'}</button></td><td className="border p-2 text-center"><button className="text-blue-700 underline" onClick={()=>openAssessment(s.id)}>{assess(s.id)?.reading_thinking_writing??'ยังไม่ประเมิน'}</button></td><td className="border p-2 text-center"><button className="text-blue-700 underline" onClick={()=>openAssessment(s.id)}>{assess(s.id)?.learner_activities??'ยังไม่ประเมิน'}</button></td><td className="border p-2 text-center">{readyToReview(s.id)?'ข้อมูลพร้อมตรวจ':'ยังไม่พร้อม'}</td><td className="border p-2 text-center">{issues.length+Number(!assessmentComplete(s.id))||'—'}</td><td className="border p-2"><button disabled={!printerName} className="text-blue-700 underline disabled:opacity-40" onClick={()=>setPrintId(s.id)}>พิมพ์ ปพ.6</button></td></tr>})}</tbody></table></div>
 {!valid&&<p className="p-3 text-sm text-slate-500">ยังไม่มีข้อมูลเพียงพอที่จะสร้างรายงาน</p>}</section>
 <p className="mt-4 text-sm text-amber-800">พิมพ์ ปพ.6 ได้แม้ผลการเรียนหรือผลประเมินยังไม่ครบ โดยระบบจะไม่เติมคะแนน เกรด หรือ GPA ที่ไม่มีข้อมูล และหน้าตัวอย่างจะแจ้งสถานะที่ยังไม่ผ่านการรับรอง</p></>}
 </div>
 {editingId&&draft&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 print:hidden"><div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-bold">บันทึกผลการประเมินนักเรียน</h2><p className="my-2 text-sm text-slate-600">ภาคเรียนที่ {termNo} · {students.find(s=>s.id===editingId)?.name_prefix_th??''}{students.find(s=>s.id===editingId)?.first_name_th} {students.find(s=>s.id===editingId)?.last_name_th}</p>{([{key:'desirable_traits',label:'คุณลักษณะอันพึงประสงค์',options:['ดีเยี่ยม','ดี','ผ่าน','ไม่ผ่าน']},{key:'reading_thinking_writing',label:'การอ่าน คิดวิเคราะห์และเขียน',options:['ดีเยี่ยม','ดี','ผ่าน','ไม่ผ่าน']},{key:'learner_activities',label:'กิจกรรมพัฒนาผู้เรียน',options:['ผ่าน','ไม่ผ่าน']}] as const).map(field=><label key={field.key} className="mt-3 block text-sm font-semibold">{field.label}<select className="mt-1 w-full rounded-lg border p-2" value={draft[field.key]??''} onChange={e=>setDraft(old=>old?{...old,[field.key]:e.target.value||null}:old)}><option value="">ยังไม่ประเมิน</option>{field.options.map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}<div className="mt-4 border-t border-slate-200 pt-3"><label className="block text-sm font-semibold">ความคิดเห็นครูประจำชั้น<textarea className="mt-1 w-full rounded-lg border p-2" rows={2} maxLength={1000} value={draft.comment??''} onChange={e=>setDraft(old=>old?{...old,comment:e.target.value}:old)}/></label></div>{assessmentMsg&&<p role="alert" className="mt-2 text-sm text-red-700">{assessmentMsg}</p>}<div className="mt-4 flex justify-end gap-2"><button className="ui-secondary" disabled={saving} onClick={()=>setEditingId('')}>ยกเลิก</button><button className="ui-primary" disabled={saving} onClick={()=>void saveAssessment()}>{saving?'กำลังบันทึก':'บันทึกผลประเมิน'}</button></div></div></div>}
 {printId&&actualRoom&&printerName&&createPortal(<div className="pp6-print-modal" role="dialog" aria-modal="true" aria-label="ตัวอย่าง ปพ.6"><div className="pp6-print-sheet"><div className="pp6-print-toolbar"><span>ข้อมูลยังไม่ผ่านการรับรอง</span><button className="ui-secondary" disabled={printing} onClick={()=>{setPrintId('');setPrintError('');}}>ปิดตัวอย่าง</button><button className="ui-secondary" disabled={printing} onClick={()=>void printReport()}>{printing?'กำลังเตรียมเอกสาร…':'พิมพ์ ปพ.6 / บันทึก PDF'}</button></div>{printError&&<p role="alert" className="pp6-print-error">{printError}</p>}{roster.filter(s=>printId==='__all__'||s.id===printId).map(s=><Pp6Report key={s.id} teacherName={printerName} directorName={report?.directorName??''} student={s} room={actualRoom} year={year?.year_be} termNo={termNo} subjects={report?.subjects??[]} cells={matrix(s.id)} assessment={assess(s.id)} gpa={report?provisionalGpa(report.subjects,matrix(s.id),actualRoom.level_code,termNo):null} rosterCount={roster.length}/>)}</div></div>,document.body)}
 </main>;
}
