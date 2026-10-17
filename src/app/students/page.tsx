'use client';
import PageHeader from '@/components/page-header';

import Link from 'next/link';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import {resolveYear,YEAR_EVENT,setYearSelection} from '@/lib/academic-year-selection';
import PageControls,{PAGE_SIZE} from '@/components/page-controls';

type Student = { id: string; student_no: string; name_prefix_th:string|null; first_name_th: string; last_name_th: string; status: string; school_id: string };
type School = { id: string; name_th: string };
type Year={id:string;year_be:number;is_active:boolean};
type Room={id:string;academic_year_id:string;level_code:string;room_code:string};
type Enrollment={student_id:string;academic_year_id:string;classroom_id:string;status:string};
const statusLabel: Record<string,string> = {active:'กำลังศึกษา', transferred:'ย้ายออก', graduated:'จบการศึกษา', inactive:'พ้นสภาพ'};
const blank = { student_no:'', name_prefix_th:'', first_name_th:'', last_name_th:'' };

export default function StudentsPage() {
  const router = useRouter();
  const [schools,setSchools] = useState<School[]>([]);
  const [schoolId,setSchoolId] = useState('');
  const [students,setStudents] = useState<Student[]>([]);
  const [years,setYears]=useState<Year[]>([]),[rooms,setRooms]=useState<Room[]>([]),[enrollments,setEnrollments]=useState<Enrollment[]>([]);
  const [yearId,setYearId]=useState(''),[roomId,setRoomId]=useState('all'),[page,setPage]=useState(1);
  const [search,setSearch] = useState('');
  const [form,setForm] = useState(blank);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [canWrite,setCanWrite] = useState(false);
  const [isAdmin,setIsAdmin]=useState(false),[adminPassword,setAdminPassword]=useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [removing,setRemoving]=useState<Student|null>(null),[confirmNo,setConfirmNo]=useState('');
  const [changingStatus,setChangingStatus]=useState<Student|null>(null),[nextStatus,setNextStatus]=useState('active');
  const [error,setError] = useState('');
  const [info,setInfo] = useState('');

  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      const db=getSupabaseBrowserClient();
      if(!db){setError('ยังไม่ได้ตั้งค่า Supabase');setLoading(false);return;}
      const {data:{user}}=await db.auth.getUser();
      if(cancelled)return;
      if(!user){router.replace('/login');return;}
      const {data:memberships,error:membershipError}=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
      if(cancelled)return;
      if(membershipError){setError(membershipError.message);setLoading(false);return;}
      const schoolMap=new Map<string,School>();
      (memberships??[]).forEach((m)=>{
        const school = m.schools as unknown as School|null;
        if(school)schoolMap.set(school.id,school);
      });
      const list=[...schoolMap.values()];
      setSchools(list);setSchoolId(list[0]?.id??'');setLoading(false);
    })();
    return ()=>{cancelled=true;};
  },[router]);

  useEffect(()=>{
    if(!schoolId)return;
    let cancelled=false;
    (async()=>{
      const db=getSupabaseBrowserClient();
      if(!db)return;
      setError('');
      const [{data,error:queryError},{data:{user}},y,r,en]=await Promise.all([
        db.from('students').select('id,student_no,name_prefix_th,first_name_th,last_name_th,status,school_id').eq('school_id',schoolId).order('student_no'),
        db.auth.getUser(),
        db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('year_be',{ascending:false}),
        db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',schoolId),
        db.from('enrollments').select('student_id,academic_year_id,classroom_id,status').eq('school_id',schoolId)
      ]);
      if(cancelled)return;
      const issue=queryError??y.error??r.error??en.error;
      if(issue)setError(issue.message);
      setYears(y.data??[]);setRooms(r.data??[]);setEnrollments(en.data??[]);
      setYearId(prev=>resolveYear(y.data??[],schoolId,prev));
      setStudents((data??[]) as Student[]);
      if(user){
        const {data:roles}=await db.from('school_memberships').select('role').eq('school_id',schoolId).eq('user_id',user.id).eq('active',true);
        if(!cancelled){setCanWrite((roles??[]).some(r=>['school_admin','registrar'].includes(r.role)));setIsAdmin((roles??[]).some(r=>r.role==='school_admin'));}
      }
    })();
    return()=>{cancelled=true;};
  },[schoolId]);

  useEffect(()=>{if(schoolId&&yearId)setYearSelection(schoolId,yearId);},[schoolId,yearId]);
  useEffect(()=>{if(!schoolId)return;
    const sync=(event:Event)=>{const detail=(event as CustomEvent<{schoolId:string;yearId:string}>).detail;
      if(detail?.schoolId===schoolId){setYearId(detail.yearId);setRoomId('all');setPage(1);}};
    window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);
  },[schoolId]);
  const yearRooms=rooms.filter(r=>r.academic_year_id===yearId);
  const currentEnrollments=enrollments.filter(e=>e.academic_year_id===yearId&&['active','completed'].includes(e.status));
  const studentRoom=new Map(currentEnrollments.map(e=>[e.student_id,e.classroom_id]));
  const roomLabel=(id:string)=>{const r=rooms.find(x=>x.id===id);return r?(r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code):'ยังไม่ลงทะเบียนปีนี้';};
  const visible=useMemo(()=>students.filter(s=>{
    const match=(s.student_no+' '+s.first_name_th+' '+s.last_name_th).toLocaleLowerCase().includes(search.toLocaleLowerCase());
    const assigned=studentRoom.get(s.id);
    return match&&(roomId==='all'||(roomId==='unassigned'?!assigned:assigned===roomId));
  }),[students,search,roomId,enrollments,yearId]);
  const paginated=visible.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const unassignedCount=students.filter(s=>s.status==='active'&&!studentRoom.has(s.id)).length;

  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!canWrite||!schoolId)return;
    const db=getSupabaseBrowserClient();if(!db)return;
    setSaving(true);setError('');setInfo('');
    const payload={...form,name_prefix_th:form.name_prefix_th.trim()||null,student_no:form.student_no.trim(),first_name_th:form.first_name_th.trim(),last_name_th:form.last_name_th.trim()};
    const operation=editingId ? db.from('students').update(payload).eq('id',editingId).eq('school_id',schoolId) : db.from('students').insert({...payload,school_id:schoolId});
    const {error:writeError}=await operation;
    if(writeError){setError(writeError.message);}else{
      setForm(blank);setEditingId(null);setInfo(editingId?'แก้ไขข้อมูลสำเร็จ':'เพิ่มนักเรียนสำเร็จ');
      const {data,error:reloadError}=await db.from('students').select('id,student_no,name_prefix_th,first_name_th,last_name_th,status,school_id').eq('school_id',schoolId).order('student_no');
      if(reloadError)setError(reloadError.message);else setStudents((data??[]) as Student[]);
    }
    setSaving(false);
  }

  async function removeStudent(){
    if(!canWrite||!schoolId||!removing||saving||confirmNo!==removing.student_no)return;
    const db=getSupabaseBrowserClient();if(!db)return;
    setSaving(true);setError('');setInfo('');
    const {error:e}=await db.rpc('remove_unused_student',{p_student_id:removing.id,p_school_id:schoolId});
    if(e)setError(e.message);
    else{setStudents(prev=>prev.filter(s=>s.id!==removing.id));setInfo('ลบรายการที่ไม่มีประวัติสำเร็จ');setRemoving(null);setConfirmNo('');setEditingId(null);}
    setSaving(false);
  }
  async function adminPurgeStudent(){
    if(!isAdmin||!schoolId||!removing||saving||confirmNo!==removing.student_no||!adminPassword)return;
    const db=getSupabaseBrowserClient();if(!db)return;
    setSaving(true);setError('');setInfo('');
    try{
      const {data:{user}}=await db.auth.getUser();
      if(!user?.email)throw new Error('ไม่พบอีเมลบัญชีผู้ดูแลระบบ');
      const {error:authError}=await db.auth.signInWithPassword({email:user.email,password:adminPassword});
      if(authError)throw new Error('รหัสผ่านบัญชี Admin ไม่ถูกต้อง');
      const {error:deleteError}=await db.rpc('admin_delete_student_with_history',{p_school_id:schoolId,p_student_id:removing.id});
      if(deleteError)throw new Error(deleteError.message);
      setStudents(prev=>prev.filter(s=>s.id!==removing.id));
      setEnrollments(prev=>prev.filter(e=>e.student_id!==removing.id));
      setRemoving(null);setConfirmNo('');setEditingId(null);
      setInfo('ผู้ดูแลระบบลบนักเรียนและประวัติที่เกี่ยวข้องเรียบร้อยแล้ว');
    }catch(e){setError(e instanceof Error?e.message:'ไม่สามารถลบข้อมูลได้');}
    finally{setAdminPassword('');setSaving(false);}
  }
  async function updateStudentStatus(){
    if(!canWrite||!schoolId||!changingStatus||saving)return;
    const db=getSupabaseBrowserClient();if(!db)return;
    setSaving(true);setError('');setInfo('');
    const {error:e}=await db.rpc('change_student_registry_status',{p_student_id:changingStatus.id,p_school_id:schoolId,p_status:nextStatus});
    if(e)setError(e.message);else{setStudents(prev=>prev.map(s=>s.id===changingStatus.id?{...s,status:nextStatus}:s));setInfo('เปลี่ยนสถานภาพเรียบร้อยแล้ว');setChangingStatus(null);}
    setSaving(false);
  }
  return <main className="wichakan-page mx-auto max-w-6xl px-5 py-8">
    <PageHeader title="ทะเบียนนักเรียน" actions={<><Link href="/students/import" className="ui-primary">นำเข้าจาก DMC</Link><Link href="/students/history" className="ui-secondary">ประวัติการศึกษา</Link></>}/>
    {loading ? <p>กำลังตรวจสอบสิทธิ์...</p> : <>
      {schools.length>1&&<p role="alert" className="mb-5 text-sm text-amber-700">พบสิทธิ์หลายโรงเรียน กรุณาติดต่อผู้ดูแลระบบก่อนดำเนินการ</p>}
      {schools.length===1&&<p className="mb-5 font-medium">{schools[0].name_th}</p>}
      {schools.length===0&&<p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">บัญชีนี้ยังไม่ได้รับสิทธิ์จากโรงเรียน กรุณาติดต่อผู้ดูแลระบบ</p>}
      {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {info&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{info}</p>}
      {removing&&<div role="dialog" aria-modal="true" aria-label="ยืนยันลบนักเรียน" className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 p-5">
       <h2 className="font-bold text-red-900">ยืนยันลบนักเรียนที่เพิ่มผิด</h2>
       <p className="mt-2 text-sm text-red-800">{removing.first_name_th} {removing.last_name_th} ({removing.student_no})</p>
       <p className="mt-2 text-xs text-red-700">ฝ่ายทะเบียนลบได้เฉพาะนักเรียนที่ไม่มีประวัติ ผู้ดูแลระบบสามารถยืนยันด้วยรหัสผ่านบัญชี Admin เพื่อสั่งลบพร้อมประวัติการลงทะเบียนและข้อมูลเชื่อมโยง โดยมีบันทึกการลบแยกต่างหาก</p>
       <label className="mt-3 block text-sm">พิมพ์รหัสนักเรียนเพื่อยืนยัน<input autoFocus value={confirmNo} onChange={e=>setConfirmNo(e.target.value)} className="mt-2 w-full max-w-xs rounded-xl border p-3" placeholder={removing.student_no}/></label>
       {isAdmin&&<label className="mt-3 block text-sm">รหัสผ่านบัญชี Admin<input type="password" autoComplete="current-password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} className="mt-2 w-full max-w-xs rounded-xl border p-3" placeholder="ใส่รหัสผ่านเพื่อยืนยันสิทธิ์"/></label>}
       <div className="mt-3 flex gap-3"><button type="button" onClick={()=>{setRemoving(null);setConfirmNo('');setAdminPassword('');}} className="rounded-xl border px-4 py-2 text-sm">ยกเลิก</button><button type="button" disabled={saving||confirmNo!==removing.student_no||(isAdmin&&!adminPassword)} onClick={isAdmin?adminPurgeStudent:removeStudent} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{isAdmin?'ยืนยันลบโดย Admin':'ยืนยันลบถาวร'}</button></div>
      </div>}
      {changingStatus&&<div role="dialog" aria-modal="true" aria-label="เปลี่ยนสถานภาพนักเรียน" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
       <h2 className="font-bold">เปลี่ยนสถานภาพ: {changingStatus.first_name_th} {changingStatus.last_name_th}</h2>
       <label className="mt-3 block text-sm">สถานภาพ<select value={nextStatus} onChange={e=>setNextStatus(e.target.value)} className="mt-2 w-full max-w-xs rounded-xl border p-3">{Object.entries(statusLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
       <p className="mt-2 text-xs text-slate-500">เปลี่ยนสถานภาพทะเบียนโดยเก็บประวัติการลงทะเบียนห้องเรียนเดิมไว้</p>
       <div className="mt-3 flex gap-3"><button type="button" onClick={()=>setChangingStatus(null)} className="rounded-xl border px-4 py-2 text-sm">ยกเลิก</button><button type="button" disabled={saving||nextStatus===changingStatus.status} onClick={updateStudentStatus} className="ui-primary rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40">บันทึกสถานภาพ</button></div>
      </div>}
      {schoolId&&<>
      <section className="ui-panel mb-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
       <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-xs font-semibold text-slate-600">ปีการศึกษา<select aria-label="ปีการศึกษาของรายชื่อนักเรียน" className="mt-1 w-full rounded-xl border p-3 text-sm" value={yearId} onChange={e=>{setYearId(e.target.value);setRoomId('all');setPage(1);}}><option value="">เลือกปี</option>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
        <label className="block text-xs font-semibold text-slate-600">ห้องเรียน<select aria-label="กรองตามห้องเรียน" className="mt-1 w-full rounded-xl border p-3 text-sm" value={roomId} onChange={e=>{setRoomId(e.target.value);setPage(1);}}><option value="all">ทุกห้องเรียน</option><option value="unassigned">ยังไม่ลงทะเบียนปีนี้</option>{yearRooms.map(r=><option key={r.id} value={r.id}>{roomLabel(r.id)}</option>)}</select></label>
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">นักเรียนสถานะกำลังศึกษา<br/><strong>{unassignedCount} คน</strong> ยังไม่มีห้องในปีที่เลือก</div>
       </div>

      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="ui-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">รายชื่อนักเรียน ({visible.length})</h2><input aria-label="ค้นหานักเรียน" placeholder="ค้นหารหัส หรือชื่อ-สกุล" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></div>
          <div className="max-h-[min(58vh,560px)] overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">รหัส</th><th>ชื่อ-สกุล</th><th>ห้องเรียน</th><th>สถานภาพ</th><th>จัดการ</th></tr></thead>
            <tbody>{paginated.map(s=><tr key={s.id} className="border-b border-slate-100"><td className="py-3">{s.student_no}</td><td>{s.name_prefix_th??''}{s.first_name_th} {s.last_name_th}</td><td className="whitespace-nowrap">{studentRoom.has(s.id)?roomLabel(studentRoom.get(s.id)!):<span className="text-amber-700">ยังไม่จัดห้อง</span>}</td><td>{statusLabel[s.status]??s.status}</td><td>{canWrite&&<div className="flex flex-wrap gap-2"><button className="text-blue-700" onClick={()=>{setEditingId(s.id);setForm({student_no:s.student_no,name_prefix_th:s.name_prefix_th??'',first_name_th:s.first_name_th,last_name_th:s.last_name_th});}}>แก้ไข</button><button type="button" className="text-amber-700" onClick={()=>{setChangingStatus(s);setNextStatus(s.status);}}>สถานภาพ</button><button type="button" className="text-red-700" onClick={()=>{setRemoving(s);setConfirmNo('');setAdminPassword('');}}>ลบ</button></div>}</td></tr>)}</tbody></table></div>
          {visible.length===0&&<p className="py-8 text-center text-sm text-slate-500">ไม่พบข้อมูลนักเรียน</p>}
          <PageControls total={visible.length} page={Math.min(page,Math.max(1,Math.ceil(visible.length/PAGE_SIZE)))} onChange={setPage}/>
          <Link href="/students/history" className="mt-3 inline-block text-sm font-medium text-blue-700">จัดการลงทะเบียนและย้ายห้อง →</Link>
        </section>
        <aside className="ui-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">{editingId?'แก้ไขข้อมูลนักเรียน':'เพิ่มนักเรียน'}</h2>
          {!canWrite?<p className="text-sm text-slate-500">บัญชีนี้ดูข้อมูลได้ แต่ไม่มีสิทธิ์เพิ่มหรือแก้ไข</p>:<form onSubmit={save} className="space-y-4">
            <label className="block text-sm font-medium">คำนำหน้าชื่อ<select value={form.name_prefix_th} onChange={e=>setForm(prev=>({...prev,name_prefix_th:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-300 p-3"><option value="">ยังไม่ระบุ</option>{['เด็กชาย','เด็กหญิง','นาย','นางสาว','นาง'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
            {([{field:'student_no',label:'รหัสนักเรียน'},{field:'first_name_th',label:'ชื่อ'},{field:'last_name_th',label:'นามสกุล'}] as const).map(({field,label})=><label key={field} className="block text-sm font-medium">{label}<input required maxLength={120} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label>)}
            <button disabled={saving} className="ui-primary w-full rounded-xl bg-blue-800 p-3 font-medium text-white disabled:opacity-50">{saving?'กำลังบันทึก...':editingId?'บันทึกการแก้ไข':'เพิ่มนักเรียน'}</button>
            {editingId&&<button type="button" className="w-full text-sm text-slate-500" onClick={()=>{setEditingId(null);setForm(blank);}}>ยกเลิกการแก้ไข</button>}
          </form>}
        </aside>
      </div></>}
    </>}
  </main>;
}
