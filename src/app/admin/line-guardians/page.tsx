'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type Tab='requests'|'linked'|'history';
type Claim={id:string;student_id:string;student_name:string;student_no:string;created_at:string};
type Child={id:string;name:string;student_no:string;relationship:string};
type Guardian={guardian_id:string;name:string;verified_at:string|null;children:Child[]};
type History={id:string;action:'approved'|'rejected'|'revoked';recorded_at:string;student_name:string;guardian_name:string;actor_name:string};
type Data={requests:Claim[];linked:Guardian[];history:History[]};
const empty:Data={requests:[],linked:[],history:[]};
const date=(v:string|null)=>v?new Date(v).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'—';
const actionText=(v:History['action'])=>v==='approved'?'อนุมัติ':v==='rejected'?'ปฏิเสธ':'ยกเลิกการเชื่อม';
const errText=(e:unknown)=>e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ';

export default function LineGuardiansPage(){
 const [tab,setTab]=useState<Tab>('requests'),[data,setData]=useState<Data>(empty);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[updated,setUpdated]=useState('');
 const load=useCallback(async()=>{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อฐานข้อมูล');
  const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)throw Error('กรุณาเข้าสู่ระบบ Admin');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('เฉพาะผู้ดูแลระบบโรงเรียนเท่านั้น');
  const school=m.data.school_id;
  const [c,a,g,l,st,h]=await Promise.all([
   db.from('line_student_claims').select('id,student_id,status,created_at,reviewed_at').eq('school_id',school),
   db.from('line_guardian_accounts').select('guardian_id,verified_at').eq('school_id',school),
   db.from('guardians').select('id,full_name_th').eq('school_id',school),
   db.from('student_guardians').select('guardian_id,student_id,relationship').eq('school_id',school),
   db.from('students').select('id,student_no,name_prefix_th,first_name_th,last_name_th').eq('school_id',school),
   db.from('line_guardian_child_audit').select('id,guardian_id,student_id,action,recorded_at').eq('school_id',school)
  ]);
  const failure=[c,a,g,l,st,h].find(x=>x.error);if(failure?.error)throw Error(failure.error.message);
  const students=new Map((st.data??[]).map(s=>[s.id,s]));
  const names=new Map((g.data??[]).map(x=>[x.id,x.full_name_th]));
  const studentName=(id:string)=>{const s=students.get(id);return s?(s.name_prefix_th??'')+s.first_name_th+' '+s.last_name_th:'ไม่พบนักเรียน';};
  const guardianName=(id:string)=>names.get(id)??'ผู้ปกครอง LINE';
  const requests:Claim[]=(c.data??[]).filter(x=>x.status==='pending').map(x=>({
   id:x.id,student_id:x.student_id,student_name:studentName(x.student_id),student_no:students.get(x.student_id)?.student_no??'—',created_at:x.created_at
  }));
  const linked:Guardian[]=(a.data??[]).map(account=>({
   guardian_id:account.guardian_id,name:guardianName(account.guardian_id),verified_at:account.verified_at,
   children:(l.data??[]).filter(x=>x.guardian_id===account.guardian_id).map(x=>({
    id:x.student_id,name:studentName(x.student_id),student_no:students.get(x.student_id)?.student_no??'—',relationship:x.relationship
   }))
  }));
  const history:History[]=[
   ...(c.data??[]).filter(x=>x.reviewed_at&&['approved','rejected'].includes(x.status)).map(x=>({
    id:'claim-'+x.id,action:x.status as History['action'],recorded_at:x.reviewed_at!,student_name:studentName(x.student_id),
    guardian_name:'ผู้ปกครอง LINE',actor_name:'ผู้ดูแลระบบ'
   })),
   ...(h.data??[]).map(x=>({
    id:'audit-'+x.id,action:x.action as History['action'],recorded_at:x.recorded_at,
    student_name:studentName(x.student_id),guardian_name:guardianName(x.guardian_id),actor_name:'ผู้ดูแลระบบ'
   }))
  ].sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at));
  setData({requests,linked,history});
  setUpdated(new Date().toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}));
 },[]);;
 useEffect(()=>{let live=true;void load().catch(e=>{if(live)setError(errText(e));}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[load]);
 async function refresh(){setLoading(true);setError('');try{await load();}catch(e){setError(errText(e));}finally{setLoading(false);}}
 async function review(c:Claim,approve:boolean){
  const prompt=approve?'ยืนยันว่าโรงเรียนได้ตรวจสอบสิทธิ์ผู้ปกครองจากหลักฐานที่เชื่อถือได้แล้ว และอนุมัติคำขอของ ':'ยืนยันปฏิเสธคำขอของ ';
  if(!window.confirm(prompt+c.student_name+'?'))return;
  const db=getSupabaseBrowserClient();if(!db)return;setBusy(true);setError('');setNotice('');
  try{const {error:e}=await db.rpc('review_line_student_claim',{p_claim:c.id,p_approve:approve});if(e)throw e;
   await load();setNotice(approve?'อนุมัติการเชื่อมบัญชีแล้ว':'ปฏิเสธคำขอแล้ว');
  }catch(e){setError(errText(e));}finally{setBusy(false);}
 }
 async function unlink(g:Guardian,c:Child){
  if(!window.confirm('ยกเลิกสิทธิ์ LINE ของ '+g.name+' สำหรับ '+c.name+' ใช่หรือไม่? การยกเลิกจะไม่กระทบบุตรหลานรายอื่น และระบบจะบันทึกประวัติไว้'))return;
  const db=getSupabaseBrowserClient();if(!db)return;setBusy(true);setError('');setNotice('');
  try{const {error:e}=await db.rpc('line_admin_revoke_student_link',{p_guardian:g.guardian_id,p_student:c.id});if(e)throw e;
   await load();setNotice('ยกเลิกการเชื่อมสำหรับนักเรียนรายนี้แล้ว');
  }catch(e){setError(errText(e));}finally{setBusy(false);}
 }
 const needle=query.trim().toLocaleLowerCase();
 const filteredClaims=useMemo(()=>data.requests.filter(c=>(c.student_name+' '+c.student_no).toLocaleLowerCase().includes(needle)),[data.requests,needle]);
 const filteredLinked=useMemo(()=>data.linked.filter(g=>[g.name,...g.children.flatMap(c=>[c.name,c.student_no])].join(' ').toLocaleLowerCase().includes(needle)),[data.linked,needle]);
 const filteredHistory=useMemo(()=>data.history.filter(h=>[h.student_name,h.guardian_name,h.actor_name,actionText(h.action)].join(' ').toLocaleLowerCase().includes(needle)),[data.history,needle]);
 const tabs:{id:Tab;label:string;count:number}[]=[{id:'requests',label:'คำขอ',count:data.requests.length},{id:'linked',label:'เชื่อมแล้ว',count:data.linked.length},{id:'history',label:'ประวัติ',count:data.history.length}];
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-10">
  <PageHeader title="LINE OA · จัดการผู้ปกครอง" context="การตรวจสอบคำขอและการเชื่อมบัญชี LINE"/>
  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 py-4">
   <p className="max-w-3xl text-sm text-slate-600">ผู้ปกครองลงทะเบียนผ่าน LINE โดยใช้เลขบัตรประชาชนของนักเรียน 13 หลัก โรงเรียนต้องตรวจสอบความสัมพันธ์จากหลักฐานที่เชื่อถือได้ก่อนอนุมัติ เลขบัตรเพียงอย่างเดียวไม่สามารถยืนยันสิทธิ์ผู้ปกครองได้</p>
   <button type="button" className="ui-secondary" disabled={loading||busy} onClick={()=>void refresh()}>{loading?'กำลังโหลด...':'โหลดข้อมูลล่าสุด'}</button>
  </div>
  <div className="my-5 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-4 text-center">
   {([{label:'รออนุมัติ',value:data.requests.length},{label:'บัญชี LINE ที่เชื่อม',value:data.linked.length},{label:'นักเรียนที่เชื่อม',value:data.linked.reduce((n,g)=>n+g.children.length,0)}]).map(s=><div key={s.label}><p className="text-xs text-slate-500">{s.label}</p><strong className="mt-1 block text-2xl tabular-nums">{loading?'—':s.value}</strong></div>)}
  </div>
  {error&&<p className="teacher-error mb-3" role="alert">{error}</p>}
  {notice&&<p className="teacher-success mb-3" role="status">{notice}</p>}
  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200">
   <div role="tablist" aria-label="ส่วนงานผู้ปกครอง LINE" className="flex gap-5">{tabs.map(t=><button type="button" role="tab" key={t.id} id={'tab-'+t.id} aria-selected={tab===t.id} aria-controls={'panel-'+t.id} onClick={()=>{setTab(t.id);setQuery('');}} className={'border-b-2 px-1 pb-3 text-sm font-semibold '+(tab===t.id?'border-blue-700 text-blue-800':'border-transparent text-slate-500')}>{t.label} ({loading?'—':t.count})</button>)}</div>
   <label className="mb-2"><span className="sr-only">ค้นหา</span><input type="search" className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อหรือรหัสนักเรียน"/></label>
  </div>
  <div role="tabpanel" id={'panel-'+tab} aria-labelledby={'tab-'+tab} className="py-5">
   {loading?<p className="py-8 text-sm text-slate-500" role="status">กำลังโหลดข้อมูล...</p>:tab==='requests'?<section>
    <h2 className="mb-1 font-semibold">คำขอรออนุมัติ</h2>
    <p className="mb-4 text-sm text-slate-500">ตรวจสอบสิทธิ์ผู้ปกครองกับโรงเรียนก่อนอนุมัติ ไม่มีการเปิดเผยผลการเรียนในขั้นตอนนี้</p>
    {!filteredClaims.length?<p className="border-y py-8 text-center text-sm text-slate-500">{needle?'ไม่พบคำขอ':'ไม่มีคำขอรออนุมัติ'}</p>:
    <div className="overflow-x-auto"><table className="w-full min-w-[570px] text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">นักเรียน</th><th className="p-3 text-left">วันที่ยื่น</th><th className="p-3 text-right">จัดการ</th></tr></thead>
     <tbody>{filteredClaims.map(c=><tr key={c.id} className="border-b"><td className="p-3">{c.student_name}<small className="block text-slate-500">รหัส {c.student_no}</small></td><td className="p-3">{date(c.created_at)}</td><td className="whitespace-nowrap p-3 text-right"><button className="ui-primary mr-2" disabled={busy} onClick={()=>void review(c,true)}>อนุมัติ</button><button className="ui-secondary" disabled={busy} onClick={()=>void review(c,false)}>ปฏิเสธ</button></td></tr>)}</tbody></table></div>}
   </section>:tab==='linked'?<section>
    <h2 className="mb-1 font-semibold">บัญชี LINE ที่เชื่อมแล้ว</h2><p className="mb-4 text-sm text-slate-500">บัญชีหนึ่งเชื่อมได้หลายบุตรหลาน สามารถยกเลิกเฉพาะนักเรียนที่เลือกโดยไม่กระทบคนอื่น</p>
    {!filteredLinked.length?<p className="border-y py-8 text-center text-sm text-slate-500">{needle?'ไม่พบข้อมูล':'ยังไม่มีบัญชีที่เชื่อม'}</p>:
    <div className="divide-y border-y">{filteredLinked.map(g=><section key={g.guardian_id} className="py-4">
     <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{g.name||'ผู้ปกครอง LINE'} <small className="font-normal text-slate-500">({g.children.length} คน)</small></h3><small className="text-slate-500">เชื่อมเมื่อ {date(g.verified_at)}</small></div>
     {!g.children.length?<p className="text-sm text-slate-500">ไม่มีบุตรหลานที่เชื่อม</p>:<ul className="divide-y divide-slate-100">{g.children.map(c=><li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="text-sm"><strong className="font-medium">{c.name}</strong><small className="block text-slate-500">รหัส {c.student_no} · {c.relationship}</small></div><button type="button" className="text-sm text-red-700 underline disabled:opacity-50" disabled={busy} onClick={()=>void unlink(g,c)}>ยกเลิกการเชื่อม</button></li>)}</ul>}
    </section>)}</div>}
   </section>:<section>
    <h2 className="mb-1 font-semibold">ประวัติการดำเนินการ</h2><p className="mb-4 text-sm text-slate-500">แสดงคำขอที่อนุมัติ ปฏิเสธ และการยกเลิกการเชื่อมย้อนหลัง</p>
    {!filteredHistory.length?<p className="border-y py-8 text-center text-sm text-slate-500">{needle?'ไม่พบรายการ':'ยังไม่มีประวัติ'}</p>:
    <div className="overflow-x-auto"><table className="w-full min-w-[630px] text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">วันเวลา</th><th className="p-3 text-left">รายการ</th><th className="p-3 text-left">นักเรียน / ผู้ปกครอง</th><th className="p-3 text-left">ผู้ดำเนินการ</th></tr></thead><tbody>{filteredHistory.map(h=><tr key={h.id} className="border-b"><td className="p-3">{date(h.recorded_at)}</td><td className="p-3">{actionText(h.action)}</td><td className="p-3">{h.student_name||'—'}<small className="block text-slate-500">{h.guardian_name||'—'}</small></td><td className="p-3">{h.actor_name||'ผู้ดูแลระบบ'}</td></tr>)}</tbody></table></div>}
   </section>}
  </div>
  {updated&&<p className="border-t border-slate-100 pt-3 text-xs text-slate-500">อัปเดตล่าสุด {updated}</p>}
 </main>;
}
