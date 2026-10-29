'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Evidence={id:string;title:string;kind:string;owner_user_id:string;activity_year_be:number;description:string;target_codes:string[];storage_path:string|null;drive_url:string|null;verification_status:string};
type Staff={user_id:string;display_name:string|null;learning_area:string|null};
type StaffInfo={school_id:string;user_id:string;name_title:string;employment_type:string;position_title:string;qualification:string;major:string;academic_rank:string;joined_at:string|null;notes:string};
const blank=(school:string,user_id:string):StaffInfo=>({school_id:school,user_id,name_title:'',employment_type:'',position_title:'',qualification:'',major:'',academic_rank:'',joined_at:null,notes:''});
export default function SarManagement(){
 const db=getSupabaseBrowserClient();
 const [school,setSchool]=useState(''),[year,setYear]=useState(''),[years,setYears]=useState<Year[]>([]);
 const [staff,setStaff]=useState<Staff[]>([]),[staffInfo,setStaffInfo]=useState<StaffInfo[]>([]);
 const [evidence,setEvidence]=useState<Evidence[]>([]),[staffId,setStaffId]=useState(''),[form,setForm]=useState<StaffInfo|null>(null);
 const [tab,setTab]=useState<'evidence'|'staff'>('evidence');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const input='w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ไม่มีการเชื่อมต่อ Supabase');
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบ');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('เฉพาะ Admin เท่านั้นที่เข้าหน้านี้ได้');
  const sid=m.data.school_id as string;
  const [y,u]=await Promise.all([
   db.from('academic_years').select('id,year_be,is_active').eq('school_id',sid).order('year_be',{ascending:false}),
   db.from('school_memberships').select('user_id').eq('school_id',sid).eq('active',true)
  ]);
  if(y.error||u.error)throw Error(y.error?.message||u.error?.message);
  const ids=[...new Set((u.data??[]).map(v=>v.user_id))];
  const ps:Staff[]=[];
  for(let i=0;i<ids.length;i+=100){const p=await db.from('profiles').select('user_id,display_name,learning_area').in('user_id',ids.slice(i,i+100));if(p.error)throw p.error;ps.push(...(p.data as Staff[]));}
  if(!live)return;const ys=y.data as Year[];setSchool(sid);setYears(ys);setStaff(ps.sort((a,b)=>(a.display_name??'').localeCompare(b.display_name??'','th')));setYear(ys.find(x=>x.is_active)?.id??ys[0]?.id??'');setStaffId(ps[0]?.user_id??'');
 }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}finally{if(live)setLoading(false);}})();return()=>{live=false};},[db]);
 async function reload(){
  if(!db||!school)return;
  const [ev,profile]=await Promise.all([
   db.from('sar_evidence').select('id,title,kind,owner_user_id,activity_year_be,description,target_codes,storage_path,drive_url,verification_status').eq('school_id',school).eq('academic_year_id',year).order('created_at',{ascending:false}),
   db.from('sar_staff_profiles').select('school_id,user_id,name_title,employment_type,position_title,qualification,major,academic_rank,joined_at,notes').eq('school_id',school)
  ]);
  if(ev.error||profile.error)throw Error(ev.error?.message||profile.error?.message);
  setEvidence(ev.data as Evidence[]);setStaffInfo(profile.data as StaffInfo[]);
 }
 useEffect(()=>{if(!school||!year)return;let live=true;void reload().catch(e=>{if(live)setError((e as Error).message)});return()=>{live=false};},[school,year]);
 useEffect(()=>{if(staffId)setForm(staffInfo.find(s=>s.user_id===staffId)??blank(school,staffId))},[staffId,staffInfo,school]);
 async function review(item:Evidence,status:string){
  if(!db||busy)return;
  if(!window.confirm((status==='verified'?'รับรอง':'ส่งกลับแก้ไข')+' หลักฐานนี้?'))return;
  setBusy(true);setError('');setNotice('');
  try{const r=await db.rpc('sar_verify_evidence',{p_id:item.id,p_status:status});if(r.error)throw Error(r.error.message);
   await reload();setNotice('อัปเดตสถานะหลักฐานเรียบร้อย');}
  catch(e){setError(e instanceof Error?e.message:'ไม่สำเร็จ')}finally{setBusy(false)}
 }
 async function saveProfile(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!db||!form||busy)return;setBusy(true);setError('');setNotice('');
  try{const r=await db.from('sar_staff_profiles').upsert({...form,joined_at:form.joined_at||null,updated_at:new Date().toISOString()},{onConflict:'school_id,user_id'});
   if(r.error)throw Error(r.error.message);await reload();setNotice('บันทึกข้อมูลบุคลากรแล้ว');}
  catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{setBusy(false)}
 }
 async function openStorage(path:string){
  if(!db)return;const r=await db.storage.from('wichakan-sar').createSignedUrl(path,60);
  if(r.error){setError(r.error.message);return;}window.open(r.data.signedUrl,'_blank','noopener,noreferrer');
 }
 function name(id:string){return staff.find(p=>p.user_id===id)?.display_name??'ไม่พบชื่อผู้ใช้'}
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-12">
  <PageHeader title="บุคลากรและคลังหลักฐาน SAR" context="Admin ตรวจหลักฐานผลงาน อบรม นวัตกรรม และทะเบียนข้อมูลวิชาชีพ"/>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
   <label className="text-sm font-medium">ปีการศึกษา <select value={year} onChange={e=>setYear(e.target.value)} className={input+' ml-2 inline-block w-auto'}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <Link href="/admin/sar" className="text-sm text-blue-700 underline">← กลับหน้าหลัก SAR</Link>
  </div>
  {error&&<p className="teacher-error mb-3" role="alert">{error}</p>}{notice&&<p role="status" className="teacher-success mb-3">{notice}</p>}
  <div className="mb-5 flex gap-2 border-b border-slate-200 pb-3">
   <button className={tab==='evidence'?'ui-primary':'ui-secondary'} onClick={()=>setTab('evidence')}>ตรวจหลักฐาน ({evidence.filter(x=>x.verification_status==='draft').length} รอรับรอง)</button>
   <button className={tab==='staff'?'ui-primary':'ui-secondary'} onClick={()=>setTab('staff')}>ประวัติบุคลากร</button>
  </div>
  {tab==='evidence'&&<section>
   <h2 className="mb-2 text-lg font-semibold">หลักฐานจากครูทุกคน</h2>
   <p className="mb-4 text-sm text-slate-600">ตรวจความสอดคล้องกับประเด็น SAR และเอกสารต้นทางก่อนรับรอง การรับรองไม่ได้ประเมินระดับคุณภาพโดยอัตโนมัติ</p>
   <div className="divide-y divide-slate-200">{evidence.map(x=><article key={x.id} className="py-4">
    <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-slate-500">{name(x.owner_user_id)} · พ.ศ. {x.activity_year_be} · {x.kind}</p>
     <h3 className="font-semibold">{x.title}</h3><p className="text-sm text-slate-700">{x.description}</p>
     <p className="text-xs text-slate-500">หัวข้อที่เชื่อม: {x.target_codes?.join(', ')||'ยังไม่ระบุ'}</p>
    </div><span className="text-xs">{x.verification_status==='verified'?'รับรองแล้ว':x.verification_status==='rejected'?'ส่งกลับแก้ไข':'รอตรวจสอบ'}</span></div>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
     {x.storage_path&&<button className="text-blue-700 underline" onClick={()=>void openStorage(x.storage_path!)}>เปิดไฟล์</button>}
     {x.drive_url&&<a href={x.drive_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">ดู Google Drive</a>}
     {x.verification_status!=='verified'&&<button className="ui-primary" disabled={busy} onClick={()=>void review(x,'verified')}>รับรองหลักฐาน</button>}
     {x.verification_status!=='rejected'&&<button className="ui-secondary" disabled={busy} onClick={()=>void review(x,'rejected')}>ส่งกลับแก้ไข</button>}
     {x.verification_status!=='draft'&&<button className="text-slate-600 underline" disabled={busy} onClick={()=>void review(x,'draft')}>ยกเลิกสถานะ</button>}
    </div>
   </article>)}{!evidence.length&&<p className="py-5 text-sm text-slate-500">ยังไม่มีหลักฐานปีการศึกษานี้</p>}</div>
  </section>}
  {tab==='staff'&&<section>
   <p className="mb-3 text-sm text-slate-600">ข้อมูลทะเบียนวิชาชีพเพื่อสรุป SAR ไม่เปลี่ยนแปลงสิทธิ์บัญชี Wichakan ของครู</p>
   <label className="text-sm font-medium">บุคลากร <select className={input+' mt-2'} value={staffId} onChange={e=>setStaffId(e.target.value)}>
    {staff.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name??p.user_id.slice(0,8)}</option>)}</select></label>
   {form&&<form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={e=>void saveProfile(e)}>
    {([
     ['name_title','คำนำหน้า'],
     ['employment_type','ประเภทบุคลากร / การจ้างงาน'],
     ['position_title','ตำแหน่ง'],
     ['qualification','วุฒิการศึกษา'],
     ['major','สาขาวิชา'],
     ['academic_rank','วิทยฐานะ']
    ] as const).map(([key,label])=><label key={key} className="text-sm">{label}<input className={input+' mt-1'} value={form[key]} onChange={e=>setForm(old=>old?{...old,[key]:e.target.value}:old)}/></label>)}
    <label className="text-sm">วันที่เริ่มงาน<input type="date" className={input+' mt-1'} value={form.joined_at??''} onChange={e=>setForm(old=>old?{...old,joined_at:e.target.value}:old)}/></label>
    <label className="text-sm">หมายเหตุ<input className={input+' mt-1'} value={form.notes} onChange={e=>setForm(old=>old?{...old,notes:e.target.value}:old)}/></label>
    <button className="ui-primary w-fit sm:col-span-2" disabled={busy} type="submit">บันทึกข้อมูลบุคลากร</button>
   </form>}
  </section>}
  {loading&&<p role="status">กำลังโหลด...</p>}
 </main>;
}
