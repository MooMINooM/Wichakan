'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type Year={id:string;year_be:number};
type Term={id:string;academic_year_id:string;term_no:number};
type Room={id:string;academic_year_id:string;level_code:string;room_code:string};
type Offering={id:string;term_id:string;classroom_id:string;subject_id:string};
type Subject={id:string;subject_code:string;name_th:string};
type Assignment={course_offering_id:string;teacher_user_id:string};
type Homeroom={classroom_id:string;teacher_user_id:string};
type Slot={id:string;course_offering_id:string;weekday_no:number;period_no:number};
type Activity={id:string;term_id:string;classroom_id:string;activity_type:string;weekday_no:number;period_no:number;teacher_user_id:string|null};
type Period={period_no:number;starts_at:string;ends_at:string};
type Lesson={key:string;day:number;period:number;name:string;room:string;kind:'course'|'activity'};
const DAYS=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
const ACTIVITY:Record<string,string>={computing:'วิทยาการคำนวณ (รวมผลการเรียนวิทยาศาสตร์)',sss:'สสส.',guidance:'แนะแนว',ethics:'อบรมคุณธรรม',club:'ชุมนุม',scout:'ลูกเสือ–เนตรนารี'};
const roomName=(r:Room|undefined)=>r?r.level_code+'/'+r.room_code:'—';
export default function TeacherTimetablePage(){
 const db=getSupabaseBrowserClient();
 const [userId,setUserId]=useState(''),[years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]),[rooms,setRooms]=useState<Room[]>([]),[offerings,setOfferings]=useState<Offering[]>([]),[subjects,setSubjects]=useState<Subject[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[homerooms,setHomerooms]=useState<Homeroom[]>([]),[slots,setSlots]=useState<Slot[]>([]),[activities,setActivities]=useState<Activity[]>([]),[periods,setPeriods]=useState<Period[]>([]);
 const [yearId,setYearId]=useState(''),[termId,setTermId]=useState(''),[roomId,setRoomId]=useState(''),[view,setView]=useState<'teacher'|'room'>('teacher'),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ไม่สามารถเชื่อมต่อฐานข้อมูล');const auth=await db.auth.getUser();const uid=auth.data.user?.id;if(!uid)throw Error('กรุณาเข้าสู่ระบบ');
  const members=await db.from('school_memberships').select('school_id').eq('user_id',uid).eq('active',true);if(members.error)throw members.error;const school=members.data?.[0]?.school_id;if(!school)throw Error('ไม่พบสิทธิ์โรงเรียน');
  const [y,t,r,o,s,a,h,sl,ac,p]=await Promise.all([
   db.from('academic_years').select('id,year_be').eq('school_id',school).order('year_be',{ascending:false}),
   db.from('terms').select('id,academic_year_id,term_no').eq('school_id',school),
   db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',school),
   db.from('course_offerings').select('id,term_id,classroom_id,subject_id').eq('school_id',school),
   db.from('subjects').select('id,subject_code,name_th').eq('school_id',school),
   db.from('teaching_assignments').select('course_offering_id,teacher_user_id').eq('school_id',school).eq('teacher_user_id',uid),
   db.from('homeroom_assignments').select('classroom_id,teacher_user_id').eq('school_id',school).eq('teacher_user_id',uid),
   db.from('timetable_slots').select('id,course_offering_id,weekday_no,period_no').eq('school_id',school),
   db.from('school_activity_schedules').select('id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id').eq('school_id',school),
   db.from('timetable_periods').select('period_no,starts_at,ends_at').eq('school_id',school)
  ]);
  const issue=[y,t,r,o,s,a,h,sl,ac,p].find(x=>x.error)?.error;if(issue)throw issue;if(!live)return;
  setUserId(uid);setYears(y.data??[]);setTerms(t.data??[]);setRooms(r.data??[]);setOfferings(o.data??[]);setSubjects(s.data??[]);setAssignments(a.data??[]);setHomerooms(h.data??[]);setSlots(sl.data??[]);setActivities(ac.data??[]);setPeriods(p.data??[]);setYearId(y.data?.[0]?.id??'');
 }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดตารางสอนไม่สำเร็จ');}finally{if(live)setLoading(false);}})();return()=>{live=false};},[db]);
 const yearTerms=terms.filter(t=>t.academic_year_id===yearId).sort((a,b)=>a.term_no-b.term_no);
 const selectedTerm=yearTerms.some(t=>t.id===termId)?termId:yearTerms[0]?.id??'';
 const myRooms=rooms.filter(r=>r.academic_year_id===yearId&&homerooms.some(h=>h.classroom_id===r.id));
 const selectedRoom=myRooms.some(r=>r.id===roomId)?roomId:myRooms[0]?.id??'';
 const lessons=useMemo(()=>{
  const termOffers=offerings.filter(o=>o.term_id===selectedTerm);
  const output:Lesson[]=[];
  for(const slot of slots){const offering=termOffers.find(o=>o.id===slot.course_offering_id);if(!offering)continue;
   if(view==='teacher'&&!assignments.some(a=>a.course_offering_id===offering.id))continue;
   if(view==='room'&&offering.classroom_id!==selectedRoom)continue;
   const subject=subjects.find(s=>s.id===offering.subject_id);
   output.push({key:slot.id,day:slot.weekday_no,period:slot.period_no,name:subject?.name_th??'ไม่พบรายวิชา',room:roomName(rooms.find(r=>r.id===offering.classroom_id)),kind:'course'});
  }
  for(const a of activities.filter(a=>a.term_id===selectedTerm)){
   const homeroomActivity=a.activity_type==='club'||a.activity_type==='scout';
   if(view==='teacher'&&!(homeroomActivity?homerooms.some(h=>h.classroom_id===a.classroom_id):a.teacher_user_id===userId))continue;
   if(view==='room'&&a.classroom_id!==selectedRoom)continue;
   output.push({key:a.id,day:a.weekday_no,period:a.period_no,name:ACTIVITY[a.activity_type]??a.activity_type,room:roomName(rooms.find(r=>r.id===a.classroom_id)),kind:'activity'});
  }return output;
 },[selectedTerm,selectedRoom,view,offerings,slots,assignments,subjects,rooms,activities,homerooms,userId]);
 const maxPeriod=Math.max(7,...lessons.map(x=>x.period),...periods.map(p=>p.period_no));
 return <main className="wichakan-page mx-auto max-w-7xl px-5 py-6"><PageHeader title="ตารางสอนและตารางเรียน"/>
 <p className="mb-4 text-sm text-slate-500">แสดงข้อมูลจากตารางสอนกลางของฝ่ายวิชาการโดยอัตโนมัติ · เฉพาะบัญชีครูที่เข้าสู่ระบบ</p>
 {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
 {loading?<p>กำลังโหลดตาราง...</p>:<>
 <section className="ui-panel mb-4 flex flex-wrap items-end gap-3 p-4">
 <label className="text-sm">ปีการศึกษา<select className="mt-1 block rounded-lg border p-2" value={yearId} onChange={e=>{setYearId(e.target.value);setTermId('');setRoomId('');}}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
 <label className="text-sm">ภาคเรียน<select className="mt-1 block rounded-lg border p-2" value={selectedTerm} onChange={e=>setTermId(e.target.value)}>{yearTerms.map(t=><option key={t.id} value={t.id}>ภาคเรียนที่ {t.term_no}</option>)}</select></label>
 <div role="group" aria-label="ประเภทตาราง" className="flex gap-2"><button type="button" className={view==='teacher'?'ui-primary':'ui-secondary'} onClick={()=>setView('teacher')}>ตารางสอนของฉัน</button><button type="button" className={view==='room'?'ui-primary':'ui-secondary'} onClick={()=>setView('room')}>ตารางเรียนประจำชั้น</button></div>
 {view==='room'&&<label className="text-sm">ห้องประจำชั้น<select className="mt-1 block rounded-lg border p-2" value={selectedRoom} onChange={e=>setRoomId(e.target.value)}>{myRooms.map(r=><option key={r.id} value={r.id}>{roomName(r)}</option>)}</select></label>}
 </section>
 {view==='room'&&!myRooms.length?<section className="ui-panel p-5">บัญชีนี้ยังไม่ได้รับมอบหมายเป็นครูประจำชั้นในปีที่เลือก</section>:<>
 <section className="ui-panel overflow-x-auto p-4">
 <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{view==='teacher'?'ตารางสอนรายบุคคล':'ตารางเรียน '+roomName(myRooms.find(r=>r.id===selectedRoom))}</h2><span className="text-sm text-slate-500">คาบที่มีข้อมูล {lessons.length} รายการ</span></div>
 <table className="w-full min-w-[780px] table-fixed border-collapse text-sm"><thead><tr><th className="border bg-slate-50 p-2">คาบ / เวลา</th>{DAYS.map(d=><th key={d} className="border bg-slate-50 p-2">{d}</th>)}</tr></thead><tbody>{Array.from({length:maxPeriod},(_,index)=>index+1).map(period=>{const time=periods.find(p=>p.period_no===period);return <tr key={period}><th className="border bg-slate-50 p-2 align-top">{period}{time&&<span className="block text-xs font-normal text-slate-500">{time.starts_at.slice(0,5)}–{time.ends_at.slice(0,5)}</span>}</th>{DAYS.map((day,index)=>{const cells=lessons.filter(x=>x.day===index+1&&x.period===period);return <td key={day} className="h-20 border p-2 align-top">{cells.map(x=><div key={x.key} className={'mb-1 rounded-lg p-2 '+(x.kind==='activity'?'bg-amber-50 text-amber-900':'bg-sky-50 text-sky-900')}><strong className="block">{x.name}</strong>{view==='teacher'&&<span className="text-xs">{x.room}</span>}</div>)}</td>;})}</tr>})}</tbody></table>
 </section>
 {!lessons.length&&<p role="status" className="mt-3 rounded-lg border p-4 text-sm text-slate-600">ยังไม่มีรายการคาบที่บันทึกในตารางสอนกลางสำหรับมุมมองนี้ กรุณาให้ฝ่ายวิชาการจัดตารางสอนก่อน</p>}
 </>}
 </>}
 <p className="mt-4 text-sm"><Link href="/teacher" className="text-blue-700">← กลับแดชบอร์ดครู</Link></p></main>;
}
