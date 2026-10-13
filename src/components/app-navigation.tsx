'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {getYearSelection,resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
const adminItems=[
 ['/admin','ภาพรวม','⌂'],['/students','ทะเบียนนักเรียน','◉'],['/academic','ตั้งค่าปีการศึกษา','▦'],
 ['/academic/teachers','มอบหมายครู','♙'],['/curriculum','หลักสูตรและรายวิชา','▤'],
 ['/personnel','บุคลากร','♧'],['/students/promote','เลื่อนชั้นนักเรียน','↗']
];
const teacherItems=[['/teacher','งานสอนของฉัน','▤']];
export default function AppNavigation(){
 const pathname=usePathname(),router=useRouter();
 const [busy,setBusy]=useState(false),[open,setOpen]=useState(false);
 const [schoolId,setSchoolId]=useState(''),[years,setYears]=useState<{id:string;year_be:number;is_active:boolean}[]>([]),[currentYear,setCurrentYear]=useState('');
 useEffect(()=>{let live=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db)return;
  const {data:{user}}=await db.auth.getUser();if(!user||!live)return;
  const {data:members}=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('active',true).limit(1);
  if(!live||!members?.length)return;
  const school=members[0].school_id;setSchoolId(school);
  const {data:list}=await db.from('academic_years').select('id,year_be,is_active').eq('school_id',school).order('year_be',{ascending:false});
  if(!live)return;
  const available=list??[];setYears(available);
  setCurrentYear(resolveYear(available,school));
 })();return()=>{live=false;};},[pathname]);
 useEffect(()=>{if(!schoolId)return;
  function sync(e:Event){const d=(e as CustomEvent<{schoolId:string;yearId:string}>).detail;
   if(d?.schoolId===schoolId)setCurrentYear(d.yearId);}
  function storage(e:StorageEvent){if(e.key==='wichakan:year:'+schoolId)setCurrentYear(getYearSelection(schoolId));}
  window.addEventListener(YEAR_EVENT,sync);window.addEventListener('storage',storage);
  return()=>{window.removeEventListener(YEAR_EVENT,sync);window.removeEventListener('storage',storage);};
 },[schoolId]);
 const isTeacher=pathname.startsWith('/teacher');
 const isAdmin=['/admin','/personnel','/academic','/curriculum','/students'].some(x=>pathname.startsWith(x));
 const items=isTeacher?teacherItems:isAdmin?adminItems:[];
 async function signOut(){
  const db=getSupabaseBrowserClient();if(!db)return;
  setBusy(true);const {error}=await db.auth.signOut();setBusy(false);
  if(!error)router.replace('/login');
 }
 if(pathname==='/'||pathname==='/login')return null;
 const nav=<div className="space-y-1">
  {items.map(([url,label,symbol])=><Link key={url} href={url} onClick={()=>setOpen(false)}
   aria-current={pathname===url?'page':undefined}
   className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${pathname===url?'bg-blue-600 text-white shadow-sm':'text-slate-600 hover:bg-blue-50 hover:text-blue-800'}`}>
   <span aria-hidden="true" className="w-5 text-center text-lg leading-none">{symbol}</span>{label}</Link>)}
 </div>;
 return <div className="app-shell">
  <header className="app-topbar">
   <div className="flex min-w-0 items-center gap-3">
    {items.length>0&&<button onClick={()=>setOpen(x=>!x)} aria-expanded={open} aria-label="เปิดหรือปิดเมนู" className="rounded-lg border border-slate-200 px-3 py-2 text-lg lg:hidden">☰</button>}
    <Link href="/workspace" className="flex items-center gap-3">
     <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-xl font-bold text-white">W</div>
     <div><div className="text-lg font-extrabold leading-tight tracking-tight text-blue-950">Wichakan</div><div className="hidden text-xs text-slate-500 sm:block">ระบบบริหารจัดการสถานศึกษา</div></div>
    </Link>
   </div>
   <div className="hidden min-w-0 max-w-lg flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 md:flex">
    <span aria-hidden="true">⌕</span><span>เข้าถึงข้อมูลและเมนูได้จากแถบนำทางด้านซ้าย</span>
   </div>
   <div className="flex items-center gap-2">
    <Link href="/workspace" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 sm:text-sm">⇄ <span className="hidden sm:inline">สลับบทบาท</span><span className="sm:hidden">บทบาท</span></Link>
    <button onClick={signOut} disabled={busy} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">{busy?'กำลังออก...':'ออกจากระบบ'}</button>
   </div>
  </header>
  {items.length>0&&<>
   {open&&<button className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" aria-label="ปิดเมนู" onClick={()=>setOpen(false)}/>}
   <aside className={`app-sidebar ${open?'app-sidebar-open':''}`} aria-label="เมนูหลัก">
    <div className="mb-5 px-4 text-xs font-bold tracking-widest text-slate-400">{isTeacher?'TEACHER WORKSPACE':'ADMIN WORKSPACE'}</div>
    {nav}
    <div className="mt-8 border-t border-slate-100 pt-5"><Link href="/workspace" onClick={()=>setOpen(false)} className="block rounded-xl px-4 py-3 text-sm text-slate-500 hover:bg-slate-100">← เลือกพื้นที่ทำงาน</Link></div>
   </aside>
  </>}
 </div>;
}