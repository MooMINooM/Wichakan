'use client';
import PageHeader from '@/components/page-header';
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
 return <main className="wichakan-page mx-auto max-w-5xl px-5 py-10">
   <PageHeader title="ภาพรวมผู้บริหาร"/>
   {error&&<p role="alert" className="mt-5 text-red-700">{error}</p>}
   {allowed&&<div className="ui-panel mt-6 rounded-2xl border bg-white p-6">
     <h2 className="text-lg font-bold">ภาพรวมงานวิชาการ</h2>
     <p className="mt-3 text-sm text-slate-600">ระบบติดตามผลและอนุมัติงานอยู่ระหว่างพัฒนา</p>
   </div>}
 </main>;
}
