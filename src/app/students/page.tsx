'use client';

import Link from 'next/link';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Student = { id: string; student_no: string; first_name_th: string; last_name_th: string; status: string; school_id: string };
type School = { id: string; name_th: string };
const statusLabel: Record<string,string> = {active:'กำลังศึกษา', transferred:'ย้ายออก', graduated:'จบการศึกษา', inactive:'พ้นสภาพ'};
const blank = { student_no:'', first_name_th:'', last_name_th:'' };

export default function StudentsPage() {
  const router = useRouter();
  const [schools,setSchools] = useState<School[]>([]);
  const [schoolId,setSchoolId] = useState('');
  const [students,setStudents] = useState<Student[]>([]);
  const [search,setSearch] = useState('');
  const [form,setForm] = useState(blank);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [canWrite,setCanWrite] = useState(false);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
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
      const [{data,error:queryError},{data:{user}}]=await Promise.all([
        db.from('students').select('id,student_no,first_name_th,last_name_th,status,school_id').eq('school_id',schoolId).order('student_no'),
        db.auth.getUser()
      ]);
      if(cancelled)return;
      if(queryError)setError(queryError.message);
      setStudents((data??[]) as Student[]);
      if(user){
        const {data:roles}=await db.from('school_memberships').select('role').eq('school_id',schoolId).eq('user_id',user.id).eq('active',true);
        if(!cancelled)setCanWrite((roles??[]).some(r=>['school_admin','registrar'].includes(r.role)));
      }
    })();
    return()=>{cancelled=true;};
  },[schoolId]);

  const visible=useMemo(()=>students.filter(s=>(s.student_no+' '+s.first_name_th+' '+s.last_name_th).toLocaleLowerCase().includes(search.toLocaleLowerCase())),[students,search]);

  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!canWrite||!schoolId)return;
    const db=getSupabaseBrowserClient();if(!db)return;
    setSaving(true);setError('');setInfo('');
    const payload={...form,student_no:form.student_no.trim(),first_name_th:form.first_name_th.trim(),last_name_th:form.last_name_th.trim()};
    const operation=editingId ? db.from('students').update(payload).eq('id',editingId).eq('school_id',schoolId) : db.from('students').insert({...payload,school_id:schoolId});
    const {error:writeError}=await operation;
    if(writeError){setError(writeError.message);}else{
      setForm(blank);setEditingId(null);setInfo(editingId?'แก้ไขข้อมูลสำเร็จ':'เพิ่มนักเรียนสำเร็จ');
      const {data,error:reloadError}=await db.from('students').select('id,student_no,first_name_th,last_name_th,status,school_id').eq('school_id',schoolId).order('student_no');
      if(reloadError)setError(reloadError.message);else setStudents((data??[]) as Student[]);
    }
    setSaving(false);
  }

  async function logout(){const db=getSupabaseBrowserClient();await db?.auth.signOut();router.replace('/login');}
  return <main className="mx-auto max-w-6xl px-5 py-8">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div><Link href="/" className="text-sm text-blue-700">← Wichakan</Link><h1 className="mt-2 text-3xl font-bold">ทะเบียนนักเรียน</h1><p className="mt-1 text-sm text-slate-500">Student Registry · v0.3</p><Link href="/students/history" className="mt-3 inline-block rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm text-blue-700">ประวัติการศึกษาและเลื่อนชั้น →</Link></div>
      <button onClick={logout} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm">ออกจากระบบ</button>
    </header>
    {loading ? <p>กำลังตรวจสอบสิทธิ์...</p> : <>
      {schools.length>1&&<label className="mb-5 block text-sm">โรงเรียน <select className="ml-2 rounded-xl border p-2" value={schoolId} onChange={e=>{setSchoolId(e.target.value);setEditingId(null);setForm(blank);}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>}
      {schools.length===1&&<p className="mb-5 font-medium">{schools[0].name_th}</p>}
      {schools.length===0&&<p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">บัญชีนี้ยังไม่ได้รับสิทธิ์จากโรงเรียน กรุณาติดต่อผู้ดูแลระบบ</p>}
      {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {info&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{info}</p>}
      {schoolId&&<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">รายชื่อนักเรียน ({visible.length})</h2><input aria-label="ค้นหานักเรียน" placeholder="ค้นหารหัส หรือชื่อ-สกุล" value={search} onChange={e=>setSearch(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"/></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">รหัส</th><th>ชื่อ-สกุล</th><th>สถานภาพ</th><th>จัดการ</th></tr></thead>
            <tbody>{visible.map(s=><tr key={s.id} className="border-b border-slate-100"><td className="py-3">{s.student_no}</td><td>{s.first_name_th} {s.last_name_th}</td><td>{statusLabel[s.status]??s.status}</td><td>{canWrite&&<button className="text-blue-700" onClick={()=>{setEditingId(s.id);setForm({student_no:s.student_no,first_name_th:s.first_name_th,last_name_th:s.last_name_th});}}>แก้ไข</button>}</td></tr>)}</tbody></table></div>
          {visible.length===0&&<p className="py-8 text-center text-sm text-slate-500">ไม่พบข้อมูลนักเรียน</p>}
        </section>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">{editingId?'แก้ไขข้อมูลนักเรียน':'เพิ่มนักเรียน'}</h2>
          {!canWrite?<p className="text-sm text-slate-500">บัญชีนี้ดูข้อมูลได้ แต่ไม่มีสิทธิ์เพิ่มหรือแก้ไข</p>:<form onSubmit={save} className="space-y-4">
            {([{field:'student_no',label:'รหัสนักเรียน'},{field:'first_name_th',label:'ชื่อ'},{field:'last_name_th',label:'นามสกุล'}] as const).map(({field,label})=><label key={field} className="block text-sm font-medium">{label}<input required maxLength={120} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label>)}
            <button disabled={saving} className="w-full rounded-xl bg-blue-800 p-3 font-medium text-white disabled:opacity-50">{saving?'กำลังบันทึก...':editingId?'บันทึกการแก้ไข':'เพิ่มนักเรียน'}</button>
            {editingId&&<button type="button" className="w-full text-sm text-slate-500" onClick={()=>{setEditingId(null);setForm(blank);}}>ยกเลิกการแก้ไข</button>}
          </form>}
        </aside>
      </div>}
    </>}
  </main>;
}
