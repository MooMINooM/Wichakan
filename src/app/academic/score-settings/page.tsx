'use client';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {resolveYear} from '@/lib/academic-year-selection';
type Year={id:string;year_be:number;is_active:boolean};
type Subject={id:string;subject_code:string;name_th:string;grade_level:string|null};
type Settings={subject_id:string;term1_coursework:number;term1_midterm:number;term1_final:number;term2_coursework:number;term2_midterm:number;term2_final:number};
const defaults=[30,10,10,30,10,10];
const keys=['term1_coursework','term1_midterm','term1_final','term2_coursework','term2_midterm','term2_final'] as const;
const labels=['คะแนนเก็บ','สอบกลางภาค','สอบปลายภาค'];
export default function ScoreSettingsPage(){
 const router=useRouter(),db=getSupabaseBrowserClient();
 const [schoolId,setSchoolId]=useState(''),[years,setYears]=useState<Year[]>([]),[yearId,setYearId]=useState('');
 const [subjects,setSubjects]=useState<Subject[]>([]),[subjectId,setSubjectId]=useState(''),[saved,setSaved]=useState<Settings[]>([]);
 const [values,setValues]=useState<string[]>(defaults.map(String)),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState('');
 useEffect(()=>{let live=true;(async()=>{if(!db){setError('ไม่พบการเชื่อมต่อฐานข้อมูล');setLoading(false);return;}
 const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
 const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1);
 if(!live)return;if(m.error){setError(m.error.message);setLoading(false);return;}if(!m.data?.length){router.replace('/workspace');return;}
 const school=m.data[0].school_id;setSchoolId(school);
 const [y,s]=await Promise.all([db.from('academic_years').select('id,year_be,is_active').eq('school_id',school).order('year_be',{ascending:false}),
 db.from('subjects').select('id,subject_code,name_th,grade_level').eq('school_id',school).order('grade_level').order('subject_code')]);
 if(!live)return;if(y.error||s.error){setError(y.error?.message??s.error?.message??'โหลดข้อมูลไม่สำเร็จ');setLoading(false);return;}
 setYears(y.data??[]);setSubjects(s.data??[]);setYearId(resolveYear(y.data??[],school));setLoading(false);
 })();return()=>{live=false;};},[db,router]);
 useEffect(()=>{let live=true;(async()=>{setSaved([]);if(!db||!schoolId||!yearId)return;
 const {data,error:e}=await db.from('subject_score_settings').select('subject_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final').eq('school_id',schoolId).eq('academic_year_id',yearId);
 if(!live)return;if(e)setError(e.message);else setSaved(data??[]);
 })();return()=>{live=false;};},[db,schoolId,yearId]);
 useEffect(()=>{const match=saved.find(s=>s.subject_id===subjectId);setValues(match?keys.map(k=>String(match[k])):(subjects.find(s=>s.id===subjectId)?.grade_level?.startsWith('ม.')?[60,20,20,60,20,20]:defaults).map(String));setNotice('');},[subjectId,saved]);
 const filtered=useMemo(()=>subjects.filter(s=>(s.subject_code+' '+s.name_th+' '+(s.grade_level??'')).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[subjects,query]);
 const secondary=subjects.find(s=>s.id===subjectId)?.grade_level?.startsWith('ม.')??false;
 const t1=values.slice(0,3).reduce((a,v)=>a+(Number(v)||0),0),t2=values.slice(3).reduce((a,v)=>a+(Number(v)||0),0);
 const sum=values.reduce((a,v)=>a+(Number(v)||0),0);
 const complete=values.every(v=>v.trim()!==''&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=100);
 const valid=complete&&(secondary?t1===100&&t2===100:t1===50&&t2===50);
 const existing=saved.some(s=>s.subject_id===subjectId);
 async function save(){
  if(!db||busy||!schoolId||!yearId||!subjectId||!valid)return;
  setBusy(true);setError('');setNotice('');
  const {error:e}=await db.rpc('save_subject_score_settings',{p_school_id:schoolId,p_year_id:yearId,p_subject_id:subjectId,p_scores:values.map(Number)});
  if(e)setError(e.message);else{
    setSaved(prev=>[...prev.filter(s=>s.subject_id!==subjectId),{subject_id:subjectId,...Object.fromEntries(keys.map((k,i)=>[k,Number(values[i])]))} as Settings]);
    setNotice('บันทึกโครงสร้างคะแนนเรียบร้อยแล้ว');
  }
  setBusy(false);
 }
 return <main className="wichakan-page mx-auto max-w-6xl px-4 py-5 sm:px-6">
 <Link href="/academic" className="text-sm font-semibold text-blue-700">← ตั้งค่างานวิชาการ</Link>
 <PageHeader title="ตั้งค่าโครงสร้างคะแนน" context="ประถม 50 คะแนนต่อภาคเรียน · มัธยม 100 คะแนนต่อภาคเรียน"/>
 {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
 {notice&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
 {loading?<p className="mt-5 text-sm">กำลังโหลด...</p>:<div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.4fr)]">
 <section className="ui-panel"><label className="block text-sm font-semibold">ปีการศึกษา<select value={yearId} onChange={e=>{setYearId(e.target.value);setSubjectId('');}} className="mt-2 w-full rounded-xl border p-3"><option value="">เลือกปี</option>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
 <h2 className="mt-5 font-bold">เลือกรายวิชา</h2>
 <input aria-label="ค้นหารายวิชา" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหารหัส ชื่อวิชา หรือชั้นเรียน" className="mt-2 w-full rounded-xl border p-3 text-sm"/>
 <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto">{filtered.map(s=><button key={s.id} type="button" onClick={()=>setSubjectId(s.id)} className={`flex w-full justify-between gap-3 rounded-xl border p-3 text-left text-sm ${subjectId===s.id?'border-blue-500 bg-blue-50':'hover:bg-slate-50'}`}><span><strong>{s.subject_code}</strong> {s.name_th}<small className="mt-1 block text-slate-500">{s.grade_level??'ไม่ระบุระดับชั้น'}</small></span><span className={saved.some(x=>x.subject_id===s.id)?'text-emerald-700':'text-amber-700'}>{saved.some(x=>x.subject_id===s.id)?'ตั้งแล้ว':'ยังไม่ตั้ง'}</span></button>)}{!filtered.length&&<p className="text-sm text-slate-500">ไม่พบรายวิชา</p>}</div></section>
 <section className="ui-panel">
 {!subjectId?<p className="py-16 text-center text-slate-500">เลือกรายวิชาทางซ้ายเพื่อกำหนดคะแนนเต็ม</p>:<>
 <h2 className="text-lg font-bold text-blue-950">{subjects.find(s=>s.id===subjectId)?.name_th}</h2><p className="mt-1 text-xs text-slate-500">{existing?'แก้ไขโครงสร้างคะแนนเดิม':'ยังไม่ได้ตั้งค่า จะใช้ค่าเริ่มต้นตามระดับชั้น'}</p>
 <div className="mt-5 grid gap-5 sm:grid-cols-2">{[0,1].map(term=><div key={term} className="rounded-xl border border-blue-100 p-4"><h3 className="font-bold text-blue-900">ภาคเรียนที่ {term+1}</h3>
 {labels.map((label,i)=><label key={label} className="mt-4 block text-sm">{label}<span className="ml-1 text-xs text-slate-500">(คะแนนเต็ม)</span><input type="number" min="0" max="100" step="1" value={values[term*3+i]} onChange={e=>setValues(old=>old.map((x,j)=>j===term*3+i?e.target.value:x))} className="mt-1 w-full rounded-xl border p-3"/></label>)}
 <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">รวมภาคเรียน {term+1}: {term===0?t1:t2}/{secondary?100:'ตามสัดส่วนรายปี'} คะแนน</div></div>)}</div>
 <div className={`mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl p-4 ${valid?'bg-emerald-50 text-emerald-900':'bg-red-50 text-red-900'}`}><strong>{secondary?'คะแนนเต็มภาคเรียนละ 100':'คะแนนเต็มภาคเรียนละ 50'}</strong><strong className="text-2xl">{secondary?`${t1}/100 · ${t2}/100`:`${t1}/50 · ${t2}/50`}</strong></div>
 {!valid&&<p role="alert" className="mt-3 text-sm font-medium text-red-700">{!complete?'กรุณากรอกคะแนนเต็มทั้ง 6 ช่อง เป็นจำนวนเต็มตั้งแต่ 0 ถึง 100':secondary?'ภาคเรียนที่ 1 และ 2 ต้องเต็มภาคเรียนละ 100 คะแนน':t1!==50||t2!==50?'ประถมศึกษาต้องเต็มภาคเรียนละ 50 คะแนน':sum<100?`คะแนนยังขาด ${100-sum} คะแนน กรุณาปรับให้ครบ 100`:`คะแนนเกิน ${sum-100} คะแนน กรุณาปรับให้เหลือ 100`}</p>}
 <button type="button" disabled={!valid||busy} onClick={save} className="ui-primary mt-4 w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy?'กำลังบันทึก...':'บันทึกโครงสร้างคะแนน'}</button>
 <p className="mt-3 text-xs text-slate-500">ระบบตรวจสอบซ้ำในฐานข้อมูล: ประถมแต่ละภาคเรียน 50 / มัธยมแต่ละภาคเรียน 100</p>
 </>}</section></div>}
 </main>;
}