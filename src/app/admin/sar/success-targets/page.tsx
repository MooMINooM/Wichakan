'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Detail={code:string;parent_code:string;description:string};
type Value={indicator_code:string;target_percent:number};
export default function SarSuccessTargets(){
 const db=getSupabaseBrowserClient();
 const [school,setSchool]=useState(''),[years,setYears]=useState<Year[]>([]),[year,setYear]=useState(''),[items,setItems]=useState<Detail[]>([]);
 const [values,setValues]=useState<Record<string,string>>({}),[published,setPublished]=useState(false),
 [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ไม่พบฐานข้อมูล');const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบ');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('เฉพาะ Admin จึงจัดการค่าเป้าหมายได้');
  const sid=m.data.school_id as string;
  const [y,i]=await Promise.all([db.from('academic_years').select('id,year_be,is_active').eq('school_id',sid).order('year_be',{ascending:false}),
   db.from('sar_success_indicators').select('code,parent_code,description').order('code')]);
  if(y.error||i.error)throw Error(y.error?.message||i.error?.message);
  if(!live)return;const list=y.data as Year[];setSchool(sid);setYears(list);setYear(list.find(x=>x.is_active)?.id??list[0]?.id??'');
  setItems((i.data as Detail[]).sort((a,b)=>a.code.localeCompare(b.code,'en',{numeric:true})));
 }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดไม่สำเร็จ');}finally{if(live)setLoading(false)}})();return()=>{live=false};},[db]);
 useEffect(()=>{if(!school||!year||!db)return;let live=true;setLoading(true);setError('');setNotice('');
  void Promise.all([db.from('sar_success_targets').select('indicator_code,target_percent').eq('school_id',school).eq('academic_year_id',year),
   db.from('sar_year_settings').select('status').eq('school_id',school).eq('academic_year_id',year).maybeSingle()])
  .then(([v,s])=>{if(v.error||s.error)throw Error(v.error?.message||s.error?.message);if(!live)return;
   setValues(Object.fromEntries(((v.data??[]) as Value[]).map(x=>[x.indicator_code,String(x.target_percent)])));
   setPublished(s.data?.status==='published');
  }).catch(e=>{if(live)setError((e as Error).message)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[school,year,db]);
 const grouped=[...new Set(items.map(i=>i.parent_code))];
 const completed=items.filter(i=>values[i.code]?.trim()!=='').length;
 async function save(){
  if(!db||!year||busy||published)return;
  const rows:{code:string;target_percent:number}[]=[];
  for(const i of items){
   const raw=values[i.code]?.trim()??'';
   if(!raw)continue;
   if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw)||Number(raw)>100){
    setError('ค่าเป้าหมาย '+i.code+' ต้องอยู่ระหว่าง 0–100% ไม่เกินทศนิยมสองตำแหน่ง');return;
   }
   rows.push({code:i.code,target_percent:Number(raw)});
  }
  setBusy(true);setError('');setNotice('');
  try{const r=await db.rpc('sar_save_success_targets',{p_year:year,p_values:rows});if(r.error)throw Error(r.error.message);
   setNotice('บันทึกค่าเป้าหมายตัวชี้วัดย่อยแล้ว '+rows.length+' รายการ');}
  catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false)}
 }
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-12">
  <PageHeader title="ค่าเป้าหมายตัวชี้วัดความสำเร็จรายข้อ" context="รายละเอียดตามภาคผนวกประกาศค่าเป้าหมาย SAR ปี 2568 หน้า 152–158"/>
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
   <label className="text-sm font-medium">ปีการศึกษา <select className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2" value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <Link className="text-sm text-blue-700 underline" href="/admin/sar">← กลับตารางค่าเป้าหมายหลัก</Link>
  </div>
  {error&&<p className="teacher-error mb-3" role="alert">{error}</p>}{notice&&<p className="teacher-success mb-3" role="status">{notice}</p>}
  <p className="mb-4 text-sm text-slate-600">ตารางนี้แยกจากค่าเป้าหมายหลัก 27 รายการเพื่อให้เห็นรายละเอียดการดำเนินงาน เช่น รายวิชาที่ได้ระดับ 3 ขึ้นไป ทักษะดิจิทัล โครงงาน และเครื่องมือวัดผล</p>
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-3">
   <p className="text-sm">กำหนดแล้ว <strong>{completed}/{items.length||57}</strong> รายการ {published?'· ประกาศแล้วและล็อกไม่ให้แก้ไข':'· ฉบับร่าง'}</p>
   <button className="ui-primary" disabled={busy||published||loading} onClick={()=>void save()}>{busy?'กำลังบันทึก...':'บันทึกค่าเป้าหมายรายข้อ'}</button>
  </div>
  {grouped.map(group=><section key={group} className="mb-6">
   <h2 className="mb-2 text-base font-semibold">ประเด็น {group}</h2>
   <div className="overflow-x-auto border-y border-slate-200"><table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
    <thead><tr className="bg-slate-50"><th className="w-24 border-b p-3 text-left">รหัส</th><th className="border-b p-3 text-left">รายการความสำเร็จ</th><th className="w-36 border-b p-3 text-right">เป้าหมาย (%)</th></tr></thead>
    <tbody>{items.filter(i=>i.parent_code===group).map(i=><tr key={i.code}><td className="border-b border-slate-100 p-3 font-medium">{i.code}</td>
     <td className="border-b border-slate-100 p-3">{i.description}</td>
     <td className="border-b border-slate-100 p-2"><input type="number" inputMode="decimal" min={0} max={100} step="0.01" placeholder="—" disabled={published||busy}
      aria-label={'เป้าหมาย '+i.code} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-right tabular-nums disabled:border-transparent disabled:bg-transparent"
      value={values[i.code]??''} onChange={e=>setValues(old=>({...old,[i.code]:e.target.value}))}/></td></tr>)}</tbody>
   </table></div>
  </section>)}
  <div className="mt-5 border-t border-slate-200 pt-4"><button className="ui-primary" disabled={busy||published||loading} onClick={()=>void save()}>บันทึกค่าเป้าหมายรายข้อ</button></div>
  <p className="mt-4 text-xs text-slate-500">ปี 2568 นำเข้าข้อมูลจากภาคผนวก Word เพื่อใช้ตรวจสอบ; ปีอื่นต้องกำหนดเอง หากค่าเป้าหมายถูกประกาศแล้ว ระบบจะไม่อนุญาตให้เปลี่ยนย้อนหลัง</p>
 </main>;
}
