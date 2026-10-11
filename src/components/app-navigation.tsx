'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useState} from 'react';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
export default function AppNavigation(){
 const pathname=usePathname(),router=useRouter(),[busy,setBusy]=useState(false);
 const isTeacher=pathname.startsWith('/teacher');
 const isAdmin=pathname.startsWith('/admin')||pathname.startsWith('/personnel')||pathname.startsWith('/academic')||pathname.startsWith('/curriculum')||pathname.startsWith('/students');
 const items=isTeacher?[['/teacher','ห้องเรียนของฉัน']]:isAdmin?[['/admin','ภาพรวม'],['/students','ทะเบียนนักเรียน'],['/academic','ปีการศึกษา'],['/academic/teachers','มอบหมายครู'],['/curriculum','หลักสูตร'],['/personnel','บุคลากร']]:[];
 async function signOut(){
  const db=getSupabaseBrowserClient();if(!db)return;
  setBusy(true);const {error}=await db.auth.signOut();setBusy(false);
  if(!error)router.replace('/login');
 }
 if(pathname==='/login'||pathname==='/')return null;
 return <nav aria-label="เมนูหลัก Wichakan" className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
 <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
 <Link href="/workspace" className="mr-auto flex items-center gap-2 rounded-lg text-base font-bold text-[#123b72]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-900 text-white">W</span> Wichakan</Link>
 <Link href="/workspace" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">สลับบทบาท</Link>
 <button type="button" disabled={busy} onClick={signOut} className="rounded-lg px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">{busy?'กำลังออก...':'ออกจากระบบ'}</button>
 {items.length>0&&<div className="order-3 flex w-full gap-1 overflow-x-auto pb-1">
 {items.map(([url,name])=><Link key={url} href={url} aria-current={pathname===url?'page':undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname===url?'bg-blue-900 text-white':'text-slate-600 hover:bg-slate-100'}`}>{name}</Link>)}</div>}
 </div>
 </nav>;
}