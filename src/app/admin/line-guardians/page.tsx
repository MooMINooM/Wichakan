'use client';
import {useCallback,useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type Guardian={id:string;full_name_th:string;phone:string|null};
type RequestRow={id:string;guardian_id:string;created_at:string;status:string};
export default function LineGuardiansPage(){
 const [school,setSchool]=useState(''),[guardians,setGuardians]=useState<Guardian[]>([]),[requests,setRequests]=useState<RequestRow[]>([]),[linked,setLinked]=useState<Set<string>>(new Set()),[selected,setSelected]=useState(''),[invite,setInvite]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const reload=useCallback(async()=>{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อฐานข้อมูล');
  const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)throw Error('กรุณาเข้าสู่ระบบ');
  const {data:m,error:memberError}=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('active',true).eq('role','school_admin').limit(1).maybeSingle();
  if(memberError||!m)throw Error('เฉพาะผู้ดูแลระบบโรงเรียนเท่านั้น');
  setSchool(m.school_id);
  const [g,r,l]=await Promise.all([
   db.from('guardians').select('id,full_name_th,phone').eq('school_id',m.school_id).order('full_name_th'),
   db.from('line_guardian_requests').select('id,guardian_id,created_at,status').eq('school_id',m.school_id).eq('status','pending').order('created_at',{ascending:false}),
   db.from('line_guardian_accounts').select('guardian_id').eq('school_id',m.school_id)
  ]);
  if(g.error||r.error||l.error)throw Error(g.error?.message||r.error?.message||l.error?.message);
  setGuardians(g.data??[]);setRequests(r.data??[]);setLinked(new Set((l.data??[]).map(x=>x.guardian_id)));
 },[]);
 useEffect(()=>{void reload().catch(e=>setError((e as Error).message));},[reload]);
 async function issue(){if(!selected)return;setBusy(true);setError('');setInvite('');try{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล');
  const {data,error}=await db.rpc('create_line_guardian_invite',{p_guardian:selected});
  if(error)throw error;setInvite(String(data));
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function review(id:string,approve:boolean){if(!window.confirm(approve?'ยืนยันอนุมัติการผูก LINE ผู้ปกครองรายนี้?':'ปฏิเสธคำขอนี้?'))return;setBusy(true);setError('');try{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล');
  const {error}=await db.rpc('review_line_guardian_request',{p_request:id,p_approve:approve});
  if(error)throw error;await reload();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const name=(id:string)=>guardians.find(g=>g.id===id)?.full_name_th??'ไม่พบผู้ปกครอง';
 return <main className="wichakan-page">
  <PageHeader title="LINE OA · ลงทะเบียนผู้ปกครอง"/>
  <p className="mb-4 text-sm">ออกคำเชิญเฉพาะผู้ปกครองที่โรงเรียนตรวจสอบตัวตนแล้ว ผู้ปกครองส่งรหัสผ่านแชตส่วนตัวของ LINE OA เพื่อยื่นคำขอ จากนั้นผู้ดูแลจึงอนุมัติ ไม่มีการเปิดเผยผลการเรียนในขั้นตอนนี้</p>
  {error&&<p role="alert" className="teacher-error">{error}</p>}
  <section className="ui-panel mb-4"><h2 className="mb-3 font-semibold">ออกคำเชิญ (ใช้ได้ครั้งเดียว ภายใน 24 ชั่วโมง)</h2>
   <label className="block mb-3">เลือกผู้ปกครองจากทะเบียนโรงเรียน<select className="block w-full border p-2" value={selected} onChange={e=>{setSelected(e.target.value);setInvite('');}}><option value="">เลือกผู้ปกครอง</option>{guardians.filter(g=>!linked.has(g.id)).map(g=><option key={g.id} value={g.id}>{g.full_name_th} {g.phone??''}</option>)}</select></label>
   <button className="ui-primary" disabled={busy||!selected||!school} onClick={()=>void issue()}>สร้างรหัสเชิญ</button>
   {invite&&<div className="mt-3"><p className="text-sm">แจ้งผู้ปกครองที่ยืนยันตัวตนแล้วให้ส่งข้อความต่อไปนี้ในแชตส่วนตัว LINE OA โรงเรียน (อย่าเผยแพร่รหัสในกลุ่ม)</p><code className="block my-2 break-all select-all">LINK {invite}</code><button className="ui-secondary" onClick={()=>void navigator.clipboard.writeText('LINK '+invite)}>คัดลอกข้อความ</button></div>}
  </section>
  <section className="ui-panel"><h2 className="mb-3 font-semibold">คำขอรออนุมัติ ({requests.length})</h2>
   {!requests.length?<p className="text-sm">ยังไม่มีคำขอรออนุมัติ</p>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">ผู้ปกครอง</th><th className="p-2 text-left">ยื่นเมื่อ</th><th className="p-2">จัดการ</th></tr></thead><tbody>{requests.map(r=><tr key={r.id}><td className="p-2">{name(r.guardian_id)}</td><td className="p-2">{new Date(r.created_at).toLocaleString('th-TH')}</td><td className="p-2"><div className="flex gap-2"><button className="ui-primary" disabled={busy} onClick={()=>void review(r.id,true)}>อนุมัติ</button><button className="ui-secondary" disabled={busy} onClick={()=>void review(r.id,false)}>ปฏิเสธ</button></div></td></tr>)}</tbody></table></div>}
  </section>
 </main>;
}
