'use client';
import {useEffect,useState} from 'react';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {resolveYear} from '@/lib/academic-year-selection';

type Year={id:string;year_be:number;is_active:boolean};
type Subject={id:string;subject_code:string;name_th:string;grade_level:string|null};
const keys=['term1_coursework','term1_midterm','term1_final','term2_coursework','term2_midterm','term2_final'] as const;
const labels=['คะแนนเก็บ','สอบกลางภาค','สอบปลายภาค'];
export default function SubjectScoreSettings({schoolId,subject,canEdit}:{schoolId:string;subject:Subject;canEdit:boolean}){
 const db=getSupabaseBrowserClient(),secondary=subject.grade_level?.startsWith('ม.')??false;
 const defaults=secondary?[60,20,20,60,20,20]:[30,10,10,30,10,10];
 const [years,setYears]=useState<Year[]>([]),[yearId,setYearId]=useState('');
 const [values,setValues]=useState(defaults.map(String)),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[existing,setExisting]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[saveError,setSaveError]=useState('');
 useEffect(()=>{let live=true;(async()=>{
  if(!db){setError('ไม่พบการเชื่อมต่อฐานข้อมูล');setLoading(false);return;}
  try{const {data,error:e}=await db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('year_be',{ascending:false});
   if(!live)return;if(e){setError(e.message);setLoading(false);return;}
   setYears(data??[]);setYearId(resolveYear(data??[],schoolId));if(!data?.length)setLoading(false);
  }catch(e){if(live){setError(e instanceof Error?e.message:'โหลดปีการศึกษาไม่สำเร็จ');setLoading(false);}}
 })();return()=>{live=false;};},[db,schoolId]);
 useEffect(()=>{let live=true;if(!db||!yearId)return;setLoading(true);setError('');setSaveError('');setNotice('');
 (async()=>{try{
  const {data,error:e}=await db.from('subject_score_settings').select(keys.join(',')).eq('school_id',schoolId).eq('academic_year_id',yearId).eq('subject_id',subject.id);
  if(!live)return;if(e){setError(e.message);return;}
  const row=data?.[0] as unknown as Record<typeof keys[number],number>|undefined;
  setExisting(!!row);setValues(row?keys.map(k=>String(row[k])):(secondary?[60,20,20,60,20,20]:[30,10,10,30,10,10]).map(String));
 }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดโครงสร้างคะแนนไม่สำเร็จ');}finally{if(live)setLoading(false);}})();
 return()=>{live=false;};},[db,schoolId,yearId,subject.id,secondary]);
 const totals=[0,1].map(t=>values.slice(t*3,t*3+3).reduce((sum,v)=>sum+(Number(v)||0),0));
 const cap=secondary?100:50,supported=secondary||subject.grade_level?.startsWith('ป.');
 const complete=values.every(v=>v.trim()!==''&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=100);
 const valid=!!supported&&complete&&totals.every(t=>t===cap);
 async function save(){
  if(!db||!canEdit||busy||loading||!yearId||!valid||error)return;
  setBusy(true);setNotice('');setSaveError('');
  try{const {error:e}=await db.rpc('save_subject_score_settings',{p_school_id:schoolId,p_year_id:yearId,p_subject_id:subject.id,p_scores:values.map(Number)});
   if(e)setSaveError(e.message);else{setExisting(true);setNotice('บันทึกโครงสร้างคะแนนเรียบร้อยแล้ว');}
  }catch(e){setSaveError(e instanceof Error?e.message:'บันทึกโครงสร้างคะแนนไม่สำเร็จ');}finally{setBusy(false);}
 }
 return <section aria-label="โครงสร้างคะแนนรายวิชา" className="subject-score-settings">
  <h3>{subject.subject_code} {subject.name_th}</h3>
  <label className="mt-3 block">ปีการศึกษา<select aria-label="ปีการศึกษาของโครงสร้างคะแนน" value={yearId} disabled={busy||!years.length} onChange={e=>setYearId(e.target.value)} className="mt-1 w-full border p-2.5">{!years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
  {loading?<p role="status" className="mt-3 text-sm text-slate-500">กำลังโหลดโครงสร้างคะแนน...</p>:<>
   {!canEdit&&<p className="mt-3 text-xs text-slate-500">เฉพาะ Admin สามารถแก้ไขโครงสร้างคะแนน</p>}
   {yearId&&!error&&<>
    <p className="mt-3 text-xs text-slate-500">{existing?'โครงสร้างคะแนนที่บันทึกไว้':'ค่าเริ่มต้นตามระดับชั้น'} · ภาคเรียนละ {cap} คะแนน</p>
    <div className="subject-score-terms">{[0,1].map(term=><fieldset key={term} disabled={!canEdit||busy} className="min-w-0 rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold">ภาคเรียนที่ {term+1}</legend>{labels.map((label,i)=><label key={label} className="mt-3 block">{label}<input aria-label={label+' ภาคเรียนที่ '+(term+1)} type="number" min="0" max="100" step="1" value={values[term*3+i]} onChange={e=>{setValues(old=>old.map((v,j)=>j===term*3+i?e.target.value:v));setNotice('');}} className="mt-1 w-full min-w-0 border p-2.5"/></label>)}<p className={'mt-3 text-sm font-semibold '+(totals[term]===cap?'text-emerald-700':'text-red-700')}>รวม {totals[term]}/{cap}</p></fieldset>)}</div>
    {!valid&&<p role="alert" className="mt-3 text-sm text-red-700">{!supported?'ระดับชั้นนี้ไม่รองรับการตั้งคะแนน':!complete?'กรอกคะแนนทั้ง 6 ช่องเป็นจำนวนเต็ม 0–100':'คะแนนแต่ละภาคเรียนต้องรวม '+cap+' คะแนน'}</p>}
   </>}
  </>}
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  {saveError&&<p role="alert" className="mt-3 text-sm text-red-700">{saveError}</p>}
  {notice&&<p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
  {canEdit&&<button type="button" className="ui-primary mt-4 w-full" disabled={loading||busy||!yearId||!valid||!!error} onClick={save}>{busy?'กำลังบันทึก...':'บันทึกโครงสร้างคะแนน'}</button>}
 </section>;
}
