'use client';

import Link from 'next/link';
import PageControls,{PAGE_SIZE} from '@/components/page-controls';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Year = { id: string; year_be: number; is_active: boolean };
type Term = { id: string; academic_year_id: string; term_no: number; starts_on: string | null; ends_on: string | null };
type Classroom = { id: string; academic_year_id: string; level_code: string; room_code: string };
type School = { id: string; name_th: string };
type Membership = { school_id: string; role: string; schools: School | null };

const levels = ['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3'];

export default function AcademicSetupPage() {
  const router = useRouter();
  const [schools,setSchools] = useState<School[]>([]);
  const [schoolId,setSchoolId] = useState('');
  const [roles,setRoles] = useState<string[]>([]);
  const [years,setYears] = useState<Year[]>([]);
  const [terms,setTerms] = useState<Term[]>([]);
  const [rooms,setRooms] = useState<Classroom[]>([]);
  const [year,setYear] = useState('2569');
  const [selectedYear,setSelectedYear] = useState('');
  const [termNo,setTermNo] = useState('1');
  const [start,setStart] = useState('');
  const [end,setEnd] = useState('');
  const [level,setLevel] = useState('ป.1');
  const [room,setRoom] = useState('1');
  const [roomQuery,setRoomQuery]=useState(''),[roomPage,setRoomPage]=useState(1),[yearPage,setYearPage]=useState(1);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const canManage=roles.some(r=>r==='school_admin'||r==='academic');

  const load = useCallback(async(id:string)=>{
    const db=getSupabaseBrowserClient();
    if(!db)return;
    const {data:{user}}=await db.auth.getUser();
    if(!user){router.replace('/login');return;}
    const [a,b,c,d]=await Promise.all([
      db.from('academic_years').select('id,year_be,is_active').eq('school_id',id).order('year_be',{ascending:false}),
      db.from('terms').select('id,academic_year_id,term_no,starts_on,ends_on').eq('school_id',id),
      db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',id),
      db.from('school_memberships').select('role').eq('school_id',id).eq('user_id',user.id).eq('active',true),
    ]);
    const problem=[a.error,b.error,c.error,d.error].find(Boolean);
    if(problem){setError(problem.message);return;}
    setYears(a.data??[]);setTerms(b.data??[]);setRooms(c.data??[]);
    setRoles((d.data??[]).map(m=>m.role));
    setSelectedYear(old=>(a.data??[]).some(y=>y.id===old)?old:a.data?.[0]?.id??'');
  },[router]);

  useEffect(()=>{
    let live=true;
    (async()=>{
      const db=getSupabaseBrowserClient();
      if(!db){setError('ยังไม่พบการตั้งค่า Supabase');setLoading(false);return;}
      const {data:{user}}=await db.auth.getUser();
      if(!live)return;
      if(!user){router.replace('/login');return;}
      const {data,error:e}=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
      if(!live)return;
      if(e){setError(e.message);setLoading(false);return;}
      const list=[...new Map(((data??[]) as unknown as Membership[]).filter(m=>m.schools).map(m=>[m.school_id,m.schools!])).values()];
      setSchools(list);setSchoolId(list[0]?.id??'');setLoading(false);
    })();
    return()=>{live=false;};
  },[router]);

  useEffect(()=>{if(schoolId){setError('');setSelectedYear('');void load(schoolId);}},[schoolId,load]);

  async function execute(action:()=>PromiseLike<{error:{message:string}|null}>,success:string){
    if(!schoolId||busy||!canManage)return;
    setBusy(true);setError('');setMessage('');
    try{
      const result=await action();
      if(result.error)setError(result.error.message);
      else{await load(schoolId);setMessage(success);}
    }catch(e){setError(e instanceof Error?e.message:'การบันทึกไม่สำเร็จ');}
    finally{setBusy(false);}
  }
  const db=getSupabaseBrowserClient();
  const selected=years.find(y=>y.id===selectedYear);
  const yearTerms=terms.filter(t=>t.academic_year_id===selectedYear).sort((a,b)=>a.term_no-b.term_no);
  const yearRooms=rooms.filter(r=>r.academic_year_id===selectedYear);
  const filteredRooms=yearRooms.filter(r=>(r.level_code+'/'+r.room_code).toLocaleLowerCase().includes(roomQuery.toLocaleLowerCase()));
  const visibleRooms=filteredRooms.slice((roomPage-1)*PAGE_SIZE,roomPage*PAGE_SIZE);
  const visibleYears=years.slice((yearPage-1)*PAGE_SIZE,yearPage*PAGE_SIZE);
  return <main className="mx-auto max-w-6xl px-5 py-8">
    <Link href="/" className="text-sm text-blue-700">← Wichakan</Link>
    <div className="mb-7 mt-3"><h1 className="text-3xl font-bold">ตั้งค่างานวิชาการ</h1><Link href="/academic/teachers" className="ml-3 mt-3 inline-block rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm text-blue-800">มอบหมายครู →</Link><Link href="/academic/templates" className="mt-3 inline-block rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm text-blue-800">แม่แบบห้องเรียน · เตรียมปีใหม่ →</Link><p className="mt-2 text-sm text-slate-500">Academic Setup · ปีการศึกษา ภาคเรียน และห้องเรียน</p></div>
    {loading&&<p>กำลังโหลด...</p>}
    {!loading&&schools.length===0&&<p className="rounded-xl bg-amber-50 p-4">บัญชีนี้ยังไม่ได้รับสิทธิ์ในโรงเรียน</p>}
    {schools.length>1&&<label className="mb-6 block text-sm">โรงเรียน <select value={schoolId} onChange={e=>setSchoolId(e.target.value)} className="ml-2 rounded-xl border p-2">{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>}
    {schools.length===1&&<p className="mb-5 font-semibold">{schools[0].name_th}</p>}
    {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {schoolId&&<div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">ปีการศึกษา</h2>
        <p className="mt-1 text-xs text-slate-500">จัดเก็บแยกปีเพื่อรักษาประวัติผลการเรียน</p>
        <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50/30 p-3"><summary className="cursor-pointer text-sm font-semibold text-blue-800">+ เพิ่มปีการศึกษา</summary><div className="mt-4 flex gap-2">
          <input type="number" min="2500" max="2800" aria-label="ปีการศึกษา พ.ศ." value={year} onChange={e=>setYear(e.target.value)} className="min-w-0 flex-1 rounded-xl border p-3" />
          <button disabled={!canManage||busy||!year||Number(year)<2500||Number(year)>2800} onClick={()=>execute(()=>db!.from('academic_years').insert({school_id:schoolId,year_be:Number(year)}),'เพิ่มปีการศึกษาเรียบร้อย')} className="rounded-xl bg-blue-800 px-4 text-white disabled:opacity-40">เพิ่มปี</button>
        </div></details>
        <div className="mt-5 space-y-2">
          {visibleYears.map(y=><div key={y.id} className="flex items-center justify-between rounded-xl border p-3">
            <button onClick={()=>setSelectedYear(y.id)} className={selectedYear===y.id?'font-bold text-blue-800':'text-slate-600'}>พ.ศ. {y.year_be} {y.is_active?'· ปัจจุบัน':''}</button>
            {!y.is_active&&canManage&&<button disabled={busy} onClick={()=>execute(()=>db!.rpc('activate_academic_year',{p_school_id:schoolId,p_year_id:y.id}),'กำหนดปีการศึกษาปัจจุบันแล้ว')} className="text-sm text-blue-700 disabled:opacity-40">ตั้งเป็นปีปัจจุบัน</button>}
          </div>)}
          {years.length===0&&<p className="text-sm text-slate-500">ยังไม่มีปีการศึกษา</p>}
        </div>
        <PageControls total={years.length} page={Math.min(yearPage,Math.max(1,Math.ceil(years.length/PAGE_SIZE)))} onChange={setYearPage}/>
      </section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">ภาคเรียน</h2>
        <p className="mt-1 text-sm text-slate-500">ปี พ.ศ. {selected?.year_be??'—'}</p>
        <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50/30 p-3"><summary className="cursor-pointer text-sm font-semibold text-blue-800">+ เพิ่มภาคเรียน</summary><div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm">ภาคเรียน<select value={termNo} onChange={e=>setTermNo(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="1">ภาคเรียน 1</option><option value="2">ภาคเรียน 2</option><option value="3">ภาคเรียน 3</option></select></label>
          <div/>
          <label className="text-sm">เริ่มเรียน<input type="date" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
          <label className="text-sm">สิ้นสุด<input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
        </div>
        <button disabled={!canManage||busy||!selectedYear||!!(start&&end&&end<start)} onClick={()=>execute(()=>db!.from('terms').insert({school_id:schoolId,academic_year_id:selectedYear,term_no:Number(termNo),starts_on:start||null,ends_on:end||null}),'เพิ่มภาคเรียนเรียบร้อย')} className="mt-4 rounded-xl bg-blue-800 px-4 py-3 text-sm text-white disabled:opacity-40">เพิ่มภาคเรียน</button></details>
        <div className="mt-4 space-y-2">{yearTerms.map(t=><div key={t.id} className="rounded-xl bg-slate-50 p-3 text-sm">ภาคเรียน {t.term_no} · {t.starts_on||'ไม่ระบุ'} ถึง {t.ends_on||'ไม่ระบุ'}</div>)}</div>
      </section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2">
        <h2 className="text-xl font-bold">ห้องเรียน</h2><p className="mt-1 text-sm text-slate-500">ปี พ.ศ. {selected?.year_be??'—'} · {yearRooms.length} ห้อง</p>
        <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50/30 p-3"><summary className="cursor-pointer text-sm font-semibold text-blue-800">+ เพิ่มห้องเรียน</summary><div className="mt-4 flex flex-wrap gap-3">
          <select value={level} onChange={e=>setLevel(e.target.value)} aria-label="ระดับชั้น" className="rounded-xl border p-3">{levels.map(l=><option key={l} value={l}>{l}</option>)}</select>
          <input value={room} onChange={e=>setRoom(e.target.value)} maxLength={12} aria-label="หมายเลขห้อง" className="w-28 rounded-xl border p-3" placeholder="ห้อง"/>
          <button disabled={!canManage||busy||!selectedYear||!room.trim()} onClick={()=>execute(()=>db!.from('classrooms').insert({school_id:schoolId,academic_year_id:selectedYear,level_code:level,room_code:room.trim()}),'เพิ่มห้องเรียนเรียบร้อย')} className="rounded-xl bg-blue-800 px-5 text-white disabled:opacity-40">เพิ่มห้อง</button>
        </div></details>
        <input aria-label="ค้นหาห้องเรียน" value={roomQuery} onChange={e=>{setRoomQuery(e.target.value);setRoomPage(1);}} placeholder="ค้นหาห้องเรียน เช่น ป.4/1" className="mt-5 w-full rounded-xl border p-3 text-sm"/>
        <div className="mt-4 flex flex-wrap gap-2">{visibleRooms.map(r=><span key={r.id} className="rounded-xl border bg-slate-50 px-4 py-2 text-sm">{r.room_code.startsWith(r.level_code+"/")?r.room_code:`${r.level_code}/${r.room_code}`}</span>)}{yearRooms.length===0&&<p className="text-sm text-slate-500">ยังไม่มีห้องเรียน</p>}</div>
        <PageControls total={filteredRooms.length} page={Math.min(roomPage,Math.max(1,Math.ceil(filteredRooms.length/PAGE_SIZE)))} onChange={setRoomPage}/>
        <Link href="/students/history" className="mt-6 inline-block text-sm font-medium text-blue-700">ไปจัดนักเรียนเข้าห้องเรียน →</Link>
      </section>
      {!canManage&&<p className="text-sm text-slate-500">บัญชีนี้อ่านข้อมูลได้ แต่ไม่มีสิทธิ์จัดการปีการศึกษาและห้องเรียน</p>}
    </div>}
  </main>;
}
