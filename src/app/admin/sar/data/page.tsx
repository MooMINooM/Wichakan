'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type Year={id:string;year_be:number;is_active:boolean};
type Topic={code:string;title:string;standard_no:number;sort_order:number};
type Context={id:string;category:string;title:string;narrative:string;source_note:string};
type Test={id:string;test_kind:string;grade_level:string;component:string;participants:number|null;school_average:number|null;area_average:number|null;national_average:number|null;source_note:string};
type Measure={code:string;numerator:number|null;denominator:number|null;manually_observed_percent:number|null;source_note:string};
const categories:{key:string;label:string}[]=[
 {key:'school_profile',label:'ข้อมูลทั่วไปของสถานศึกษา'},{key:'vision',label:'วิสัยทัศน์'}, {key:'mission',label:'พันธกิจ'},
 {key:'personnel',label:'ข้อมูลบุคลากร'},{key:'finance',label:'งบประมาณ'}, {key:'facilities',label:'อาคารและสภาพแวดล้อม'},
 {key:'resources',label:'แหล่งเรียนรู้'},{key:'community',label:'บริบทชุมชน'}, {key:'safety',label:'ความปลอดภัย'},
 {key:'learner_support',label:'การช่วยเหลือผู้เรียน'}, {key:'projects',label:'โครงการและกิจกรรม'},
 {key:'strengths',label:'จุดเด่น'}, {key:'improvement',label:'จุดควรพัฒนา'}, {key:'plans',label:'แผนพัฒนา'},
 {key:'support',label:'ความต้องการสนับสนุน'}
];
function n(v:string):number|null{return v.trim()===''?null:Number(v)}
function eMessage(e:unknown){return e instanceof Error?e.message:'ไม่สามารถบันทึกข้อมูลได้'}
export default function SarDataPage(){
 const db=getSupabaseBrowserClient();
 const [school,setSchool]=useState(''),[years,setYears]=useState<Year[]>([]),[year,setYear]=useState(''),[topics,setTopics]=useState<Topic[]>([]);
 const [tab,setTab]=useState<'context'|'tests'|'indicators'>('context');
 const [contexts,setContexts]=useState<Context[]>([]),[tests,setTests]=useState<Test[]>([]),[measures,setMeasures]=useState<Measure[]>([]);
 const [category,setCategory]=useState('school_profile'),[ctxTitle,setCtxTitle]=useState(''),[narrative,setNarrative]=useState(''),[ctxSource,setCtxSource]=useState('');
 const [testKind,setTestKind]=useState('O-NET'),[grade,setGrade]=useState('ป.6'),[component,setComponent]=useState(''),[participants,setParticipants]=useState(''),
 [schoolAvg,setSchoolAvg]=useState(''),[areaAvg,setAreaAvg]=useState(''),[nationAvg,setNationAvg]=useState(''),[testSource,setTestSource]=useState('');
 const [measureCode,setMeasureCode]=useState('1.1.1'),[numerator,setNumerator]=useState(''),[denominator,setDenominator]=useState(''),[observed,setObserved]=useState(''),[measureSource,setMeasureSource]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ยังไม่ได้ตั้งค่าฐานข้อมูล');
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบ Admin');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('active',true).eq('role','school_admin').limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('ไม่มีสิทธิ์จัดการข้อมูล SAR');
  const sid=m.data.school_id as string;
  const [y,t]=await Promise.all([db.from('academic_years').select('id,year_be,is_active').eq('school_id',sid).order('year_be',{ascending:false}),
   db.from('sar_target_topics').select('code,title,standard_no,sort_order').order('sort_order')]);
  if(y.error||t.error)throw Error(y.error?.message||t.error?.message);
  if(!live)return;const list=y.data as Year[];setSchool(sid);setYears(list);setTopics(t.data as Topic[]);setYear(list.find(x=>x.is_active)?.id??list[0]?.id??'');
 }catch(e){if(live)setError(eMessage(e));}finally{if(live)setLoading(false)}})();return()=>{live=false};},[db]);
 async function reload(sid=school,yid=year){
  if(!db||!sid||!yid)return;
  const [c,t,m]=await Promise.all([
   db.from('sar_context').select('id,category,title,narrative,source_note').eq('school_id',sid).eq('academic_year_id',yid).order('category').order('title'),
   db.from('sar_national_tests').select('id,test_kind,grade_level,component,participants,school_average,area_average,national_average,source_note').eq('school_id',sid).eq('academic_year_id',yid).order('test_kind'),
   db.from('sar_indicator_measurements').select('code,numerator,denominator,manually_observed_percent,source_note').eq('school_id',sid).eq('academic_year_id',yid)
  ]);
  if(c.error||t.error||m.error)throw Error(c.error?.message||t.error?.message||m.error?.message);
  setContexts(c.data as Context[]);setTests(t.data as Test[]);setMeasures(m.data as Measure[]);
 }
 useEffect(()=>{if(!school||!year)return;let live=true;setLoading(true);setError('');void reload(school,year).catch(e=>{if(live)setError(eMessage(e))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false};},[school,year]);
 async function commit(action:()=>Promise<{error:{message:string}|null}>,message:string){
  if(busy||!db)return;setBusy(true);setError('');setSuccess('');
  try{const r=await action();if(r.error)throw Error(r.error.message);await reload();setSuccess(message);}
  catch(e){setError(eMessage(e));}finally{setBusy(false)}
 }
 const yearLabel=years.find(y=>y.id===year)?.year_be??'';
 const box='w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-12">
  <PageHeader title="ข้อมูลประกอบ SAR" context="บันทึกข้อมูลสถานศึกษา ผลทดสอบระดับชาติ และผลตัวชี้วัดรายปี"/>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
   <label className="text-sm font-medium">ปีการศึกษา <select className={box+' ml-2 inline-block w-auto'} value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <Link href="/admin/sar" className="text-sm text-blue-700 underline">← กลับหน้าหลัก SAR</Link>
  </div>
  {error&&<p role="alert" className="teacher-error mb-3">{error}</p>}
  {success&&<p role="status" className="teacher-success mb-3">{success}</p>}
  {loading&&<p role="status" className="text-sm">กำลังโหลดข้อมูล...</p>}
  <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
   {([['context','ข้อมูลสถานศึกษา / แผนงาน'],['tests','RT / NT / O-NET'],['indicators','ผลตัวชี้วัด']] as const).map(([k,l])=>
    <button key={k} type="button" className={'rounded-md px-4 py-2 text-sm '+(tab===k?'bg-blue-900 text-white':'bg-slate-100 text-slate-700')} onClick={()=>setTab(k)}>{l}</button>)}
  </div>
  {school&&year&&tab==='context'&&<section>
   <h2 className="mb-2 text-lg font-semibold">ทะเบียนข้อมูลพื้นฐานและโครงการ ปี {yearLabel}</h2>
   <p className="mb-4 text-sm text-slate-600">เก็บข้อมูลแยกตามปีการศึกษา พร้อมแหล่งอ้างอิง ห้ามนำข้อมูลที่ยังไม่ตรวจสอบไปใช้เป็นข้อเท็จจริงในรายงาน</p>
   <form className="mb-6 grid gap-3 border-b border-slate-200 pb-5" onSubmit={e=>{e.preventDefault();void commit(async()=>{const r=await db!.from('sar_context').upsert({school_id:school,academic_year_id:year,category,title:ctxTitle.trim(),narrative,source_note:ctxSource},{onConflict:'school_id,academic_year_id,category,title'});return r;},'บันทึกข้อมูลประกอบ SAR แล้ว');}}>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">ประเภท<select className={box+' mt-1'} value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option value={c.key} key={c.key}>{c.label}</option>)}</select></label>
     <label className="text-sm">ชื่อรายการ / โครงการ<input className={box+' mt-1'} value={ctxTitle} maxLength={200} onChange={e=>setCtxTitle(e.target.value)} placeholder="เช่น แผนปฏิบัติการประจำปี"/></label></div>
    <label className="text-sm">รายละเอียด<textarea className={box+' mt-1'} rows={4} value={narrative} onChange={e=>setNarrative(e.target.value)} required/></label>
    <label className="text-sm">แหล่งข้อมูล / วันที่อ้างอิง<input className={box+' mt-1'} value={ctxSource} onChange={e=>setCtxSource(e.target.value)} placeholder="เช่น ทะเบียน/คำสั่ง/เอกสารรับรอง"/></label>
    <button className="ui-primary w-fit" disabled={busy||!ctxTitle.trim()||!narrative.trim()} type="submit">บันทึกข้อมูล</button>
   </form>
   <div className="divide-y divide-slate-200">{contexts.map(c=><article key={c.id} className="py-3 text-sm">
    <div className="flex items-center justify-between gap-3"><strong>{categories.find(x=>x.key===c.category)?.label??c.category} — {c.title}</strong>
     <button className="text-blue-700 underline" onClick={()=>{setCategory(c.category);setCtxTitle(c.title);setNarrative(c.narrative);setCtxSource(c.source_note);window.scrollTo({top:0,behavior:'smooth'});}}>แก้ไข</button></div>
    <p className="mt-1 whitespace-pre-wrap text-slate-600">{c.narrative}</p>
    {c.source_note&&<p className="text-xs text-slate-500">ที่มา: {c.source_note}</p>}
   </article>)}</div>
  </section>}
  {school&&year&&tab==='tests'&&<section>
   <h2 className="mb-2 text-lg font-semibold">ผลการทดสอบระดับชาติ ปี {yearLabel}</h2>
   <p className="mb-4 text-sm text-slate-600">บันทึกเฉพาะข้อมูลที่มีหลักฐานจริง แยกด้าน/วิชาและระดับการเปรียบเทียบ ค่าไม่ทราบให้ว่าง ไม่ใช้ 0 แทน</p>
   <form className="grid gap-3 border-b border-slate-200 pb-5" onSubmit={e=>{e.preventDefault();void commit(async()=>db!.from('sar_national_tests').upsert({
    school_id:school,academic_year_id:year,test_kind:testKind,grade_level:grade,component:component.trim(),
    participants:n(participants),school_average:n(schoolAvg),area_average:n(areaAvg),national_average:n(nationAvg),source_note:testSource
   },{onConflict:'school_id,academic_year_id,test_kind,grade_level,component'}),'บันทึกผลทดสอบแล้ว');}}>
    <div className="grid gap-3 sm:grid-cols-3">
     <label className="text-sm">แบบทดสอบ<select className={box+' mt-1'} value={testKind} onChange={e=>setTestKind(e.target.value)}>{['RT','NT','O-NET','Pre-ONET','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
     <label className="text-sm">ชั้น<input className={box+' mt-1'} value={grade} onChange={e=>setGrade(e.target.value)}/></label>
     <label className="text-sm">วิชา / ด้าน<input className={box+' mt-1'} value={component} onChange={e=>setComponent(e.target.value)} required/></label>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
     {([['ผู้เข้าสอบ',participants,setParticipants],['เฉลี่ยโรงเรียน (%)',schoolAvg,setSchoolAvg],['เฉลี่ยเขต (%)',areaAvg,setAreaAvg],['เฉลี่ยประเทศ (%)',nationAvg,setNationAvg]] as const).map(([label,value,set])=><label key={label} className="text-sm">{label}<input type="number" min={0} max={label==='ผู้เข้าสอบ'?undefined:100} step={label==='ผู้เข้าสอบ'?'1':'0.01'} className={box+' mt-1'} value={value} onChange={e=>set(e.target.value)}/></label>)}
    </div>
    <label className="text-sm">แหล่งผลสอบ<input className={box+' mt-1'} value={testSource} onChange={e=>setTestSource(e.target.value)} required/></label>
    <button className="ui-primary w-fit" type="submit" disabled={busy||!component.trim()||!testSource.trim()}>บันทึกผลสอบ</button>
   </form>
   <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr>{['แบบทดสอบ','ชั้น / ด้าน','ผู้เข้าสอบ','โรงเรียน','เขต','ประเทศ','แก้ไข'].map(t=><th className="border-b p-2 text-left" key={t}>{t}</th>)}</tr></thead><tbody>{tests.map(t=><tr key={t.id} className="border-b"><td className="p-2">{t.test_kind}</td><td className="p-2">{t.grade_level} · {t.component}</td><td className="p-2">{t.participants??'—'}</td><td className="p-2">{t.school_average??'—'}</td><td className="p-2">{t.area_average??'—'}</td><td className="p-2">{t.national_average??'—'}</td><td className="p-2"><button className="text-blue-700 underline" onClick={()=>{setTestKind(t.test_kind);setGrade(t.grade_level);setComponent(t.component);setParticipants(String(t.participants??''));setSchoolAvg(String(t.school_average??''));setAreaAvg(String(t.area_average??''));setNationAvg(String(t.national_average??''));setTestSource(t.source_note)}}>แก้ไข</button></td></tr>)}</tbody></table></div>
  </section>}
  {school&&year&&tab==='indicators'&&<section>
   <h2 className="mb-2 text-lg font-semibold">ผลการดำเนินงานรายตัวชี้วัด ปี {yearLabel}</h2>
   <p className="mb-4 text-sm text-slate-600">กรอกจำนวนที่ผ่าน/จำนวนทั้งหมดเพื่อคำนวณร้อยละ หรือระบุผลที่รับรองแล้วพร้อมแหล่งที่มา ห้ามนำผลที่ยังไม่มีหลักฐานมาคิดเป็น 0</p>
   <form className="grid gap-3 border-b border-slate-200 pb-5" onSubmit={e=>{e.preventDefault();void commit(async()=>db!.from('sar_indicator_measurements').upsert({
    school_id:school,academic_year_id:year,code:measureCode,numerator:n(numerator),denominator:n(denominator),
    manually_observed_percent:n(observed),source_note:measureSource
   },{onConflict:'school_id,academic_year_id,code'}),'บันทึกผลตัวชี้วัดแล้ว');}}>
    <label className="text-sm">ประเด็น SAR<select className={box+' mt-1'} value={measureCode} onChange={e=>{setMeasureCode(e.target.value);const m=measures.find(a=>a.code===e.target.value);setNumerator(String(m?.numerator??''));setDenominator(String(m?.denominator??''));setObserved(String(m?.manually_observed_percent??''));setMeasureSource(m?.source_note??'');}}>{topics.map(t=><option key={t.code} value={t.code}>{t.code} {t.title}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">จำนวนที่ผ่าน<input className={box+' mt-1'} min={0} type="number" value={numerator} onChange={e=>setNumerator(e.target.value)}/></label><label className="text-sm">จำนวนทั้งหมด<input className={box+' mt-1'} min={0} type="number" value={denominator} onChange={e=>setDenominator(e.target.value)}/></label><label className="text-sm">ร้อยละที่รับรอง (หากไม่มีตัวตั้ง/ตัวหาร)<input className={box+' mt-1'} min={0} max={100} step="0.01" type="number" value={observed} onChange={e=>setObserved(e.target.value)}/></label></div>
    <label className="text-sm">ที่มาของผลประเมิน<input className={box+' mt-1'} value={measureSource} onChange={e=>setMeasureSource(e.target.value)} required/></label>
    {n(denominator)!==null&&n(denominator)!>0&&n(numerator)!==null&&<p className="text-sm">ร้อยละที่คำนวณได้: <strong>{((n(numerator)!/n(denominator)!)*100).toFixed(2)}%</strong></p>}
    <button className="ui-primary w-fit" type="submit" disabled={busy||!measureSource.trim()||(n(denominator)!==null&&n(numerator)!==null&&n(numerator)!>n(denominator)!)}>บันทึกผลประเมิน</button>
   </form>
   <div className="divide-y divide-slate-100">{topics.map(t=>{const m=measures.find(x=>x.code===t.code);
    const result=m?.denominator&&m.numerator!==null?100*m.numerator/m.denominator:m?.manually_observed_percent;
    return <div key={t.code} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0 flex-1"><strong>{t.code}</strong> {t.title}</div><span className="tabular-nums">{result==null?'ไม่มีผล':result.toFixed(2)+'%'}</span><button className="text-blue-700 underline" onClick={()=>{setMeasureCode(t.code);setNumerator(String(m?.numerator??''));setDenominator(String(m?.denominator??''));setObserved(String(m?.manually_observed_percent??''));setMeasureSource(m?.source_note??'');window.scrollTo({top:0,behavior:'smooth'})}}>แก้ไข</button></div>})}</div>
  </section>}
 </main>;
}
