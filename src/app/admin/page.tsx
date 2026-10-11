'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
export default function AdminPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;(async()=>{
  if(!db){setError('ยังไม่ได้เชื่อม Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1);
  if(!live)return;
  if(e)setError(e.message);else if(!data?.length)router.replace('/workspace');else setReady(true);
 })();return()=>{live=false;};},[db,router]);
 const groups=[
 {title:'งานประจำวันที่ใช้บ่อย',items:[{href:'/students',title:'ทะเบียนนักเรียน',detail:'ค้นหา เพิ่ม และดูประวัตินักเรียน',symbol:'01'},{href:'/academic/teachers',title:'มอบหมายครู',detail:'ครูประจำชั้นและครูผู้สอน',symbol:'02'},{href:'/personnel',title:'จัดการบุคลากร',detail:'กำหนดบทบาทและสิทธิ์การใช้งาน',symbol:'03'}]},
 {title:'การตั้งค่าและบริหาร',items:[{href:'/academic',title:'ปีการศึกษาและห้องเรียน',detail:'ภาคเรียนและโครงสร้างห้อง',symbol:'04'},{href:'/academic/templates',title:'แม่แบบห้องเรียน',detail:'เตรียมห้องสำหรับปีถัดไป',symbol:'05'},{href:'/curriculum',title:'หลักสูตรและรายวิชา',detail:'จัดการฉบับหลักสูตรและชั่วโมงเรียน',symbol:'06'},{href:'/students/promote',title:'เลื่อนชั้นแบบกลุ่ม',detail:'บันทึกประวัติการศึกษาในปีใหม่',symbol:'07'}]}
 ];
 return <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">ADMIN WORKSPACE</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">จัดการสถานศึกษา</h1><p className="mt-2 text-sm text-slate-500">เลือกงานที่ต้องการได้ทันที ไม่ต้องกลับไปหน้าแรก</p></div><Link href="/workspace" className="rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-700">เปลี่ยนพื้นที่ทำงาน ↗</Link></div>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
  {!ready&&!error&&<p className="mt-6 text-sm text-slate-500">กำลังตรวจสอบสิทธิ์...</p>}
  {ready&&<div className="mt-8 space-y-8">{groups.map(group=><section key={group.title}><h2 className="mb-4 text-lg font-bold text-slate-800">{group.title}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{group.items.map(item=><Link href={item.href} key={item.href} className="group flex min-h-32 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-800">{item.symbol}</span><span className="min-w-0 flex-1"><span className="block font-bold text-slate-900">{item.title}</span><span className="mt-1 block text-sm leading-relaxed text-slate-500">{item.detail}</span></span><span className="text-blue-700 group-hover:translate-x-1">→</span></Link>)}</div></section>)}</div>}
 </main>;
}
