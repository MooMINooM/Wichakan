'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type School={id:string;name_th:string};
type Member={school_id:string;role:string;schools:School|null};
type WeightRow={
 year:number;level:string;term:number;subject_code:string;name:string;group:string;students:number;
 rows:number;results_missing:number;weights_missing:number;conflicting_weights:boolean;
 weight:number|null;last_verification:string|null;last_verified_at:string|null
};
const keyOf=(r:WeightRow)=>[r.year,r.level,r.term,r.subject_code].join('|');

export default function SchoolmisWeightsPage(){
 const router=useRouter();
 const [schools,setSchools]=useState<School[]>([]),[schoolId,setSchoolId]=useState('');
 const [rows,setRows]=useState<WeightRow[]>([]),[query,setQuery]=useState('');
 const [yearFilter,setYearFilter]=useState(''),[onlyMissing,setOnlyMissing]=useState(true);
 const [selected,setSelected]=useState(''),[weight,setWeight]=useState(''),[evidence,setEvidence]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db){setError('ไม่พบการเชื่อมต่อฐานข้อมูล');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const r=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
  if(!live)return;if(r.error){setError(r.error.message);return;}
  const m=(r.data??[]) as unknown as Member[];
  const list=[...new Map(m.filter(a=>['school_admin','registrar'].includes(a.role)&&a.schools)
   .map(a=>[a.school_id,a.schools!])).values()];
  setSchools(list);setSchoolId(list[0]?.id??'');if(!list.length)setLoading(false);
 })();return()=>{live=false;};},[router]);
 async function reload(school:string){
  const db=getSupabaseBrowserClient();if(!db)return;
  const r=await db.rpc('schoolmis_review_weights',{p_school:school});
  if(r.error)throw Error(r.error.message);
  setRows((r.data??[]) as WeightRow[]);
 }
 useEffect(()=>{if(!schoolId)return;let active=true;(async()=>{
  setLoading(true);setError('');
  try{const db=getSupabaseBrowserClient();if(!db)return;
    const r=await db.rpc('schoolmis_review_weights',{p_school:schoolId});
    if(active)setRows((r.data??[]) as WeightRow[]);
  }catch(e){if(active)setError(e instanceof Error?e.message:'โหลดรายวิชาไม่สำเร็จ');}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[schoolId]);
 const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>b-a);
 const filtered=useMemo(()=>rows.filter(r=>
  (!yearFilter||r.year===Number(yearFilter))
  &&(!onlyMissing||r.weights_missing>0||r.conflicting_weights)
  &&(!query||[r.subject_code,r.name,r.level,r.group].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()))
 ),[rows,yearFilter,onlyMissing,query]);
 const chosen=rows.find(r=>keyOf(r)===selected);
 const missing=rows.filter(r=>r.weights_missing>0||r.conflicting_weights).length;
 async function save(){
  if(!chosen||!schoolId||busy)return;
  const n=Number(weight);
  if(!Number.isFinite(n)||n<=0||n>30||Math.round(n*100)!==n*100){setError('หน่วยน้ำหนักต้องมากกว่า 0 ไม่เกิน 30 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');return;}
  if(evidence.trim().length<10||evidence.trim().length>500){setError('ระบุหลักฐานที่ตรวจสอบอย่างน้อย 10 ตัวอักษร เช่น ชื่อหลักสูตรฉบับและหน้าที่อ้างอิง');return;}
  if(!window.confirm('ยืนยันน้ำหนัก '+n+' ของ '+chosen.subject_code+' ปี '+chosen.year+' ชั้น '+chosen.level+' จากหลักฐานที่ระบุ? จะมีผลกับนักเรียน '+chosen.students+' คน'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล');
   const r=await db.rpc('schoolmis_verify_weight',{
    p_school:schoolId,p_year:chosen.year,p_level:chosen.level,
    p_term:chosen.term,p_subject_code:chosen.subject_code,p_weight:n,p_evidence_note:evidence.trim()
   });
   if(r.error)throw Error(r.error.message);
   await reload(schoolId);
   setNotice('ตรวจสอบและยืนยันหน่วยน้ำหนักสำเร็จ '+r.data+' รายการ พร้อมเก็บผู้ยืนยันและแหล่งอ้างอิง');
   setSelected('');setWeight('');setEvidence('');
  }catch(e){setError(e instanceof Error?e.message:'ยืนยันข้อมูลไม่สำเร็จ');}
  finally{setBusy(false);}
 }
 return <main className="wichakan-page mx-auto max-w-7xl px-4 py-6">
  <Link href="/students/schoolmis" className="text-sm font-semibold text-blue-700">← นำเข้าประวัติ SchoolMIS</Link>
  <PageHeader title="ตรวจสอบหน่วยน้ำหนักย้อนหลัง"/>
  <p className="mb-4 text-sm text-slate-600">กำหนดหน่วยกิต/หน่วยน้ำหนักจากหลักสูตรในปีการศึกษาจริง ไม่ใช้โครงสร้างวิชาปีปัจจุบันเติมข้อมูลย้อนหลังโดยอัตโนมัติ</p>
  <div className="mb-4"><Link href="/students/schoolmis/weights/bulk" className="ui-secondary inline-flex">ตรวจหลายรายวิชาโดยใช้แม่แบบ CSV</Link></div>
  <section className="ui-panel p-4">
   <div className="flex flex-wrap gap-3 items-end">
    <label className="text-sm">โรงเรียน<select aria-label="เลือกโรงเรียน" className="mt-1 block rounded-lg border p-2" value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>
    <label className="text-sm">ปีการศึกษา<select aria-label="กรองปีการศึกษา" className="mt-1 block rounded-lg border p-2" value={yearFilter} onChange={e=>setYearFilter(e.target.value)}><option value="">ทุกปี</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
    <label className="text-sm">ค้นหารหัสหรือชื่อวิชา<input className="mt-1 block rounded-lg border p-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหารายวิชา"/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyMissing} onChange={e=>setOnlyMissing(e.target.checked)}/>แสดงเฉพาะที่ยังไม่ยืนยัน</label>
   </div>
   <p className="mt-3 text-sm">ทั้งหมด <strong>{rows.length}</strong> รายวิชา/ปี/ชั้น/ภาค · ยังไม่ผ่านการยืนยัน <strong>{missing}</strong> รายการ</p>
  </section>
  {error&&<p role="alert" className="teacher-error mt-3">{error}</p>}
  {notice&&<p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  {loading?<p className="mt-3 text-sm">กำลังโหลดข้อมูล...</p>:<section className="ui-panel mt-4 p-4">
   {rows.length===0?<p className="text-sm text-slate-600">ยังไม่มีข้อมูลย้อนหลังในระบบ กรุณาใช้เมนูนำเข้า SchoolMIS และตรวจสอบก่อนบันทึก</p>:
    <div className="max-h-[580px] overflow-auto"><table className="min-w-[940px] w-full text-sm">
     <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">ปี/ชั้น/ภาค</th><th className="p-2 text-left">รายวิชา</th><th>นักเรียน</th><th>ยังไม่มีผล</th><th>น้ำหนักที่ยืนยัน</th><th>ยังไม่ยืนยัน</th><th>การจัดการ</th></tr></thead>
     <tbody>{filtered.map(r=><tr key={keyOf(r)} className="border-t">
      <td className="p-2 text-center">{r.year} · {r.level} {r.term?'ภาค '+r.term:'รายปี'}</td>
      <td className="p-2">{r.subject_code} {r.name}<div className="text-xs text-slate-500">{r.group}</div></td>
      <td className="text-center">{r.students}</td><td className="text-center">{r.results_missing}</td>
      <td className="text-center">{r.weight??'—'}</td>
      <td className="text-center">{r.weights_missing}{r.conflicting_weights?' (ขัดแย้ง)':''}</td>
      <td className="p-2 text-center"><button className="text-blue-700 underline" onClick={()=>{setSelected(keyOf(r));setWeight(r.weight?.toString()??'');setEvidence(r.last_verification??'');setError('');}}>ตรวจและยืนยัน</button></td>
     </tr>)}</tbody>
    </table></div>}
  </section>}
  {chosen&&<section className="ui-panel mt-4 p-5">
   <h2 className="font-bold">ยืนยันน้ำหนัก · {chosen.subject_code} {chosen.name}</h2>
   <p className="mt-1 text-sm text-slate-600">ปี {chosen.year} ชั้น {chosen.level} {chosen.term?'ภาคเรียนที่ '+chosen.term:'รายปี'} · นักเรียน {chosen.students} คน · มีผลการเรียนไม่ครบ {chosen.results_missing} คน</p>
   <div className="mt-3 flex flex-wrap gap-3">
    <label className="text-sm">หน่วยน้ำหนัก / หน่วยกิต<input type="number" step="0.01" min="0.01" max="30" className="mt-1 block rounded-lg border p-2" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
    <label className="min-w-[240px] flex-1 text-sm">หลักฐานอ้างอิงที่ตรวจสอบ<input className="mt-1 block w-full rounded-lg border p-2" placeholder="เช่น หลักสูตรสถานศึกษา 2565 หน้า 23 / แผนการเรียน" maxLength={500} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
   </div>
   <div className="mt-4 flex gap-3"><button disabled={busy} className="ui-primary" onClick={()=>void save()}>{busy?'กำลังบันทึก...':'ยืนยันพร้อมบันทึกหลักฐาน'}</button><button className="ui-secondary" onClick={()=>setSelected('')}>ยกเลิก</button></div>
  </section>}
 </main>;
}
