'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type Item={code:string;standard_no:number;section_code:string;title:string;item_order:number};
type Year={id:string;year_be:number;is_active:boolean};
type Target={academic_year_id:string;status:'draft'|'published'};
type IndicatorTarget={academic_year_id:string;section_code:string;target_percent:number};
type Response={item_code:string;rating:number|null;note:string};
type Submitted={submitted_at:string};
const levelLabel:Record<number,string>={1:'กำลังพัฒนา',2:'ปานกลาง',3:'ดี',4:'ดีเลิศ',5:'ยอดเยี่ยม'};
const sectionLabels:Record<string,string>={
 '3.1':'จัดการเรียนรู้ผ่านกระบวนการคิดและปฏิบัติจริง',
 '3.2':'ใช้สื่อ เทคโนโลยีสารสนเทศและแหล่งเรียนรู้',
 '3.3':'บริหารจัดการชั้นเรียนเชิงบวก',
 '3.4':'ตรวจสอบและประเมินผู้เรียนอย่างเป็นระบบ',
 '3.5':'แลกเปลี่ยนเรียนรู้และให้ข้อมูลสะท้อนกลับ'
};
export default function TeacherSarAssessment(){
 const [school,setSchool]=useState(''),[uid,setUid]=useState(''),[years,setYears]=useState<Year[]>([]),[year,setYear]=useState('');
 const [items,setItems]=useState<Item[]>([]),[targets,setTargets]=useState<Target[]>([]),[indicatorTargets,setIndicatorTargets]=useState<IndicatorTarget[]>([]),
 [answers,setAnswers]=useState<Record<string,Response>>({}),[submitted,setSubmitted]=useState<Submitted|null>(null);
 const [loading,setLoading]=useState(true),[reading,setReading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const selectedTarget=targets.find(t=>t.academic_year_id===year);
 const sections=[...new Set(items.map(i=>i.section_code))];
 const yearTargets=indicatorTargets.filter(t=>t.academic_year_id===year);
 const published=selectedTarget?.status==='published'&&yearTargets.length===27&&sections.length===11&&sections.every(code=>yearTargets.some(t=>t.section_code===code));
 const targetFor=(code:string)=>yearTargets.find(t=>t.section_code===code)?.target_percent;
 const yearLabel=years.find(y=>y.id===year)?.year_be;
 useEffect(()=>{let live=true;(async()=>{try{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อ Supabase');
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)throw Error('กรุณาเข้าสู่ระบบด้วยบัญชีครู');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','teacher').eq('active',true).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('เฉพาะบัญชีครูที่เปิดใช้งานเท่านั้นจึงประเมิน SAR ได้');
  const schoolId=m.data.school_id as string;
  const [y,i,t,perItem]=await Promise.all([
   db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('year_be',{ascending:false}),
   db.from('sar_assessment_items').select('code,standard_no,section_code,title,item_order').order('standard_no').order('item_order'),
   db.from('sar_year_settings').select('academic_year_id,status').eq('school_id',schoolId),
   db.from('sar_indicator_targets').select('academic_year_id,section_code,target_percent').eq('school_id',schoolId)
  ]);
  if(y.error||i.error||t.error||perItem.error)throw Error(y.error?.message||i.error?.message||t.error?.message||perItem.error?.message);
  if(!live)return;
  const yearsList=(y.data??[]) as Year[];
  setSchool(schoolId);setUid(user.id);setYears(yearsList);
  setItems(i.data as Item[]);setTargets(t.data as Target[]);setIndicatorTargets(perItem.data as IndicatorTarget[]);
  setYear(yearsList.find(x=>x.is_active)?.id??yearsList[0]?.id??'');
 }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}
 finally{if(live)setLoading(false);}})();return()=>{live=false;};},[]);
 const reload=useCallback(async(id:string,schoolId:string,teacherId:string)=>{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อ');
  const [r,s,t,perItem]=await Promise.all([
   db.from('sar_teacher_assessments').select('item_code,rating,note').eq('school_id',schoolId).eq('academic_year_id',id).eq('teacher_user_id',teacherId),
   db.from('sar_teacher_submissions').select('submitted_at').eq('school_id',schoolId).eq('academic_year_id',id).eq('teacher_user_id',teacherId).maybeSingle(),
   db.from('sar_year_settings').select('academic_year_id,status').eq('school_id',schoolId),
   db.from('sar_indicator_targets').select('academic_year_id,section_code,target_percent').eq('school_id',schoolId)
  ]);
  if(r.error||s.error||t.error||perItem.error)throw Error(r.error?.message||s.error?.message||t.error?.message||perItem.error?.message);
  setAnswers(Object.fromEntries(((r.data??[]) as Response[]).map(a=>[a.item_code,{item_code:a.item_code,rating:a.rating,note:a.note??''}])));
  setSubmitted((s.data??null) as Submitted|null);
  setTargets(t.data as Target[]);setIndicatorTargets(perItem.data as IndicatorTarget[]);
 },[]);
 useEffect(()=>{if(!school||!uid||!year)return;let live=true;setReading(true);setNotice('');setError('');
  void reload(year,school,uid).catch(e=>{if(live)setError((e as Error).message);}).finally(()=>{if(live)setReading(false);});
  return()=>{live=false;};
 },[year,school,uid,reload]);
 const completed=useMemo(()=>items.filter(i=>answers[i.code]?.rating!=null).length,[items,answers]);
 const standardCount=(standard:number)=>items.filter(i=>i.standard_no===standard&&answers[i.code]?.rating!=null).length;
 const locked=!!submitted;
 const ready=items.length===15&&completed===15;
 function update(code:string,field:'rating'|'note',value:number|null|string){
  if(locked||busy)return;
  setAnswers(old=>({...old,[code]:{item_code:code,rating:old[code]?.rating??null,note:old[code]?.note??'',
   [field]:value}}));setNotice('');
 }
 async function save(send:boolean){
  if(!school||!year||!published||locked||busy||reading)return;
  if(send&&!ready){setError('กรุณาประเมินให้ครบทั้ง 15 ข้อก่อนส่งแบบประเมิน');return;}
  if(send&&!window.confirm('ยืนยันส่งแบบประเมินมาตรฐานที่ 2 และ 3 ปีการศึกษา '+yearLabel+'? หลังส่งต้องให้ Admin เปิดให้แก้ไขหากต้องการเปลี่ยนคำตอบ'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อ');
   const data=items.map(i=>({code:i.code,rating:answers[i.code]?.rating??null,note:answers[i.code]?.note??''}));
   const {error:rpcError}=await db.rpc('sar_save_teacher_assessment',{p_year:year,p_answers:data,p_submit:send});
   if(rpcError)throw Error(rpcError.message);
   await reload(year,school,uid);
   setNotice(send?'ส่งแบบประเมินครบทั้งสองมาตรฐานแล้ว':'บันทึกแบบประเมินฉบับร่างแล้ว สามารถกลับมากรอกต่อได้');
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 return <main className="wichakan-page mx-auto max-w-5xl px-4 pb-14">
  <PageHeader title="ประเมิน SAR มาตรฐานที่ 2 และ 3" context="ครูทุกคนประเมินรายบุคคลตามรายการในเครื่องมือประเมินปีการศึกษา 2568"/>
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
   <label className="text-sm font-medium text-slate-700">ปีการศึกษา
    <select value={year} disabled={busy||loading||reading} onChange={e=>setYear(e.target.value)} className="mt-2 block min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2">
     {years.map(y=><option key={y.id} value={y.id}>{y.year_be}{y.is_active?' — ปัจจุบัน':''}</option>)}
    </select>
   </label>
   <div className="text-right"><strong className="block text-xl text-slate-900">{completed} / {items.length||15}</strong>
    <span className="text-xs text-slate-500">รายการที่ประเมินครบ</span></div>
  </div>
  {error&&<p role="alert" className="teacher-error mb-4">{error}</p>}
  {notice&&<p role="status" className="teacher-success mb-4">{notice}</p>}
  {(loading||reading)&&<p className="mb-5 text-sm text-slate-600" role="status">กำลังโหลดแบบประเมิน...</p>}
  {!loading&&!reading&&!!school&&!!year&&<>
   {!published?<p className="mb-5 border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">Admin ยังไม่ได้ประกาศค่าเป้าหมาย SAR ครบทั้ง 3 มาตรฐาน (27 รายการ) ประจำปีการศึกษา {yearLabel} จึงยังไม่เปิดให้บันทึกแบบประเมิน</p>:
    <div className="mb-5 border-y border-slate-200 py-3 text-sm">
     <span className="font-medium">ค่าเป้าหมายที่ประกาศ:</span>
     <p className="mt-1 text-slate-600">แสดงเป็นร้อยละรายประเด็น 2.1–2.6 และ 3.1–3.5 ไม่ใช่เกณฑ์ระดับ 1–5 เพียงค่ารวมต่อมาตรฐาน</p>
     <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">{sections.map(code=><span key={code} className="tabular-nums">{code}: <strong>{targetFor(code)}%</strong></span>)}</div>
    </div>}
   {locked&&<p className="mb-5 border-l-4 border-green-600 bg-green-50 p-4 text-sm text-green-900">ส่งแบบประเมินแล้วเมื่อ {new Date(submitted!.submitted_at).toLocaleString('th-TH')} — หากต้องการแก้ไขให้ติดต่อ Admin เพื่อเปิดแบบประเมินอีกครั้ง</p>}
   {[2,3].map(no=><section key={no} className="mb-8" aria-labelledby={'sar-standard-'+no}>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
     <div><h2 id={'sar-standard-'+no} className="text-lg font-bold text-slate-900">มาตรฐานที่ {no}</h2>
      <p className="text-sm text-slate-600">{no===2?'กระบวนการบริหารและการจัดการ':'กระบวนการจัดการเรียนการสอนที่เน้นผู้เรียนเป็นสำคัญ'}</p></div>
     <span className="text-sm font-medium text-blue-800">{standardCount(no)} / {no===2?6:9} ข้อ</span>
    </div>
    <div className="divide-y divide-slate-100">{items.filter(i=>i.standard_no===no).map(item=>{
     const answer=answers[item.code];const disabled=!published||locked||busy||reading;
     return <div key={item.code} className="grid gap-3 py-4 sm:grid-cols-[1fr_210px]">
      <div className="min-w-0">
       <div className="flex items-start gap-3"><span className="shrink-0 text-sm font-semibold text-blue-900">{item.code}</span>
        <div className="text-sm leading-relaxed text-slate-800">{item.standard_no===3&&sectionLabels[item.section_code]&&
         <span className="mb-1 block text-xs font-semibold text-slate-500">{item.section_code} {sectionLabels[item.section_code]} · ค่าเป้าหมาย {targetFor(item.section_code)??'—'}%</span>}{item.title}{item.standard_no===2&&<span className="mt-1 block text-xs font-medium text-blue-700">ค่าเป้าหมาย {targetFor(item.section_code)??'—'}%</span>}</div>
       </div>
       <label className="mt-2 block text-xs text-slate-600">หมายเหตุ / หลักฐานประกอบ (ถ้ามี)
        <input type="text" value={answer?.note??''} maxLength={2000} disabled={disabled}
         onChange={e=>update(item.code,'note',e.target.value)} placeholder="อธิบายผลการดำเนินงานหรือชื่อหลักฐาน"
         className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"/>
       </label>
      </div>
      <label className="text-sm font-medium text-slate-800">ระดับผลประเมิน
       <select value={answer?.rating?.toString()??''} disabled={disabled}
        onChange={e=>update(item.code,'rating',e.target.value?Number(e.target.value):null)}
        className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3">
        <option value="">— ยังไม่ประเมิน —</option>
        {Object.entries(levelLabel).map(([rating,label])=><option key={rating} value={rating}>{rating} — {label}</option>)}
       </select>
      </label>
     </div>;
    })}</div>
   </section>)}
   <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
    <button className="ui-secondary" disabled={!published||locked||busy||reading} onClick={()=>void save(false)}>บันทึกแบบร่าง</button>
    <button className="ui-primary" disabled={!published||locked||busy||reading||!ready} onClick={()=>void save(true)}>{busy?'กำลังบันทึก...':'ส่งแบบประเมินครบ 15 ข้อ'}</button>
    <span className="text-xs text-slate-500">{ready?'ตอบครบทุกข้อแล้ว': 'สามารถบันทึกแบบร่างได้แม้ตอบไม่ครบ'}</span>
   </div>
   <p className="mt-5 text-xs text-slate-500">ระบบเก็บคะแนนดิบ 1–5 ตามแบบประเมินต้นฉบับ ยังไม่แปลงเป็นร้อยละหรือสรุประดับคุณภาพของทั้งโรงเรียนโดยพลการ</p>
  </>}
  <p className="mt-6"><Link href="/teacher" className="text-sm text-blue-700 underline">← กลับหน้าหลักครู</Link></p>
 </main>;
}
