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
 return <main className="mx-auto max-w-5xl px-5 py-10">
 <Link href="/workspace" className="text-sm text-blue-700">← เปลี่ยนพื้นที่ทำงาน</Link>
 <header className="mt-4 rounded-2xl bg-[#123b72] p-7 text-white"><h1 className="text-3xl font-bold">Admin Dashboard</h1><p className="mt-2 text-sm text-blue-100">การบริหารงานวิชาการและการกำหนดสิทธิ์บุคลากร</p></header>
 {error&&<p role="alert" className="mt-5 text-red-700">{error}</p>}
 {ready&&<div className="mt-6 grid gap-4 sm:grid-cols-2">{[
  ['/personnel','จัดการบุคลากรและบทบาท'],
  ['/academic','ปีการศึกษาและห้องเรียน'],
  ['/academic/teachers','มอบหมายครูประจำชั้นและครูผู้สอน'],
  ['/curriculum','หลักสูตรและรายวิชา'],
  ['/students','ทะเบียนนักเรียน'],
  ['/students/promote','เลื่อนชั้นนักเรียน']
 ].map(([url,label])=><Link key={url} href={url} className="rounded-xl border bg-white p-5 font-medium shadow-sm">{label} →</Link>)}</div>}
 </main>;
}