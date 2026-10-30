'use client';
import {useCallback,useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Result={id:string;exam:string;grade_level:string;subject_or_domain:string;participant_count:number|null;school_mean:number|null;province_mean:number|null;national_mean:number|null;source_note:string};
const exams=['RT','NT','O-NET'] as const;
const grades:Record<string,string[]>={'RT':['ป.1'],'NT':['ป.3'],'O-NET':['ป.6','ม.3']};
export default function SarNationalTests(){
 const [school,setSchool]=useState(''),[years,setYears]=useState<Year[]>([]),[year,setYear]=useState('');
 const [exam,setExam]=useState('RT'),[grade,setGrade]=useState('ป.1'),[domain,setDomain]=useState(''),[count,setCount]=useState(''),[schoolAvg,setSchoolAvg]=useState(''),[provinceAvg,setProvinceAvg]=useState(''),[nationalAvg,setNationalAvg]=useState(''),[source,setSource]=useState('');
 const [data,setData]=useState<Result[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล');
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบ');
  const {data:m,error:e}=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1).maybeSingle();
  if(e||!m)throw Error('เฉพาะ Admin ที่สามารถจัดการข้อมูลผลสอบระดับชาติได้');
  const y=await db.from('academic_years').select('id,year_be,is_active').eq('school_id',m.school_id).order('year_be',{ascending:false});
  if(y.error)throw Error(y.error.message);if(!live)return;
  const list=y.data as Year[];setYears(list);setSchool(m.school_id);setYear(list.find(v=>v.is_active)?.id??list[0]?.id??'');
 }catch(e){if(live)setError((e as Error).message)}finally{if(live)setLoading(false)}})();return()=>{live=false}},[]);
 const load=useCallback(async()=>{if(!school||!year)return;const db=getSupabaseBrowserClient();if(!db)return;
  const {data,error:e}=await db.from('sar_national_results').select('id,exam,grade_level,subject_or_domain,participant_count,school_mean,province_mean,national_mean,source_note').eq('school_id',school).eq('academic_year_id',year).order('exam').order('grade_level').order('subject_or_domain');
  if(e)setError(e.message);else setData((data??[]) as Result[]);
 },[school,year]);
 useEffect(()=>{void load()},[load]);
 const number=(x:string)=>x.trim()===''?null:Number(x);
 function choose(v:Result){setExam(v.exam);setGrade(v.grade_level);setDomain(v.subject_or_domain);setCount(String(v.participant_count??''));setSchoolAvg(String(v.school_mean??''));setProvinceAvg(String(v.province_mean??''));setNationalAvg(String(v.national_mean??''));setSource(v.source_note);}
 async function save(){if(!year||!domain.trim()||busy)return;const values=[schoolAvg,provinceAvg,nationalAvg].filter(x=>x.trim()!=='');if(values.some(v=>!Number.isFinite(Number(v))||Number(v)<0||Number(v)>100)||count&&(!Number.isInteger(Number(count))||Number(count)<0)){setError('ตรวจสอบจำนวนผู้เข้าสอบและคะแนนเฉลี่ย 0–100');return;}
  setBusy(true);setError('');setNotice('');try{
   const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล');
   const {error:e}=await db.rpc('sar_save_national_result',{p_year:year,p_exam:exam,p_grade:grade,p_subject:domain.trim(),p_participants:number(count),p_school_mean:number(schoolAvg),p_province_mean:number(provinceAvg),p_national_mean:number(nationalAvg),p_source:source});
   if(e)throw Error(e.message);await load();setNotice('บันทึกผลสอบเรียบร้อย');setDomain('');setCount('');setSchoolAvg('');setProvinceAvg('');setNationalAvg('');setSource('');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <main className="wichakan-page mx-auto max-w-5xl px-4 pb-12">
  <PageHeader title="ผล RT / NT / O-NET สำหรับ SAR" context="บันทึกผลทดสอบระดับชาติแยกปีการศึกษา ระดับชั้น และรายด้าน"/>
  <p className="mb-5 text-sm text-slate-600">กรอกตามรายงานผลสอบที่ได้รับการรับรอง ระบบจะไม่สร้างคะแนนปีเก่าหรือเติมค่าเฉลี่ยที่ไม่ทราบโดยอัตโนมัติ</p>
  {error&&<p role="alert" className="teacher-error mb-3">{error}</p>}{notice&&<p role="status" className="teacher-success mb-3">{notice}</p>}
  {loading?<p>กำลังโหลดข้อมูล...</p>:!school?<p>ไม่มีสิทธิ์ใช้งาน</p>:<>
   <label className="mb-5 block text-sm font-medium">ปีการศึกษา
    <select className="mt-1 block rounded-lg border border-slate-300 bg-white p-2" value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select>
   </label>
   <section className="mb-8 border-y border-slate-200 py-5"><h2 className="mb-4 font-semibold">บันทึกหรือแก้ไขผลสอบ</h2>
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="text-sm">การทดสอบ<select className="mt-1 block w-full rounded-lg border p-2" value={exam} onChange={e=>{setExam(e.target.value);setGrade(grades[e.target.value][0])}}>{exams.map(x=><option key={x}>{x}</option>)}</select></label>
     <label className="text-sm">ชั้นเรียน<select className="mt-1 block w-full rounded-lg border p-2" value={grade} onChange={e=>setGrade(e.target.value)}>{grades[exam].map(x=><option key={x}>{x}</option>)}</select></label>
     <label className="text-sm sm:col-span-2">วิชา / ด้านการประเมิน<input className="mt-1 block w-full rounded-lg border p-2" maxLength={150} value={domain} onChange={e=>setDomain(e.target.value)} placeholder="เช่น ความสามารถด้านการอ่านรู้เรื่อง / คณิตศาสตร์"/></label>
     <label className="text-sm">จำนวนผู้เข้าสอบ<input className="mt-1 block w-full rounded-lg border p-2" type="number" min={0} step={1} value={count} onChange={e=>setCount(e.target.value)}/></label>
     {([[schoolAvg,setSchoolAvg,'คะแนนเฉลี่ยโรงเรียน'],[provinceAvg,setProvinceAvg,'คะแนนเฉลี่ยจังหวัด'],[nationalAvg,setNationalAvg,'คะแนนเฉลี่ยประเทศ']] as const).map(([v,fn,label])=><label className="text-sm" key={label}>{label}
      <input className="mt-1 block w-full rounded-lg border p-2" type="number" min={0} max={100} step="0.01" value={v} onChange={e=>fn(e.target.value)}/></label>)}
     <label className="text-sm sm:col-span-2">แหล่งข้อมูล / หมายเหตุ<input className="mt-1 block w-full rounded-lg border p-2" maxLength={1200} value={source} onChange={e=>setSource(e.target.value)} placeholder="อ้างอิงรายงานผลสอบและวันที่ประกาศ"/></label>
    </div>
    <button className="ui-primary mt-4" type="button" disabled={busy||!domain.trim()} onClick={()=>void save()}>{busy?'กำลังบันทึก':'บันทึกผลสอบ'}</button>
   </section>
   <section><h2 className="mb-3 font-semibold">ผลสอบที่บันทึก ({data.length})</h2>
    <div className="overflow-x-auto border-y border-slate-200"><table className="w-full min-w-[700px] text-sm"><thead><tr className="bg-slate-50"><th className="p-2 text-left">การสอบ</th><th className="p-2 text-left">วิชา / ด้าน</th><th className="p-2">ผู้เข้าสอบ</th><th className="p-2">โรงเรียน</th><th className="p-2">จังหวัด</th><th className="p-2">ประเทศ</th><th className="p-2">จัดการ</th></tr></thead>
     <tbody>{data.map(v=><tr key={v.id} className="border-t border-slate-100"><td className="p-2">{v.exam} {v.grade_level}</td><td className="p-2">{v.subject_or_domain}</td><td className="p-2 text-center">{v.participant_count??'—'}</td><td className="p-2 text-center">{v.school_mean??'—'}</td><td className="p-2 text-center">{v.province_mean??'—'}</td><td className="p-2 text-center">{v.national_mean??'—'}</td><td className="p-2"><button className="text-blue-700 underline" onClick={()=>choose(v)}>แก้ไข</button></td></tr>)}</tbody>
    </table>{!data.length&&<p className="p-4 text-sm text-slate-500">ยังไม่มีผลสอบในปีที่เลือก</p>}</div>
   </section>
  </>}
 </main>;
}
