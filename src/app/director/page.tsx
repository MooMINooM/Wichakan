'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
export default function DirectorPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [allowed,setAllowed]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;(async()=>{
   if(!db){setError('ยังไม่ได้เชื่อม Supabase');return;}
   const {data:{user}}=await db.auth.getUser();
   if(!user){router.replace('/login');return;}
   const {data,error:e}=await db.from('school_memberships').select('id').eq('user_id',user.id).eq('role','director').eq('active',true).limit(1);
   if(!live)return;
   if(e)setError(e.message);else if(!data?.length)router.replace('/workspace');else setAllowed(true);
 })();return()=>{live=false;};},[db,router]);
 return <main className="mx-auto max-w-5xl px-5 py-10">
   <Link href="/workspace" className="text-sm text-blue-700">← เปลี่ยนพื้นที่ทำงาน</Link>
   <header className="mt-4 rounded-2xl bg-[#48527c] p-7 text-white"><h1 className="text-3xl font-bold">Director Dashboard</h1>
   <p className="mt-2 text-sm text-indigo-100">พื้นที่ติดตามงานของผู้บริหารสถานศึกษา</p></header>
   {error&&<p role="alert" className="mt-5 text-red-700">{error}</p>}
   {allowed&&<div className="mt-6 rounded-2xl border bg-white p-6">
     <h2 className="text-lg font-bold">ภาพรวมงานวิชาการ</h2>
     <p className="mt-3 text-sm text-slate-600">พื้นที่สำหรับติดตามผลและอนุมัติงานอยู่ระหว่างพัฒนา ยังไม่มีการอนุมัติหรือแก้ข้อมูลผ่านหน้านี้</p>
   </div>}
 </main>;
}