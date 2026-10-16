'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {useTeacherWorkspace,teacherRoomLabel} from '@/lib/use-teacher-workspace';
import {pp6Matrix,type Pp6Subject,type Pp6Offering} from '@/lib/pp6-grades';
import type {ScoreRecord,ScoreSetting} from '@/lib/teacher-scores';
type Report={subjects:Pp6Subject[];offerings:Pp6Offering[];scores:ScoreRecord[];settings:ScoreSetting[]};
export default function HomeroomPp6(){
 const {data,loading,error}=useTeacherWorkspace();
 const [roomId,setRoomId]=useState(''),[termNo,setTermNo]=useState(1),[report,setReport]=useState<Report|null>(null),[fetchError,setFetchError]=useState(''),[fetching,setFetching]=useState(false),[query,setQuery]=useState(''),[printId,setPrintId]=useState('');
 const room=data.rooms.find(r=>r.id===roomId),year=data.years.find(y=>y.id===room?.academic_year_id);
 const homeRooms=data.rooms.filter(r=>data.homerooms.some(h=>h.classroom_id===r.id));
 const actualRoom=homeRooms.find(r=>r.id===roomId)??homeRooms[0];
 const id=actualRoom?.id??'';
 useEffect(()=>{let active=true;(async()=>{
  setReport(null);setFetchError('');if(!id||!data.schoolId)return;
  const db=getSupabaseBrowserClient();if(!db)return;setFetching(true);
  const roomFound=data.rooms.find(r=>r.id===id);if(!roomFound)return;
  const [s,o,set]=await Promise.all([
    db.from('subjects').select('id,subject_code,name_th,grade_level,category,learning_hours').eq('school_id',data.schoolId).eq('grade_level',roomFound.level_code),
    db.from('course_offerings').select('id,subject_id,classroom_id,term_id').eq('school_id',data.schoolId).eq('classroom_id',id),
    db.from('subject_score_settings').select('subject_id,academic_year_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final').eq('school_id',data.schoolId).eq('academic_year_id',roomFound.academic_year_id)
  ]);
  if(!active)return;
  const fail=s.error||o.error||set.error;
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
  if(active){setReport({subjects:filteredSubjects,offerings,scores,settings:set.data??[]});setFetching(false);}
 })();return()=>{active=false;};},[id,data,termNo]);
 const enrolled=actualRoom?data.enrollments.filter(e=>e.classroom_id===actualRoom.id&&e.academic_year_id===actualRoom.academic_year_id).map(e=>e.student_id):[];
 const students=data.students.filter(s=>enrolled.includes(s.id)&&[s.student_no,s.first_name_th,s.last_name_th].join(' ').includes(query));
 const matrix=(sid:string)=>report&&actualRoom?pp6Matrix(report.subjects,report.offerings,data.terms,report.scores,report.settings,sid,actualRoom.academic_year_id,termNo,actualRoom.level_code):[];
 const valid=!!report&&students.length>0&&report.subjects.length>0;
 const alerts=students.filter(s=>matrix(s.id).some(c=>c.state!=='complete')).length;
 return <main className="wichakan-page mx-auto max-w-[1500px] px-4 py-5">
 <div className="print:hidden"><PageHeader title="ตรวจผลการเรียนและ ปพ.6"/>
 <p className="mb-4 text-sm text-slate-500">ครูประจำชั้นตรวจสอบเกรดทุกวิชาก่อนออกเอกสารตามแบบ ปพ.6</p>
 <div className="ui-panel mb-4 flex flex-wrap items-end gap-3 p-4"><label className="text-sm">ห้องประจำชั้น<select className="ml-2 rounded-lg border p-2" value={id} onChange={e=>setRoomId(e.target.value)}>{homeRooms.map(r=><option value={r.id} key={r.id}>{teacherRoomLabel(r)}</option>)}</select></label><label className="text-sm">งวดรายงาน<select className="ml-2 rounded-lg border p-2" value={termNo} onChange={e=>setTermNo(Number(e.target.value))}><option value={1}>สิ้นภาคเรียนที่ 1</option><option value={2}>สิ้นภาคเรียนที่ 2</option></select></label><input aria-label="ค้นหานักเรียน" className="rounded-lg border p-2 text-sm" placeholder="ค้นหารหัสหรือชื่อ" value={query} onChange={e=>setQuery(e.target.value)}/><Link className="ui-secondary" href="/teacher">กลับแดชบอร์ดครู</Link></div>
 {(error||fetchError)&&<p role="alert" className="teacher-error">{error||fetchError}</p>}
 {loading||fetching?<p>กำลังรวบรวมผลรายวิชา...</p>:!homeRooms.length?<p className="ui-panel p-5">ไม่มีห้องประจำชั้นที่ได้รับมอบหมาย</p>:<><div className="teacher-metrics mb-4"><div className="teacher-metric blue"><div><p>นักเรียนทั้งหมด</p><strong>{students.length}</strong></div></div><div className="teacher-metric orange"><div><p>ต้องตรวจสอบ</p><strong>{alerts}</strong></div></div><div className="teacher-metric green"><div><p>รายวิชา</p><strong>{report?.subjects.length??0}</strong></div></div></div>
 <section className="ui-panel p-4"><h2 className="mb-2 text-lg font-bold">ตารางสรุปผลการเรียนทั้งห้อง</h2><p className="mb-3 text-xs text-amber-800">ข้อมูลนี้เป็นการตรวจสอบเบื้องต้น ยังไม่ใช่ผลการเรียนที่ได้รับอนุมัติ และคะแนนบางวิชาอาจไม่ปรากฏหากสิทธิ์อ่านข้อมูลยังไม่ครอบคลุม</p><div className="max-h-[65vh] overflow-auto"><table className="min-w-max border-collapse text-xs"><thead className="sticky top-0 bg-blue-50"><tr><th className="sticky left-0 border bg-blue-50 p-2">นักเรียน</th>{report?.subjects.map(s=><th className="min-w-24 border p-2" key={s.id} title={s.name_th}>{s.subject_code}<div className="font-normal">{s.name_th}</div></th>)}<th className="border p-2">ปัญหา</th><th className="border p-2">ตรวจสอบ</th></tr></thead><tbody>{students.map(s=>{const row=matrix(s.id),issues=row.filter(c=>c.state!=='complete');return <tr key={s.id}><th className="sticky left-0 border bg-white p-2 text-left">{s.student_no} {s.first_name_th} {s.last_name_th}</th>{row.map(c=><td key={c.subjectId} className={'border p-2 text-center '+(c.state==='complete'?'text-green-800':'bg-amber-50 text-amber-900')}>{c.grade}</td>)}<td className="border p-2 text-center">{issues.length||'—'}</td><td className="border p-2"><button className="text-blue-700 underline" onClick={()=>setPrintId(s.id)}>ดูรายงาน</button></td></tr>})}</tbody></table></div>
 {!valid&&<p className="p-3 text-sm text-slate-500">ยังไม่มีข้อมูลเพียงพอที่จะสร้างรายงาน</p>}</section>
 <p className="mt-4 text-sm text-amber-800">ปพ.6 ฉบับทางการยังพิมพ์ไม่ได้จนกว่าจะเชื่อมผลการประเมินเพิ่มเติม ตรวจสอบความครบถ้วน และอนุมัติผลการเรียน</p></>}
 </div>
 {printId&&<div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:static print:bg-white print:p-0"><div className="mx-auto max-w-[850px] bg-white p-5"><div className="mb-3 flex justify-end gap-3 print:hidden"><button className="ui-secondary" onClick={()=>setPrintId('')}>ปิดตัวอย่าง</button><button className="ui-secondary" onClick={()=>window.print()}>พิมพ์ฉบับตรวจสอบ</button></div><div className="border-4 border-dashed border-amber-300 p-5 print:border-0"><div className="text-center text-sm font-bold">ฉบับตรวจสอบ ไม่ใช่เอกสารรับรองผลการเรียน</div><h2 className="mt-4 text-center text-xl font-bold">แบบรายงานผลพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)</h2><p className="text-center">ปีการศึกษา {year?.year_be??'—'} ภาคเรียนที่ {termNo}</p><p className="text-center font-semibold">โรงเรียนบ้านภูพระโนนผักหวาน</p>{students.filter(x=>x.id===printId).map(s=><div key={s.id}><p className="my-4">รหัสนักเรียน {s.student_no}　ชื่อ {s.first_name_th} {s.last_name_th}　ชั้น {actualRoom?teacherRoomLabel(actualRoom):''}</p><table className="w-full border-collapse text-sm"><thead><tr>{['ลำดับ','รหัสวิชา','ชื่อวิชา','ประเภท','ชั่วโมง','คะแนน','ผลการเรียน'].map(x=><th className="border border-black p-2" key={x}>{x}</th>)}</tr></thead><tbody>{report?.subjects.map((subject,i)=>{const cell=matrix(s.id)[i];return <tr key={subject.id}><td className="border border-black p-1 text-center">{i+1}</td><td className="border border-black p-1">{subject.subject_code}</td><td className="border border-black p-1">{subject.name_th}</td><td className="border border-black p-1">{subject.category==='basic'?'พื้นฐาน':subject.category==='additional'?'เพิ่มเติม':'กิจกรรม'}</td><td className="border border-black p-1 text-center">{subject.learning_hours??'—'}</td><td className="border border-black p-1 text-center">{cell?.score??'—'}</td><td className="border border-black p-1 text-center">{cell?.grade??'—'}</td></tr>;})}</tbody></table><p className="mt-4">คุณลักษณะอันพึงประสงค์: ยังไม่มีข้อมูลการประเมิน</p><p>การอ่าน คิดวิเคราะห์และเขียน: ยังไม่มีข้อมูลการประเมิน</p><p>กิจกรรมพัฒนาผู้เรียน: ยังไม่มีข้อมูลการประเมิน</p><p>GPA: รอตรวจสอบน้ำหนักและอนุมัติผลการเรียน</p><div className="mt-10 flex justify-between gap-4 text-sm"><span>ลงชื่อ .......................<br/>ครูประจำชั้น</span><span>ลงชื่อ .......................<br/>ผู้บริหารสถานศึกษา</span><span>ลงชื่อ .......................<br/>ผู้ปกครอง</span></div></div>)}</div></div></div>}
 </main>;
}