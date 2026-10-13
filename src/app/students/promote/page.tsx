'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
type Room={id:string;academic_year_id:string;level_code:string;room_code:string};
type Year={id:string;year_be:number;is_active:boolean};
type Student={id:string;student_no:string;first_name_th:string;last_name_th:string};
type Enrollment={student_id:string;classroom_id:string;status:string};
const roomLabel=(r:Room)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
export default function PromotePage(){
 const router=useRouter(),db=getSupabaseBrowserClient();
 const [schoolId,setSchoolId]=useState(''),[allowed,setAllowed]=useState(false);
 const [years,setYears]=useState<Year[]>([]),[rooms,setRooms]=useState<Room[]>([]);
 const [students,setStudents]=useState<Student[]>([]),[enrollments,setEnrollments]=useState<Enrollment[]>([]);
 const [sourceYearId,setSourceYearId]=useState('');
 const [source,setSource]=useState(''),[target,setTarget]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;(async()=>{
  if(!db){setError('ยังไม่ตั้งค่า Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('school_id,role').eq('user_id',user.id).eq('active',true);
  if(!alive)return;if(e){setError(e.message);return;}
  const m=(data??[]).find(x=>['school_admin','registrar'].includes(x.role));
  if(!m){setError('บัญชีนี้ไม่มีสิทธิ์เลื่อนชั้นนักเรียน');return;}
  setAllowed(true);setSchoolId(m.school_id);
 })();return()=>{alive=false;};},[db,router]);
 async function reload(id:string){
  if(!db)return;
  const [y,r,s,e]=await Promise.all([
   db.from('academic_years').select('id,year_be,is_active').eq('school_id',id),
   db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',id),
   db.from('students').select('id,student_no,first_name_th,last_name_th').eq('school_id',id),
   db.from('enrollments').select('student_id,classroom_id,status').eq('school_id',id)
  ]);
  const failure=[y.error,r.error,s.error,e.error].find(Boolean);
  if(failure){setError(failure.message);return;}
  setYears(y.data??[]);setSourceYearId(prev=>resolveYear(y.data??[],id,prev));setRooms(r.data??[]);setStudents(s.data??[]);setEnrollments(e.data??[]);
 }
 useEffect(()=>{if(schoolId)void reload(schoolId);},[schoolId]);
 useEffect(()=>{if(schoolId&&sourceYearId)setYearSelection(schoolId,sourceYearId);},[schoolId,sourceYearId]);
 useEffect(()=>{if(!schoolId)return;
  const sync=(ev:Event)=>{const d=(ev as CustomEvent<{schoolId:string;yearId:string}>).detail;
   if(d?.schoolId===schoolId)setSourceYearId(prev=>prev===d.yearId?prev:d.yearId);};
  window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);
 },[schoolId]);
 const sourceRoom=rooms.find(r=>r.id===source);
 const fromYear=years.find(y=>y.id===sourceRoom?.academic_year_id)?.year_be??0;
 const destinations=rooms.filter(r=>(years.find(y=>y.id===r.academic_year_id)?.year_be??0)>fromYear);
 const eligible=enrollments.filter(e=>e.classroom_id===source&&['active','completed'].includes(e.status))
  .map(e=>students.find(s=>s.id===e.student_id)).filter((s):s is Student=>!!s);
 async function promote(){
  if(!db||!allowed||!source||!target||!selected.length||busy)return;
  if(!window.confirm(`ยืนยันเลื่อนชั้นนักเรียน ${selected.length} คน? จะสร้างประวัติปีใหม่โดยไม่ลบปีเดิม`))return;
  setBusy(true);setError('');setNotice('');
  const {data,error:e}=await db.rpc('promote_students_batch',{p_school_id:schoolId,p_source_classroom_id:source,p_target_classroom_id:target,p_student_ids:selected});
  if(e)setError(e.message);else{setNotice(`เลื่อนชั้นสำเร็จ ${data} คน`);setSelected([]);await reload(schoolId);}
  setBusy(false);
 }
 return <main className="mx-auto max-w-5xl px-5 py-8">
  <Link href="/students/history" className="text-sm text-blue-700">← ประวัติการศึกษา</Link>
  <h1 className="mt-3 text-3xl font-bold">เลื่อนชั้นแบบกลุ่ม</h1>
  <p className="mt-2 text-sm text-slate-500">Batch Promotion · บันทึกนักเรียนเข้าสู่ปีถัดไป โดยรักษาประวัติปีเดิม</p>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
  {allowed&&<div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">ปีการศึกษาต้นทาง<select className="mt-2 w-full rounded-xl border p-3" value={sourceYearId} onChange={e=>{setSourceYearId(e.target.value);setSource('');setTarget('');setSelected([]);}}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
    <label className="text-sm font-medium">ห้องเรียนต้นทาง<select className="mt-2 w-full rounded-xl border p-3" value={source} onChange={e=>{setSource(e.target.value);setTarget('');setSelected([]);}}>
     <option value="">เลือกห้องต้นทาง</option>{rooms.filter(r=>r.academic_year_id===sourceYearId).map(r=><option key={r.id} value={r.id}>{years.find(y=>y.id===r.academic_year_id)?.year_be} · {roomLabel(r)}</option>)}
    </select></label>
    <label className="text-sm font-medium">ห้องเรียนปีถัดไป<select className="mt-2 w-full rounded-xl border p-3" value={target} onChange={e=>setTarget(e.target.value)}>
     <option value="">เลือกห้องปลายทาง</option>{destinations.map(r=><option key={r.id} value={r.id}>{years.find(y=>y.id===r.academic_year_id)?.year_be} · {roomLabel(r)}</option>)}
    </select></label>
   </div>
   <div className="mt-6 flex items-center justify-between"><h2 className="font-bold">นักเรียนที่มีสิทธิ์ ({eligible.length})</h2>
    <label className="text-sm"><input type="checkbox" checked={eligible.length>0&&selected.length===eligible.length} onChange={e=>setSelected(e.target.checked?eligible.map(s=>s.id):[])} /> เลือกทั้งหมด</label></div>
   <div className="mt-4 divide-y">{eligible.map(s=><label key={s.id} className="flex items-center gap-3 py-3 text-sm">
    <input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,s.id]:old.filter(x=>x!==s.id))}/>
    <span>{s.student_no} — {s.first_name_th} {s.last_name_th}</span></label>)}
    {!eligible.length&&<p className="py-5 text-sm text-slate-500">เลือกห้องต้นทางที่มีนักเรียนก่อน</p>}</div>
   <button disabled={busy||!selected.length||!target} onClick={promote} className="mt-6 rounded-xl bg-blue-800 px-6 py-3 font-medium text-white disabled:opacity-40">{busy?'กำลังบันทึก...':`ยืนยันเลื่อนชั้น ${selected.length} คน`}</button>
   <p className="mt-4 text-xs text-slate-500">หากคนใดมีทะเบียนในปีปลายทางแล้ว ระบบจะยกเลิกทั้งชุด ไม่สร้างข้อมูลซ้ำ</p>
  </div>}
 </main>;
}
