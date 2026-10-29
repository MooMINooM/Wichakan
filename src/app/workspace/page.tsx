'use client';
import PageHeader from '@/components/page-header';
import {AcademicIcon} from '@/components/academic-visuals';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Membership={school_id:string;role:string;schools:{name_th:string}|null};
const names:Record<string,string>={school_admin:'ผู้ดูแลระบบ',director:'ผู้อำนวยการ',academic:'ฝ่ายวิชาการ',registrar:'ฝ่ายทะเบียน',teacher:'ครูผู้สอน'};
const routes:Record<string,string>={school_admin:'/admin',director:'/director',academic:'/academic',registrar:'/students',teacher:'/teacher'};
export default function Workspace(){
 const router=useRouter(),db=getSupabaseBrowserClient();
 const [roles,setRoles]=useState<Membership[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{
  if(!db){setError('ยังไม่ได้ตั้งค่า Supabase');setLoading(false);return;}
  const {data:{user}}=await db.auth.getUser();if(!live)return;
  if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('school_id,role,schools(name_th)').eq('user_id',user.id).eq('active',true);
  if(!live)return;
  if(e)setError(e.message);else setRoles((data??[]) as unknown as Membership[]);
  setLoading(false);
 })();return()=>{live=false;};},[db,router]);
 return <main className="wichakan-page mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
 <PageHeader title="เลือกพื้นที่ทำงาน"/>
 {loading&&<p className="mt-5">กำลังตรวจสอบสิทธิ์...</p>}
 {error&&<p role="alert" className="mt-5 text-red-700">{error}</p>}
 {!loading&&!error&&!roles.length&&<p className="mt-6 rounded-xl bg-amber-50 p-4">ยังไม่มีสิทธิ์ในโรงเรียน กรุณาติดต่อผู้ดูแลระบบ</p>}
 <div className="workspace-roles mt-6">{roles.map((m,i)=><Link key={m.school_id+m.role+i} href={routes[m.role]??'/workspace'} className="ui-panel workspace-role"><div className="workspace-role-icon"><AcademicIcon name={m.role==='teacher'?'book':m.role==='school_admin'?'settings':m.role==='director'?'chart':'users'}/></div><div><h2>{names[m.role]??m.role}</h2><p className="mt-1 text-sm text-slate-500">{m.schools?.name_th??'โรงเรียน'}</p></div><span className="workspace-role-arrow" aria-hidden="true">→</span></Link>)}</div>
 {!loading&&!error&&roles.some(m=>m.role==='school_admin')&&!roles.some(m=>m.role==='director')&&<div className="mt-4"><Link href="/director" className="ui-secondary">ภาพรวมผู้บริหาร</Link></div>}
 </main>;
}
