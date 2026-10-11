'use client';
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
 return <main className="mx-auto max-w-5xl px-5 py-10">
 <Link href="/" className="text-sm text-blue-700">← Wichakan</Link>
 <h1 className="mt-4 text-3xl font-bold">เลือกพื้นที่ทำงาน</h1>
 <p className="mt-2 text-sm text-slate-500">พื้นที่ทำงานแยกตามบทบาทที่โรงเรียนมอบหมาย บัญชีเดียวมีได้หลายบทบาท</p>
 {loading&&<p className="mt-5">กำลังตรวจสอบสิทธิ์...</p>}
 {error&&<p role="alert" className="mt-5 text-red-700">{error}</p>}
 {!loading&&!error&&!roles.length&&<p className="mt-6 rounded-xl bg-amber-50 p-4">ยังไม่มีสิทธิ์ในโรงเรียน กรุณาติดต่อผู้ดูแลระบบ</p>}
 <div className="mt-6 grid gap-4 sm:grid-cols-2">{roles.map((m,i)=><Link key={m.school_id+m.role+i} href={routes[m.role]??'/workspace'} className="rounded-2xl border bg-white p-6 shadow-sm hover:border-blue-400"><h2 className="font-bold">{names[m.role]??m.role}</h2><p className="mt-2 text-sm text-slate-500">{m.schools?.name_th??'โรงเรียน'}</p><p className="mt-5 text-sm text-blue-700">เปิดพื้นที่ทำงาน →</p></Link>)}</div>
 </main>;
}