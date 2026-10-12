'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Summary={students:number|null;staff:number|null;rooms:number|null;courses:number|null};
const quick=[
 {href:'/students',title:'ทะเบียนนักเรียน',text:'ค้นหา เพิ่ม และจัดการนักเรียน',icon:'◉',color:'bg-blue-50 text-blue-700'},
 {href:'/academic/teachers',title:'มอบหมายครู',text:'มอบหมายครูประจำชั้นและรายวิชา',icon:'♙',color:'bg-emerald-50 text-emerald-700'},
 {href:'/curriculum',title:'หลักสูตร',text:'จัดรายวิชาตามระดับชั้นและชั่วโมง',icon:'▤',color:'bg-violet-50 text-violet-700'},
 {href:'/students/promote',title:'เลื่อนชั้นนักเรียน',text:'จัดการเลื่อนชั้นสำหรับปีถัดไป',icon:'↗',color:'bg-sky-50 text-sky-700'}
];
const other=[
 {href:'/academic',title:'ปีการศึกษาและห้องเรียน',detail:'กำหนดปี ภาคเรียน และห้องเรียน'},
 {href:'/academic/templates',title:'แม่แบบห้องเรียน',detail:'เตรียมห้องเรียนล่วงหน้า'},
 {href:'/personnel',title:'บุคลากรและสิทธิ์',detail:'กำหนดสิทธิ์ผู้ใช้งาน'}
];
export default function AdminPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 const [summary,setSummary]=useState<Summary>({students:null,staff:null,rooms:null,courses:null});
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let live=true;(async()=>{
  if(!db){setError('ยังไม่ได้เชื่อมต่อ Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1);
  if(!live)return;
  if(e){setError(e.message);return;}
  if(!data?.length){router.replace('/workspace');return;}
  const school=data[0].school_id;
  setReady(true);
  const [students,staff,rooms,courses]=await Promise.all([
   db.from('students').select('id',{count:'exact',head:true}).eq('school_id',school),
   db.from('school_memberships').select('user_id').eq('school_id',school).eq('active',true),
   db.from('classrooms').select('id',{count:'exact',head:true}).eq('school_id',school),
   db.from('course_offerings').select('id',{count:'exact',head:true}).eq('school_id',school)
  ]);
  if(!live)return;
  setSummary({
   students:students.error?null:students.count,
   staff:staff.error?null:new Set((staff.data??[]).map(m=>m.user_id)).size,
   rooms:rooms.error?null:rooms.count,
   courses:courses.error?null:courses.count
  });
 })();return()=>{live=false;};},[db,router,refresh]);
 const metrics=[
 {title:'นักเรียนทั้งหมด',value:summary.students,icon:'◉',color:'bg-blue-50 text-blue-700',href:'/students'},
 {title:'ครูและบุคลากร',value:summary.staff,icon:'♙',color:'bg-emerald-50 text-emerald-700',href:'/personnel'},
 {title:'ห้องเรียน',value:summary.rooms,icon:'⌂',color:'bg-violet-50 text-violet-700',href:'/academic'},
 {title:'รายวิชาที่เปิดสอน',value:summary.courses,icon:'▤',color:'bg-orange-50 text-orange-700',href:'/academic/teachers'}
 ];
 return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#e8f3ff] via-[#eff7ff] to-[#d9edff] p-7 sm:p-9">
   <div className="relative z-10"><p className="text-sm font-semibold text-slate-500">ยินดีต้อนรับกลับ</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#123b72] sm:text-4xl">จัดการสถานศึกษา</h1><p className="mt-3 text-sm text-slate-600 sm:text-base">บริหารงานวิชาการได้อย่างง่ายดาย จากที่เดียว</p></div>
   <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-7 hidden text-[120px] leading-none text-blue-200/50 md:block">⌂</div>
  </div>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
  {!ready&&!error&&<p className="mt-5 text-sm text-slate-500">กำลังโหลดข้อมูล...</p>}
  {ready&&<>
   <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {metrics.map(m=><Link key={m.href} href={m.href} className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
     <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${m.color}`}>{m.icon}</span>
     <span className="min-w-0"><span className="block text-sm font-medium text-slate-500">{m.title}</span><span className="mt-1 block text-3xl font-extrabold text-[#102f61]">{m.value===null?'—':m.value.toLocaleString('th-TH')}</span></span>
     <span className="ml-auto text-blue-400 transition group-hover:translate-x-1">›</span>
    </Link>)}
   </div>
   <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-900">งานที่ใช้บ่อย</h2><Link href="/workspace" className="text-sm font-medium text-blue-700">พื้นที่ทำงาน ↗</Link></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
     {quick.map(q=><Link key={q.href} href={q.href} className="group flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${q.color}`}>{q.icon}</span><span className="min-w-0"><span className="block font-bold text-slate-900">{q.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{q.text}</span><span className="mt-2 block text-sm font-semibold text-blue-700">เปิดใช้งาน →</span></span>
     </Link>)}
    </div>
   </section>
   <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
     <h2 className="text-xl font-bold">จัดการงานวิชาการ</h2><p className="mt-1 text-sm text-slate-500">เข้าถึงการตั้งค่าและงานบริหารที่เหลือ</p>
     <div className="mt-4 divide-y divide-slate-100">{other.map(m=><Link key={m.href} href={m.href} className="flex items-center justify-between gap-4 py-4 hover:text-blue-800"><div><p className="font-semibold">{m.title}</p><p className="mt-1 text-sm text-slate-500">{m.detail}</p></div><span className="text-xl text-blue-500">›</span></Link>)}</div>
    </div>
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
     <h2 className="text-xl font-bold">ลิงก์ด่วน</h2>
     <div className="mt-4 grid grid-cols-2 gap-3">{[
      ['/academic','ห้องเรียน'],['/curriculum','รายวิชา'],['/personnel','บุคลากร'],['/students/history','ประวัตินักเรียน']
     ].map(([href,label])=><Link key={href} href={href} className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-center text-sm font-semibold text-blue-800 hover:bg-blue-100">{label}</Link>)}</div>
     <button type="button" onClick={()=>setRefresh(x=>x+1)} className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">↻ รีเฟรชสรุปข้อมูล</button>
    </div>
   </section>
  </>}
 </main>;
}
