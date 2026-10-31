'use client';
import {useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Signers={assessment_head_name:string;academic_head_name:string;director_name:string};
type SavedSigners=Signers&{academic_year_id:string};
const blank:Signers={assessment_head_name:'',academic_head_name:'',director_name:''};
export default function Pp5SignatoriesAdmin(){
 const [schoolId,setSchoolId]=useState(''),[years,setYears]=useState<Year[]>([]),
 [selectedYear,setSelectedYear]=useState(''),[saved,setSaved]=useState<Record<string,Signers>>({}),
 [form,setForm]=useState<Signers>(blank),[loading,setLoading]=useState(true),
 [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{
  let live=true;
  (async()=>{try{
   const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล Supabase');
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user)throw Error('กรุณาเข้าสู่ระบบ Admin');
   const {data:member,error:memberError}=await db.from('school_memberships')
    .select('school_id').eq('user_id',user.id).eq('active',true).eq('role','school_admin').limit(1).maybeSingle();
   if(memberError||!member)throw Error('เฉพาะ Admin โรงเรียนเท่านั้นที่กำหนดผู้ลงนาม ปพ.5 ได้');
   const [y,s]=await Promise.all([
    db.from('academic_years').select('id,year_be,is_active').eq('school_id',member.school_id).order('year_be',{ascending:false}),
    db.from('pp5_signatories').select('academic_year_id,assessment_head_name,academic_head_name,director_name').eq('school_id',member.school_id)
   ]);
   if(y.error||s.error)throw Error(y.error?.message||s.error?.message);
   if(!live)return;
   const yearList=(y.data??[]) as Year[],stored=Object.fromEntries(((s.data??[]) as SavedSigners[])
    .map(({academic_year_id,...signers})=>[academic_year_id,signers]));
   const current=yearList.find(y=>y.is_active)?.id??yearList[0]?.id??'';
   setSchoolId(member.school_id);setYears(yearList);setSaved(stored);setSelectedYear(current);setForm(stored[current]??blank);
  }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}
  finally{if(live)setLoading(false);}})();
  return()=>{live=false;};
 },[]);
 function chooseYear(id:string){if(busy)return;
  if(dirty&&!window.confirm('ข้อมูลผู้ลงนามยังไม่ได้บันทึก ต้องการเปลี่ยนปีการศึกษาหรือไม่?'))return;
  setSelectedYear(id);setForm(saved[id]??blank);setMessage('');setError('');
 }
 const dirty=JSON.stringify(form)!==JSON.stringify(saved[selectedYear]??blank);
 const currentYear=years.find(y=>y.id===selectedYear);
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!schoolId||!selectedYear||busy)return;
  const db=getSupabaseBrowserClient();if(!db){setError('ไม่พบฐานข้อมูล Supabase');return;}
  const trimmed:Signers={
   assessment_head_name:form.assessment_head_name.trim(),
   academic_head_name:form.academic_head_name.trim(),
   director_name:form.director_name.trim()
  };
  setBusy(true);setError('');setMessage('');
  try{
   const {error:rpcError}=await db.rpc('save_pp5_signatories',{
    p_school_id:schoolId,p_year_id:selectedYear,
    p_assessment_head:trimmed.assessment_head_name,
    p_academic_head:trimmed.academic_head_name,
    p_director:trimmed.director_name
   });
   if(rpcError)throw rpcError;
   setSaved(previous=>({...previous,[selectedYear]:trimmed}));setForm(trimmed);
   setMessage('บันทึกผู้ลงนาม ปพ.5 ปีการศึกษา '+currentYear?.year_be+' เรียบร้อยแล้ว');
  }catch(e){setError(e instanceof Error?e.message:'บันทึกข้อมูลไม่สำเร็จ');}
  finally{setBusy(false);}
 }
 return <main className="wichakan-page mx-auto max-w-4xl">
  <PageHeader title="ผู้ลงนามใน ปพ.5"/>
  <p className="mb-5 text-sm text-slate-600">กำหนดชื่อผู้ลงนามบนหน้าปก ปพ.5 แยกตามปีการศึกษา โดยครูผู้สอนจะดึงชื่อจากระบบอัตโนมัติ ไม่ต้องตั้งค่าซ้ำแต่ละวิชา</p>
  {error&&<p role="alert" className="teacher-error mb-4">{error}</p>}
  {message&&<p role="status" className="teacher-success mb-4">{message}</p>}
  {loading?<p role="status">กำลังโหลดข้อมูลผู้ลงนาม...</p>:!schoolId?
   <p role="alert" className="teacher-error">ไม่สามารถเข้าใช้หน้าตั้งค่านี้ได้</p>:
   <form onSubmit={e=>void save(e)} className="ui-panel">
    <label className="block mb-5 font-medium">ปีการศึกษา
     <select className="mt-2 block w-full max-w-sm border rounded-lg p-3 bg-white" value={selectedYear} onChange={e=>chooseYear(e.target.value)} disabled={busy}>
      {years.length===0&&<option value="">ยังไม่มีปีการศึกษา</option>}
      {years.map(y=><option key={y.id} value={y.id}>{y.year_be}{y.is_active?' (ปีปัจจุบัน)':''}</option>)}
     </select>
    </label>
    <div className="grid gap-5">
     {([
      ['assessment_head_name','หัวหน้างานวัดและประเมินผล'],
      ['academic_head_name','หัวหน้าฝ่ายวิชาการ'],
      ['director_name','ผู้อำนวยการโรงเรียน']
     ] as const).map(([id,label],i)=><label key={id} className="block">
      <span className="font-semibold text-slate-800">{i+1}. {label}</span>
      <input className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3"
       type="text" maxLength={150} autoComplete="off"
       placeholder="คำนำหน้า ชื่อ และนามสกุล"
       value={form[id]} onChange={e=>{setForm(f=>({...f,[id]:e.target.value}));setMessage('');}} disabled={busy||!selectedYear}/>
     </label>)}
    </div>
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
     <button type="submit" className="ui-primary" disabled={busy||!selectedYear||!dirty}>{busy?'กำลังบันทึก...':'บันทึกผู้ลงนาม'}</button>
     <span className="text-xs text-slate-500">{dirty?'มีข้อมูลที่ยังไม่บันทึก':'ข้อมูลปัจจุบันบันทึกแล้ว'}</span>
    </div>
    <p className="mt-4 text-xs text-slate-500">เว้นว่างเพื่อใช้ลายมือชื่อ · ชื่อครูผู้สอนอ้างอิงจากงานสอน</p>
   </form>}
 </main>;
}
