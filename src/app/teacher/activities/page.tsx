'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Schedule={id:string;school_id:string;term_id:string;classroom_id:string;activity_type:string;weekday_no:number;period_no:number;teacher_user_id:string|null};
type Room={id:string;level_code:string;room_code:string};
type Enrollment={student_id:string;classroom_id:string;academic_year_id:string;status:string};
type Student={id:string;name_prefix_th:string|null;first_name_th:string;last_name_th:string};
type Term={id:string;academic_year_id:string;term_no:number};
type RecordRow={student_id:string;status:string};
type GradeRow={student_id:string;result:string};
const kinds:Record<string,string>={sss:'สสส.',guidance:'แนะแนว',ethics:'อบรมคุณธรรม',club:'ชุมนุม',scout:'ลูกเสือ–เนตรนารี'};
const weekdays=['','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
export default function TeacherActivitiesPage(){
 const db=getSupabaseBrowserClient();
 const [schedules,setSchedules]=useState<Schedule[]>([]),[rooms,setRooms]=useState<Room[]>([]),[terms,setTerms]=useState<Term[]>([]),[students,setStudents]=useState<Student[]>([]),[enrollments,setEnrollments]=useState<Enrollment[]>([]);
 const [scheduleId,setScheduleId]=useState(''),[date,setDate]=useState(today()),[statuses,setStatuses]=useState<Record<string,string>>({}),[grades,setGrades]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ไม่สามารถเชื่อมต่อฐานข้อมูล');
  const u=await db.auth.getUser();if(!u.data.user)throw Error('กรุณาเข้าสู่ระบบ');
  const m=await db.from('school_memberships').select('school_id,role').eq('user_id',u.data.user.id).eq('active',true);
  if(m.error)throw m.error;const membership=m.data?.[0];if(!membership)throw Error('ไม่พบสิทธิ์โรงเรียน');
  const id=membership.school_id;
  const [sc,h,rm,t,st,en]=await Promise.all([
   db.from('school_activity_schedules').select('id,school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id').eq('school_id',id),
   db.from('homeroom_assignments').select('classroom_id,teacher_user_id').eq('school_id',id),
   db.from('classrooms').select('id,level_code,room_code').eq('school_id',id),
   db.from('terms').select('id,academic_year_id,term_no').eq('school_id',id),
   db.from('students').select('id,name_prefix_th,first_name_th,last_name_th').eq('school_id',id),
   db.from('enrollments').select('student_id,classroom_id,academic_year_id,status').eq('school_id',id).in('status',['active','completed'])
  ]);
  const failure=[sc,h,rm,t,st,en].find(x=>x.error)?.error;if(failure)throw failure;
  const authorized=(sc.data??[]).filter(s=>membership.role==='school_admin'||membership.role==='academic'||(s.activity_type==='club'||s.activity_type==='scout'?h.data?.some(x=>x.classroom_id===s.classroom_id&&x.teacher_user_id===u.data.user?.id):s.teacher_user_id===u.data.user?.id));
  if(!live)return;setSchedules(authorized);setRooms(rm.data??[]);setTerms(t.data??[]);setStudents(st.data??[]);setEnrollments(en.data??[]);setScheduleId(authorized[0]?.id??'');
 }catch(e){if(live)setError(e instanceof Error?e.message:'อ่านข้อมูลกิจกรรมไม่ได้');}finally{if(live)setLoading(false);}})();return()=>{live=false};},[db]);
 const chosen=schedules.find(x=>x.id===scheduleId);
 const selectedTerm=terms.find(t=>t.id===chosen?.term_id);
 const roster=students.filter(s=>enrollments.some(e=>e.student_id===s.id&&e.classroom_id===chosen?.classroom_id&&e.academic_year_id===selectedTerm?.academic_year_id)).sort((a,b)=>a.first_name_th.localeCompare(b.first_name_th,'th'));
 useEffect(()=>{let live=true;(async()=>{if(!db||!chosen)return;try{
  const [r,g]=await Promise.all([db.from('school_activity_attendance').select('student_id,status').eq('schedule_id',chosen.id).eq('class_date',date),db.from('school_activity_assessments').select('student_id,result').eq('schedule_id',chosen.id)]);
  if(r.error||g.error)throw r.error??g.error;if(live){setStatuses(Object.fromEntries((r.data??[] as RecordRow[]).map(x=>[x.student_id,x.status])));setGrades(Object.fromEntries((g.data??[] as GradeRow[]).map(x=>[x.student_id,x.result])));}
 }catch(e){if(live)setError(e instanceof Error?e.message:'อ่านการเช็กชื่อไม่ได้');}})();return()=>{live=false};},[db,chosen?.id,date]);
 async function saveAll(){if(!db||!chosen||busy)return;setBusy(true);setError('');setNotice('');let count=0;try{
  for(const student of roster){const status=statuses[student.id]??null,result=grades[student.id]??null;if(!status&&!result)continue;
   const r=await db.rpc('save_school_activity_record',{p_schedule:chosen.id,p_student:student.id,p_date:date,p_status:status,p_result:result,p_comment:null});
   if(r.error)throw r.error;count++;
  }setNotice('บันทึกข้อมูลนักเรียน '+count+' คนเรียบร้อยแล้ว');
 }catch(e){setError('บันทึกแล้ว '+count+' คนก่อนพบข้อผิดพลาด: '+(e instanceof Error?e.message:'บันทึกไม่ได้'));}finally{setBusy(false);}}
 const wrongDay=chosen&&new Date(date+'T12:00:00').getDay()!==chosen.weekday_no%7;
 return <main className="wichakan-page mx-auto max-w-5xl px-5 py-6"><PageHeader title="บันทึกกิจกรรม"/><p className="mb-4 text-sm text-slate-500">กิจกรรมแยกจากรายวิชา ครูผู้สอนดูแล สสส. แนะแนว อบรมคุณธรรม ส่วนชุมนุมและลูกเสือครูประจำชั้นทั้งสองคนบันทึกได้</p>
 {error&&<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
 {loading?<p>กำลังโหลด...</p>:!schedules.length?<div className="ui-panel p-5"><p>ยังไม่มีกิจกรรมที่ได้รับมอบหมายสำหรับบัญชีนี้</p><p className="mt-2 text-sm text-slate-500">ฝ่ายวิชาการต้องกำหนดกิจกรรมในตารางสอนก่อน จึงจะเริ่มเช็กชื่อได้</p></div>:<>
 <section className="ui-panel mb-4 flex flex-wrap items-end gap-3 p-4"><label className="text-sm">กิจกรรม<select className="mt-1 block max-w-full rounded-lg border p-2" value={scheduleId} onChange={e=>{setScheduleId(e.target.value);setNotice('');}}>{schedules.map(s=>{const room=rooms.find(r=>r.id===s.classroom_id);return <option value={s.id} key={s.id}>{kinds[s.activity_type]} · {room?.level_code}/{room?.room_code} · {weekdays[s.weekday_no]} คาบ {s.period_no}</option>})}</select></label><label className="text-sm">วันที่เช็กชื่อ<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 block rounded-lg border p-2"/></label></section>
 {wrongDay&&<p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">วันที่เลือกไม่ตรงกับวันประจำกิจกรรม ({weekdays[chosen?.weekday_no??0]}) กรุณาเลือกวันที่ถูกต้องก่อนบันทึกเวลาเรียน</p>}
 <section className="ui-panel overflow-x-auto p-4"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3 text-left">นักเรียน</th><th className="p-3 text-left">เวลาเข้าร่วม</th><th className="p-3 text-left">ผลประเมิน</th></tr></thead><tbody>{roster.map(s=><tr key={s.id} className="border-b"><td className="p-3">{s.name_prefix_th??''}{s.first_name_th} {s.last_name_th}</td><td className="p-3"><select aria-label={'เวลาเข้าเรียน '+s.first_name_th} className="w-full rounded-lg border p-2" value={statuses[s.id]??''} onChange={e=>setStatuses(prev=>({...prev,[s.id]:e.target.value}))}><option value="">ยังไม่บันทึก</option><option value="present">มา</option><option value="absent">ขาด</option><option value="late">สาย</option><option value="leave">ลา</option></select></td><td className="p-3"><select aria-label={'ผลประเมิน '+s.first_name_th} className="w-full rounded-lg border p-2" value={grades[s.id]??''} onChange={e=>setGrades(prev=>({...prev,[s.id]:e.target.value}))}><option value="">ยังไม่ประเมิน</option><option value="pending">รอประเมิน</option><option value="pass">ผ่าน</option><option value="fail">ไม่ผ่าน</option></select></td></tr>)}</tbody></table>
 <div className="mt-4 flex justify-end"><button type="button" className="ui-primary" disabled={busy||!roster.length||!!wrongDay} onClick={()=>void saveAll()}>{busy?'กำลังบันทึก...':'บันทึกข้อมูลกิจกรรม'}</button></div></section></>}
 <p className="mt-3 text-xs text-slate-500"><Link href="/teacher">← หน้าหลักครู</Link></p></main>;
}