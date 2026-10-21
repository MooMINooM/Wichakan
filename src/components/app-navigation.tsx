'use client';
import Link from 'next/link';
import WichakanBrand from '@/components/wichakan-brand';
import {AcademicIcon} from '@/components/academic-visuals';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {getYearSelection,resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type NavItem={href:string;label:string;icon:Parameters<typeof AcademicIcon>[0]['name'];match?:string};
type NavSection={title:string;items:NavItem[]};
const adminSections:NavSection[]=[
 {title:'ภาพรวม',items:[{href:'/admin',label:'ภาพรวมสถานศึกษา',icon:'home'}]},
 {title:'งานวิชาการ',items:[
  {href:'/academic',label:'ปีการศึกษาและห้องเรียน',icon:'calendar',match:'/academic'},
  {href:'/curriculum',label:'หลักสูตรและรายวิชา',icon:'book'},
  {href:'/academic/teachers',label:'มอบหมายครูผู้สอน',icon:'users'},
  {href:'/academic/timetable',label:'จัดตารางสอน',icon:'calendar'},
  {href:'/academic/timetable/rules',label:'เงื่อนไขตารางสอน',icon:'settings'},
  {href:'/academic/timetable/activities',label:'ตารางกิจกรรม',icon:'calendar'},
  {href:'/academic/templates',label:'เตรียมปีการศึกษาใหม่',icon:'promote'}
 ]},
 {title:'ทะเบียนนักเรียน',items:[
  {href:'/students',label:'ข้อมูลนักเรียน',icon:'users'},
  {href:'/students/history',label:'จัดนักเรียนเข้าห้อง',icon:'school'},
  {href:'/students/promote',label:'เลื่อนชั้นนักเรียน',icon:'promote'}
 ]},
 {title:'บุคลากรและผู้ลงนาม',items:[{href:'/personnel',label:'ข้อมูลบุคลากร',icon:'users'},{href:'/admin/pp5-signatories',label:'ผู้ลงนาม ปพ.5',icon:'file'}]},
 {title:'บริการผู้ปกครอง',items:[{href:'/admin/line-guardians',label:'เชื่อม LINE ผู้ปกครอง',icon:'users'},{href:'/admin/line-results',label:'ประกาศผลทาง LINE',icon:'chart'}]}
];
const teacherSections:NavSection[]=[
 {title:'ภาพรวม',items:[{href:'/teacher',label:'หน้าหลักครู',icon:'home'}]},
 {title:'การจัดการเรียนรู้',items:[
  {href:'/teacher/timetable',label:'ตารางสอนของฉัน',icon:'calendar'},
  {href:'/teacher#courses',label:'รายวิชาที่สอน',icon:'book'},
  {href:'/teacher/scores',label:'บันทึกคะแนน',icon:'chart'},
  {href:'/teacher/activities',label:'บันทึกกิจกรรม',icon:'check'}
 ]},
 {title:'งานประจำชั้น',items:[{href:'/teacher/pp6',label:'ห้องประจำชั้นและ ปพ.6',icon:'users'}]}
];
export default function AppNavigation(){
 const pathname=usePathname().replace(/\/+$/,'')||'/',router=useRouter();
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
 const sections=isTeacher?teacherSections:isAdmin?adminSections:[];
 const items=sections.flatMap(group=>group.items);
 const activeUrl=items.filter(item=>pathname===item.href.split('#')[0]||pathname.startsWith(item.href.split('#')[0]+'/')).sort((a,b)=>b.href.split('#')[0].length-a.href.split('#')[0].length)[0]?.href;
 async function signOut(){
  if(!window.dispatchEvent(new Event('wichakan:before-leave',{cancelable:true})))return;
  const db=getSupabaseBrowserClient();if(!db)return;
  setBusy(true);const {error}=await db.auth.signOut();setBusy(false);
  if(!error)router.replace('/login');
 }
 if(pathname==='/'||pathname==='/login')return null;
 const nav=<nav className="space-y-5" aria-label="หมวดเมนูหลัก">
  {sections.map(group=><section key={group.title}>
   <h2 className="mb-2 px-4 text-[11px] font-bold tracking-wide text-slate-400">{group.title}</h2>
   <div className="space-y-1">{group.items.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)}
    aria-current={activeUrl===item.href?'page':undefined}
    className={'app-nav-link '+(activeUrl===item.href?'is-active':'')}>
    <AcademicIcon name={item.icon}/><span>{item.label}</span></Link>)}</div>
  </section>)}
 </nav>;
 return <div className="app-shell">
  <header className="app-topbar">
   <div className="flex min-w-0 items-center gap-3">
    {items.length>0&&<button onClick={()=>setOpen(x=>!x)} aria-expanded={open} aria-label="เปิดหรือปิดเมนู" className="rounded-lg border border-slate-200 px-3 py-2 text-lg lg:hidden"><AcademicIcon name="menu"/></button>}
    <Link href="/workspace" className="app-brand-link" aria-label="Wichakan เลือกพื้นที่ทำงาน"><WichakanBrand/></Link>
   </div>
   <span className="app-workspace-label">{isTeacher?'พื้นที่ทำงานครู':isAdmin?'บริหารงานวิชาการ':'ระบบบริหารงานวิชาการ'}</span>
   {pathname==='/personnel'?<label className="hidden items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-blue-900 md:flex"><AcademicIcon name="calendar"/><select aria-label="ปีการศึกษาสรุปบุคลากร" className="bg-transparent outline-none" value={currentYear} disabled={!years.length} onChange={e=>{setCurrentYear(e.target.value);setYearSelection(schoolId,e.target.value);}}>{!years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{years.map(y=><option key={y.id} value={y.id}>ปีการศึกษา {y.year_be}</option>)}</select></label>:null}

   <div className="flex items-center gap-2">
    <Link href="/workspace" className="app-role-switch"><AcademicIcon name="switch"/> <span className="hidden sm:inline">สลับบทบาท</span><span className="sm:hidden">บทบาท</span></Link>
    <button onClick={signOut} disabled={busy} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">{busy?'กำลังออก...':'ออกจากระบบ'}</button>
   </div>
  </header>
  {items.length>0&&<>
   {open&&<button className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" aria-label="ปิดเมนู" onClick={()=>setOpen(false)}/>}
   <aside className={`app-sidebar ${open?'app-sidebar-open':''}`} aria-label="เมนูหลัก">
    <div className="mb-5 px-4 text-xs font-bold tracking-widest text-slate-400">{isTeacher?'งานสอน':'จัดการสถานศึกษา'}</div>
    {nav}
    <div className="mt-8 border-t border-slate-100 pt-5"><Link href="/workspace" onClick={()=>setOpen(false)} className="block rounded-xl px-4 py-3 text-sm text-slate-500 hover:bg-slate-100">← เลือกพื้นที่ทำงาน</Link></div>
   </aside>
  </>}
 </div>;
}