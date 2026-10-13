'use client';

import Link from 'next/link';
import PageControls,{PAGE_SIZE} from '@/components/page-controls';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Year = { id: string; year_be: number; is_active: boolean };
type Term = { id: string; academic_year_id: string; term_no: number; starts_on: string | null; ends_on: string | null };
type Classroom = { id: string; academic_year_id: string; level_code: string; room_code: string };
type School = { id: string; name_th: string };
type Homeroom = { classroom_id:string;teacher_user_id:string };
type Enrollment = { classroom_id:string;student_id:string;status:string };
type Profile = { user_id:string;display_name:string };
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
  const [homerooms,setHomerooms]=useState<Homeroom[]>([]),[enrollments,setEnrollments]=useState<Enrollment[]>([]),[profiles,setProfiles]=useState<Profile[]>([]);
  const [year,setYear] = useState('2569');
  const [selectedYear,setSelectedYear] = useState('');
  const [termNo,setTermNo] = useState('1');
  const [start,setStart] = useState('');
  const [end,setEnd] = useState('');
  const [level,setLevel] = useState('ป.1');
  const [room,setRoom] = useState('1');
  const [section,setSection]=useState<'years'|'terms'|'rooms'>('rooms');
  const [roomQuery,setRoomQuery]=useState(''),[roomPage,setRoomPage]=useState(1),[yearPage,setYearPage]=useState(1);
  const [roomFormOpen,setRoomFormOpen]=useState(false),[levelFilter,setLevelFilter]=useState('');
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
    const [a,b,c,d,h,en]=await Promise.all([
      db.from('academic_years').select('id,year_be,is_active').eq('school_id',id).order('year_be',{ascending:false}),
      db.from('terms').select('id,academic_year_id,term_no,starts_on,ends_on').eq('school_id',id),
      db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',id),
      db.from('school_memberships').select('role').eq('school_id',id).eq('user_id',user.id).eq('active',true),
      db.from('homeroom_assignments').select('classroom_id,teacher_user_id').eq('school_id',id),
      db.from('enrollments').select('classroom_id,student_id,status').eq('school_id',id),
    ]);
    const problem=[a.error,b.error,c.error,d.error,h.error,en.error].find(Boolean);
    if(problem){setError(problem.message);return;}
    setYears(a.data??[]);setTerms(b.data??[]);setRooms(c.data??[]);setHomerooms(h.data??[]);setEnrollments(en.data??[]);
    const ids=[...new Set((h.data??[]).map(x=>x.teacher_user_id))];
    if(ids.length){const p=await db.from('profiles').select('user_id,display_name').in('user_id',ids);setProfiles(p.data??[]);}else setProfiles([]);
    setRoles((d.data??[]).map(m=>m.role));
    setSelectedYear(old=>resolveYear(a.data??[],id,old));
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
  useEffect(()=>{if(schoolId&&selectedYear)setYearSelection(schoolId,selectedYear);},[schoolId,selectedYear]);
  useEffect(()=>{if(!schoolId)return;
   const sync=(event:Event)=>{const detail=(event as CustomEvent<{schoolId:string;yearId:string}>).detail;
    if(detail?.schoolId===schoolId)setSelectedYear(y=>y===detail.yearId?y:detail.yearId);};
   window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);
  },[schoolId]);
  const db=getSupabaseBrowserClient();
  const selected=years.find(y=>y.id===selectedYear);
  const yearTerms=terms.filter(t=>t.academic_year_id===selectedYear).sort((a,b)=>a.term_no-b.term_no);
  const yearRooms=rooms.filter(r=>r.academic_year_id===selectedYear);
  const teacherName=(r:Classroom)=>{const teacher=homerooms.find(h=>h.classroom_id===r.id);return teacher?(profiles.find(p=>p.user_id===teacher.teacher_user_id)?.display_name??'ไม่พบชื่อครู'):'ยังไม่มอบหมาย';};
  const countStudents=(r:Classroom)=>new Set(enrollments.filter(e=>e.classroom_id===r.id&&e.status==='active').map(e=>e.student_id)).size;
  const filteredRooms=yearRooms.filter(r=>(!levelFilter||r.level_code===levelFilter)&&(r.level_code+'/'+r.room_code+' '+teacherName(r)).toLocaleLowerCase().includes(roomQuery.toLocaleLowerCase()));
  const visibleRooms=filteredRooms.slice((roomPage-1)*PAGE_SIZE,roomPage*PAGE_SIZE);
  const visibleYears=years.slice((yearPage-1)*PAGE_SIZE,yearPage*PAGE_SIZE);

  const yearName=selected?.year_be??'—';
  const roomLabel=(r:Classroom)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
  const formatDate=(date:string|null)=>date?new Date(date+'T00:00:00').toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'}):'ไม่ระบุ';
  const card='rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5';
  return <main className="mx-auto max-w-7xl px-4 pb-6 pt-4 sm:px-6">
   <header className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-[#daeeff] via-[#edf7ff] to-[#d4eaff] px-6 py-5 sm:py-6">
    <div className="relative z-10"><p className="text-xs font-semibold tracking-wide text-blue-600">WICHAKAN · ACADEMIC SETUP</p><h1 className="mt-1 text-2xl font-extrabold text-[#123b72] sm:text-3xl">ตั้งค่างานวิชาการ</h1><p className="mt-2 text-sm text-slate-600">จัดการปีการศึกษา ภาคเรียน และห้องเรียนได้อย่างเป็นระบบ ง่ายต่อการใช้งาน</p></div>
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 right-8 hidden rotate-[-12deg] text-[140px] leading-none text-blue-200/50 lg:block">▦</div>
   </header>
   {loading&&<p className="mt-4 text-sm">กำลังโหลด...</p>}
   {!loading&&schools.length===0&&<p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">บัญชีนี้ยังไม่ได้รับสิทธิ์ในโรงเรียน</p>}
   {schools.length>1&&<label className="mt-3 block text-sm">โรงเรียน <select className="ml-2 rounded-xl border p-2" value={schoolId} onChange={e=>{setSchoolId(e.target.value);setRoomPage(1);}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>}
   {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
   {message&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
   {schoolId&&<>
    <nav className="mt-4 flex gap-2 overflow-x-auto" aria-label="หัวข้อตั้งค่างานวิชาการ">
     {([['years','▣','ปีการศึกษา'],['terms','▤','ภาคเรียน'],['rooms','▦','ห้องเรียน']] as const).map(([key,icon,title])=><button key={key} type="button" onClick={()=>setSection(key)} aria-current={section===key?'page':undefined} className={`min-w-32 shrink-0 rounded-t-xl border border-b-2 px-5 py-3 text-sm font-semibold transition ${section===key?'border-blue-300 border-b-blue-600 bg-blue-50 text-blue-700':'border-slate-200 bg-white text-slate-600 hover:bg-blue-50'}`}><span aria-hidden="true" className="mr-2">{icon}</span>{title}</button>)}
    </nav>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)]">
     <div className={card}>
      {section==='rooms'&&<>
       <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-blue-950">ห้องเรียนในปีการศึกษา {yearName}</h2><p className="mt-1 text-xs text-slate-500">ข้อมูลห้องเรียน ครูประจำชั้น และจำนวนนักเรียน</p></div><button disabled={!canManage||!selectedYear} onClick={()=>setRoomFormOpen(true)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">＋ เพิ่มห้องเรียน</button></div>
       <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_135px]">
        <input aria-label="ค้นหาห้องเรียนหรือครู" value={roomQuery} onChange={e=>{setRoomQuery(e.target.value);setRoomPage(1);}} placeholder="⌕ ค้นหาห้องเรียน หรือชื่อครู" className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"/>
        <select aria-label="กรองระดับชั้น" className="rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm" value={levelFilter} onChange={e=>{setLevelFilter(e.target.value);setRoomPage(1);}}><option value="">ทุกระดับชั้น</option>{levels.map(l=><option key={l} value={l}>{l}</option>)}</select>
       </div>
       <div className="mt-4 max-h-[min(55vh,540px)] overflow-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[570px] text-left text-sm"><thead className="sticky top-0 z-10 bg-[#eff5fc] text-xs text-blue-900"><tr><th className="px-3 py-3">ระดับชั้น</th><th>ห้อง</th><th>ครูประจำชั้น</th><th className="text-right">นักเรียน</th><th className="text-right">จัดการ</th></tr></thead>
        <tbody>{visibleRooms.map(r=><tr key={r.id} className="border-t border-slate-100 hover:bg-blue-50/30"><td className="px-3 py-3 font-semibold">{r.level_code}</td><td>{roomLabel(r)}</td><td>{teacherName(r)}</td><td className="text-right tabular-nums">{countStudents(r)}</td><td className="pr-3 text-right"><Link href="/academic/teachers" className="text-xs font-semibold text-blue-700">มอบหมายครู →</Link></td></tr>)}</tbody></table>
        {!filteredRooms.length&&<p className="p-8 text-center text-sm text-slate-500">ไม่พบห้องเรียนของปีนี้</p>}
       </div>
       <PageControls total={filteredRooms.length} page={Math.min(roomPage,Math.max(1,Math.ceil(filteredRooms.length/PAGE_SIZE)))} onChange={setRoomPage}/>
      </>}
      {section==='years'&&<>
       <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold text-blue-950">ปีการศึกษาของโรงเรียน</h2><span className="text-xs text-slate-500">เลือกปีเพื่อดูข้อมูลโดยไม่เปลี่ยนปีปัจจุบัน</span></div>
       <div className="mt-4 max-h-[min(55vh,540px)] space-y-2 overflow-y-auto">{visibleYears.map(y=><div key={y.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${selectedYear===y.id?'border-blue-300 bg-blue-50':'border-slate-100'}`}><button type="button" onClick={()=>setSelectedYear(y.id)} className="text-left text-sm font-bold text-blue-900">ปีการศึกษา {y.year_be} {y.is_active&&<span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">กำลังใช้งาน</span>}</button>{canManage&&!y.is_active&&<button disabled={busy} onClick={()=>execute(()=>db!.rpc('activate_academic_year',{p_school_id:schoolId,p_year_id:y.id}),'เปลี่ยนปีการศึกษาปัจจุบันแล้ว')} className="text-xs font-semibold text-blue-700 disabled:opacity-40">ตั้งเป็นปีปัจจุบัน</button>}</div>)}{years.length===0&&<p className="text-sm text-slate-500">ยังไม่มีปีการศึกษา</p>}</div><PageControls total={years.length} page={Math.min(yearPage,Math.max(1,Math.ceil(years.length/PAGE_SIZE)))} onChange={setYearPage}/>
       {canManage&&<details className="mt-4 rounded-xl border border-blue-100 p-4"><summary className="cursor-pointer text-sm font-semibold text-blue-700">＋ เพิ่มปีการศึกษา</summary><div className="mt-3 flex gap-2"><input type="number" min="2500" max="2800" aria-label="ปีการศึกษา พ.ศ." className="min-w-0 flex-1 rounded-xl border px-3 py-2" value={year} onChange={e=>setYear(e.target.value)}/><button disabled={busy||Number(year)<2500||Number(year)>2800} onClick={()=>execute(()=>db!.from('academic_years').insert({school_id:schoolId,year_be:Number(year)}),'เพิ่มปีการศึกษาเรียบร้อย')} className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">บันทึก</button></div></details>}
      </>}
      {section==='terms'&&<>
       <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold text-blue-950">ภาคเรียน · ปี {yearName}</h2><Link className="text-sm font-semibold text-blue-700" href="/academic/templates">เตรียมปีใหม่ →</Link></div>
       <div className="mt-4 space-y-3">{yearTerms.map(t=><div key={t.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><h3 className="font-bold text-blue-900">ภาคเรียนที่ {t.term_no}</h3><p className="mt-2 text-sm text-slate-600">เริ่ม {formatDate(t.starts_on)} · สิ้นสุด {formatDate(t.ends_on)}</p></div>)}{yearTerms.length===0&&<p className="text-sm text-slate-500">ยังไม่มีภาคเรียนในปีนี้</p>}</div>
       {canManage&&<details className="mt-4 rounded-xl border border-blue-100 p-4"><summary className="cursor-pointer text-sm font-semibold text-blue-700">＋ เพิ่มภาคเรียน</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs">ภาคเรียน<select className="mt-1 w-full rounded-xl border p-3" value={termNo} onChange={e=>setTermNo(e.target.value)}><option value="1">ภาคเรียน 1</option><option value="2">ภาคเรียน 2</option><option value="3">ภาคเรียน 3</option></select></label><div/><label className="text-xs">วันเริ่ม<input type="date" className="mt-1 w-full rounded-xl border p-3" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="text-xs">วันสิ้นสุด<input type="date" className="mt-1 w-full rounded-xl border p-3" value={end} onChange={e=>setEnd(e.target.value)}/></label></div><button disabled={busy||!selectedYear||!!(start&&end&&end<start)} onClick={()=>execute(()=>db!.from('terms').insert({school_id:schoolId,academic_year_id:selectedYear,term_no:Number(termNo),starts_on:start||null,ends_on:end||null}),'เพิ่มภาคเรียนเรียบร้อย')} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">บันทึกภาคเรียน</button></details>}
      </>}
     </div>
     <aside className="min-w-0 space-y-4">
      <section className={card}>
       <h2 className="text-lg font-bold text-blue-950">▥ ภาพรวมปีการศึกษา</h2>
       <div className="mt-3 grid grid-cols-2 gap-2">
        {([{label:'ปีการศึกษา',value:String(yearName),icon:'▣'},{label:'ภาคเรียน',value:yearTerms.length+' ภาคเรียน',icon:'▤'},{label:'ห้องเรียนทั้งหมด',value:yearRooms.length+' ห้อง',icon:'▦'},{label:'นักเรียนในห้อง',value:String(new Set(enrollments.filter(e=>yearRooms.some(r=>r.id===e.classroom_id)&&e.status==='active').map(e=>e.student_id)).size)+' คน',icon:'◉'}] as const).map(item=><div key={item.label} className="rounded-xl bg-blue-50/60 p-3"><p className="text-xs text-slate-500">{item.icon} {item.label}</p><p className="mt-1 text-xl font-extrabold text-blue-900">{item.value}</p></div>)}
       </div>
       <p className="mt-3 text-xs text-slate-500">{selected?.is_active?'ปีการศึกษาปัจจุบันของโรงเรียน':'กำลังดูข้อมูลย้อนหลังหรือปีที่ยังไม่เปิดใช้งาน'}</p>
      </section>
      <section className={card}>
       <div className="flex items-center justify-between gap-2"><h2 className="font-bold text-blue-950">ปีการศึกษาและภาคเรียน</h2><button onClick={()=>setSection('years')} className="text-xs font-semibold text-blue-700">จัดการปี →</button></div>
       <label className="mt-3 block text-xs text-slate-500">ปีการศึกษาที่กำลังดู<select className="mt-1 w-full rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900" value={selectedYear} onChange={e=>{setSelectedYear(e.target.value);setRoomPage(1);}}><option value="">เลือกปีการศึกษา</option>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}{y.is_active?' (ปัจจุบัน)':''}</option>)}</select></label>
       <div className="mt-3 max-h-40 space-y-2 overflow-auto">{yearTerms.map(t=><div key={t.id} className="rounded-xl border border-slate-100 p-3 text-xs"><p className="font-semibold text-blue-900">ภาคเรียน {t.term_no}</p><p className="mt-1 text-slate-500">{formatDate(t.starts_on)} – {formatDate(t.ends_on)}</p></div>)}{yearTerms.length===0&&<p className="text-xs text-slate-500">ยังไม่มีข้อมูลภาคเรียน</p>}</div>
      </section>
      {section==='rooms'&&<section className={card}>
       <div className="flex items-center justify-between"><h2 className="font-bold text-blue-950">＋ เพิ่มห้องเรียน</h2>{roomFormOpen&&<button type="button" onClick={()=>setRoomFormOpen(false)} aria-label="ปิดแบบฟอร์ม" className="text-lg text-slate-400">×</button>}</div>
       {!roomFormOpen?<div className="mt-3"><p className="text-xs text-slate-500">เพิ่มห้องเรียนของปีการศึกษาที่เลือก โดยมอบหมายครูประจำชั้นแยกในเมนูมอบหมายครู</p><button disabled={!canManage||!selectedYear} type="button" onClick={()=>setRoomFormOpen(true)} className="mt-3 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40">เพิ่มห้องเรียน</button></div>:<div className="mt-3 space-y-3"><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">ระดับชั้น<select className="mt-1 w-full rounded-xl border p-3" value={level} onChange={e=>setLevel(e.target.value)}>{levels.map(l=><option key={l} value={l}>{l}</option>)}</select></label><label className="text-xs font-medium">ห้อง<input className="mt-1 w-full rounded-xl border p-3" maxLength={12} placeholder="เช่น 1" value={room} onChange={e=>setRoom(e.target.value)}/></label></div><p className="text-xs text-slate-500">ครูประจำชั้นสามารถมอบหมายได้หลังบันทึกห้องเรียน</p><div className="flex justify-end gap-2"><button onClick={()=>setRoomFormOpen(false)} className="rounded-xl border px-4 py-2 text-sm">ยกเลิก</button><button disabled={!canManage||busy||!selectedYear||!room.trim()} onClick={async()=>{await execute(()=>db!.from('classrooms').insert({school_id:schoolId,academic_year_id:selectedYear,level_code:level,room_code:room.trim()}),'เพิ่มห้องเรียนเรียบร้อย');}} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">บันทึกห้องเรียน</button></div></div>}
       <Link className="mt-3 inline-block text-xs font-semibold text-blue-700" href="/academic/teachers">ไปมอบหมายครูประจำชั้น →</Link>
      </section>}
      <div className="flex flex-wrap gap-3 text-xs"><Link href="/academic/templates" className="font-semibold text-blue-700">แม่แบบห้องเรียน →</Link><Link href="/students/history" className="font-semibold text-blue-700">จัดนักเรียนเข้าห้อง →</Link></div>
     </aside>
    </div>
   </>}
  </main>;
}
