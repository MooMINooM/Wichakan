'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type Year={id:string;year_be:number;is_active:boolean};
type Setting={status:'draft'|'published';notes:string;published_at:string|null};
type IndicatorTarget={section_code:string;target_percent:number};
type Item={code:string;standard_no:number;section_code:string;title:string;item_order:number};
type TargetTopic={code:string;standard_no:number;parent_code:string|null;sort_order:number;title:string};
type Teacher={user_id:string};
type Profile={user_id:string;display_name:string|null};
type Answer={teacher_user_id:string;item_code:string;rating:number|null};
type Submission={teacher_user_id:string;submitted_at:string};
type Progress={id:string;name:string;standard2:number;standard3:number;submitted_at:string|null};
type StudentTotal={level:string;male:number;female:number;unknown:number;total:number};
type TeacherLoad={teacher_id:string;term_no:number;course_periods:number;activity_periods:number;total_periods:number};
type SarSnapshot={students:StudentTotal[];teaching_load:TeacherLoad[];activities_without_teacher:number;period_unit:string};
const quality=(n:number):string=>n>=80?'ยอดเยี่ยม':n>=70?'ดีเลิศ':n>=60?'ดี':n>=50?'ปานกลาง':'กำลังพัฒนา';
const total2=6,total3=9;
export default function SarAdminPage(){
 const [school,setSchool]=useState(''),[years,setYears]=useState<Year[]>([]),[yearId,setYearId]=useState('');
 const [items,setItems]=useState<Item[]>([]),[topics,setTopics]=useState<TargetTopic[]>([]),[teachers,setTeachers]=useState<Teacher[]>([]),[profiles,setProfiles]=useState<Profile[]>([]);
 const [setting,setSetting]=useState<Setting|null>(null),[scores,setScores]=useState<Answer[]>([]),[submissions,setSubmissions]=useState<Submission[]>([]);
 const [snapshot,setSnapshot]=useState<SarSnapshot|null>(null);
 const [targetDraft,setTargetDraft]=useState<Record<string,string>>({}),[notes,setNotes]=useState('');
 const [successTargetCount,setSuccessTargetCount]=useState(0);
 const [periodMinutes,setPeriodMinutes]=useState(''),[savedPeriodMinutes,setSavedPeriodMinutes]=useState('');
 const [initialLoading,setInitialLoading]=useState(true),[yearLoading,setYearLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase');
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)throw Error('กรุณาเข้าสู่ระบบ Admin');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('หน้านี้ใช้ได้เฉพาะ Admin ของโรงเรียน');
  const schoolId=m.data.school_id as string;
  const [y,i,t,topicList]=await Promise.all([
   db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('year_be',{ascending:false}),
   db.from('sar_assessment_items').select('code,standard_no,section_code,title,item_order').order('standard_no').order('item_order'),
   db.from('school_memberships').select('user_id').eq('school_id',schoolId).eq('role','teacher').eq('active',true),
   db.from('sar_target_topics').select('code,standard_no,parent_code,sort_order,title').order('sort_order')
  ]);
  if(y.error||i.error||t.error||topicList.error)throw Error(y.error?.message||i.error?.message||t.error?.message||topicList.error?.message);
  const staffIds=[...new Set((t.data??[]).map(x=>x.user_id))];
  const ps:Profile[]=[];
  for(let from=0;from<staffIds.length;from+=100){
   const p=await db.from('profiles').select('user_id,display_name').in('user_id',staffIds.slice(from,from+100));
   if(p.error)throw p.error;
   ps.push(...(p.data??[]));
  }
  if(!active)return;
  const list=y.data as Year[];setSchool(schoolId);setYears(list);setItems(i.data as Item[]);
  setTeachers(staffIds.map(user_id=>({user_id})));setProfiles(ps);setTopics(topicList.data as TargetTopic[]);
  setYearId(list.find(x=>x.is_active)?.id??list[0]?.id??'');
 }catch(e){if(active)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}
 finally{if(active)setInitialLoading(false);}})();return()=>{active=false};},[]);
 const loadYear=useCallback(async(selected:string,schoolId:string)=>{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อ Supabase');
  const [s,a,u,aggregated,targets,successList,period]=await Promise.all([
   db.from('sar_year_settings').select('status,notes,published_at')
    .eq('school_id',schoolId).eq('academic_year_id',selected).maybeSingle(),
   db.from('sar_teacher_assessments').select('teacher_user_id,item_code,rating').eq('school_id',schoolId).eq('academic_year_id',selected),
   db.from('sar_teacher_submissions').select('teacher_user_id,submitted_at').eq('school_id',schoolId).eq('academic_year_id',selected),
   db.rpc('sar_admin_auto_snapshot',{p_year:selected}),
   db.from('sar_indicator_targets').select('section_code,target_percent').eq('school_id',schoolId).eq('academic_year_id',selected),
   db.from('sar_success_targets').select('indicator_code').eq('school_id',schoolId).eq('academic_year_id',selected),
   db.from('sar_period_durations').select('minutes_per_period').eq('school_id',schoolId).eq('academic_year_id',selected).maybeSingle()
  ]);
  if(s.error||a.error||u.error||aggregated.error||targets.error||successList.error||period.error)throw Error(s.error?.message||a.error?.message||u.error?.message||aggregated.error?.message||targets.error?.message||successList.error?.message||period.error?.message);
  const value=(s.data??null) as Setting|null;
  setSetting(value);setScores(a.data as Answer[]);setSubmissions(u.data as Submission[]);
  setSnapshot(aggregated.data as SarSnapshot);
  setTargetDraft(Object.fromEntries(((targets.data??[]) as IndicatorTarget[]).map(t=>[t.section_code,String(t.target_percent)])));
  setNotes(value?.notes??'');setSuccessTargetCount((successList.data??[]).length);
  setPeriodMinutes(period.data?.minutes_per_period?.toString()??'');setSavedPeriodMinutes(period.data?.minutes_per_period?.toString()??'');
 },[]);
 useEffect(()=>{if(!school||!yearId)return;let active=true;setYearLoading(true);setError('');setNotice('');
  void loadYear(yearId,school).catch(e=>{if(active)setError((e as Error).message);})
   .finally(()=>{if(active)setYearLoading(false)});
  return()=>{active=false};
 },[school,yearId,loadYear]);
 const progress=useMemo<Progress[]>(()=>teachers.map(t=>{
  const set=new Set(scores.filter(a=>a.teacher_user_id===t.user_id&&a.rating!==null).map(a=>a.item_code));
  return {id:t.user_id,name:profiles.find(p=>p.user_id===t.user_id)?.display_name||'บัญชี '+t.user_id.slice(0,8),
   standard2:items.filter(i=>i.standard_no===2&&set.has(i.code)).length,
   standard3:items.filter(i=>i.standard_no===3&&set.has(i.code)).length,
   submitted_at:submissions.find(s=>s.teacher_user_id===t.user_id)?.submitted_at??null};
 }).sort((a,b)=>a.name.localeCompare(b.name,'th')),[teachers,profiles,items,scores,submissions]);
 const submittedCount=progress.filter(x=>x.submitted_at).length;
 const sections=useMemo(()=>topics.map(t=>t.code),[topics]);
 const filledCount=sections.filter(code=>targetDraft[code]?.trim()!=='').length;
 const allValid=sections.length===27&&sections.every(code=>{const raw=targetDraft[code];return raw!==undefined&&raw.trim()!==''&&Number.isFinite(Number(raw))&&Number(raw)>=0&&Number(raw)<=100&&/^\d{1,3}(?:\.\d{1,2})?$/.test(raw.trim());});
 const studentSummary=snapshot?.students.reduce((sum,v)=>({male:sum.male+v.male,female:sum.female+v.female,unknown:sum.unknown+v.unknown,total:sum.total+v.total}),{male:0,female:0,unknown:0,total:0});
 const termNumbers=[...new Set(snapshot?.teaching_load.map(row=>row.term_no)??[])].sort((a,b)=>a-b);
 const nameOf=(id:string)=>profiles.find(p=>p.user_id===id)?.display_name||'บัญชี '+id.slice(0,8);
 const locked=setting?.status==='published';
 async function saveTargets(publish:boolean){
  if(!school||!yearId||busy||locked)return;
  const targets:{section_code:string;target_percent:number}[]=[];
  for(const code of sections){
   const raw=targetDraft[code]?.trim()??'';
   if(raw==='')continue;
   if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw)||Number(raw)>100){
    setError('ค่าเป้าหมายข้อ '+code+' ต้องเป็นร้อยละ 0–100 ไม่เกินสองตำแหน่งทศนิยม');return;
   }
   targets.push({section_code:code,target_percent:Number(raw)});
  }
  if(publish&&(!allValid||successTargetCount!==57)){setError('ต้องมีเป้าหมายหลักครบ 27 และตัวชี้วัดย่อยครบ 57 รายการก่อนประกาศ');return;}
  if(publish&&!window.confirm('ยืนยันประกาศค่าเป้าหมายทั้ง 3 มาตรฐาน (27 รายการ) ของปีการศึกษา '+yearLabel+'? หลังประกาศแล้วไม่สามารถแก้ไขเกณฑ์ของปีนี้ได้'))return;
  setBusy(true);setNotice('');setError('');
  try{
   const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบการเชื่อมต่อ Supabase');
   const {error:e}=await db.rpc('sar_save_indicator_targets',{
    p_year:yearId,p_targets:targets,p_notes:notes,p_publish:publish
   });
   if(e)throw Error(e.message);
   await loadYear(yearId,school);
   setNotice(publish?'ประกาศค่าเป้าหมายครบทั้ง 3 มาตรฐานแล้ว ครูทุกคนเริ่มประเมินได้':'บันทึกค่าเป้าหมายรายข้อทั้ง 3 มาตรฐานเป็นฉบับร่างแล้ว');
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 async function savePeriodDuration(){
  if(!yearId||!school||busy)return;
  const value=Number(periodMinutes);
  if(!Number.isInteger(value)||value<20||value>120){setError('กรุณากำหนดความยาวคาบระหว่าง 20–120 นาที');return;}
  const db=getSupabaseBrowserClient();if(!db)return;
  setBusy(true);setNotice('');setError('');
  try{const {error:e}=await db.from('sar_period_durations').upsert({school_id:school,academic_year_id:yearId,minutes_per_period:value},{onConflict:'school_id,academic_year_id'});
   if(e)throw Error(e.message);
   setSavedPeriodMinutes(String(value));setNotice('บันทึกความยาวคาบแล้ว สรุปภาระสอนแสดงชั่วโมงต่อสัปดาห์ได้');
  }catch(e){setError(e instanceof Error?e.message:'บันทึกระยะเวลาคาบไม่สำเร็จ');}finally{setBusy(false)}
 }
 async function reopen(t:Progress){
  if(!yearId||!school||busy||!t.submitted_at)return;
  if(!window.confirm('อนุญาตให้ '+t.name+' กลับไปแก้ไขผลประเมิน SAR ปีนี้หรือไม่?'))return;
  const db=getSupabaseBrowserClient();if(!db)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {error:e}=await db.rpc('sar_reopen_teacher_assessment',{p_year:yearId,p_teacher:t.id});
   if(e)throw Error(e.message);
   await loadYear(yearId,school);setNotice('เปิดให้แก้ไขแบบประเมินของ '+t.name+' เรียบร้อยแล้ว');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const yearLabel=years.find(x=>x.id===yearId)?.year_be;
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-12">
  <PageHeader title="SAR ขั้นพื้นฐาน" context="จัดการมาตรฐาน ค่าเป้าหมายรายปี และติดตามผลประเมินจากครูทุกคน"/>
  <nav aria-label="เมนูดำเนินงาน SAR" className="mb-6 grid gap-3 border-y border-slate-200 py-4 sm:grid-cols-2 lg:grid-cols-4">
   {([
    ['/admin/sar/success-targets','เป้าหมายตัวชี้วัดรายข้อ','57 รายการจากภาคผนวก SAR'],
    ['/admin/sar/data','ข้อมูลพื้นฐาน / RT NT O-NET','จัดเก็บสถิติ โครงการ และตัวชี้วัด'],
    ['/admin/sar/management','บุคลากรและคลังหลักฐาน','รับรองผลงาน อบรมและนวัตกรรม'],
    ['/admin/sar/review','ตรวจรับรองมาตรฐาน','วิเคราะห์จุดเด่น จุดควรพัฒนา'],
    ['/admin/sar/report','รายงาน SAR','ตรวจฉบับร่างและส่งออก Word / PDF']
   ] as const).map(([href,title,desc])=><Link key={href} href={href} className="rounded-lg border border-slate-200 p-4 transition hover:bg-sky-50"><strong className="block text-sm text-blue-900">{title}</strong><span className="mt-1 block text-xs text-slate-500">{desc}</span></Link>)}
  </nav>
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
   <label className="text-sm font-medium text-slate-700">ปีการศึกษา
    <select value={yearId} disabled={initialLoading||busy} onChange={e=>setYearId(e.target.value)} className="mt-1 block min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2">
     {years.map(y=><option key={y.id} value={y.id}>{y.year_be}{y.is_active?' — ปัจจุบัน':''}</option>)}
    </select>
   </label>
   <span className="text-xs text-slate-500">ต้นแบบรายการประเมินจากเครื่องมือปีการศึกษา 2568</span>
  </div>
  {error&&<p className="teacher-error mb-4" role="alert">{error}</p>}
  {notice&&<p className="teacher-success mb-4" role="status">{notice}</p>}
  {(initialLoading||yearLoading)&&<p role="status" className="mb-4 text-sm text-slate-600">กำลังโหลดข้อมูล SAR...</p>}
  {!initialLoading&&!school&&<p className="text-sm text-slate-500">ไม่มีสิทธิ์จัดการ SAR</p>}
  {!!school&&!!yearId&&!yearLoading&&<>
   <section className="mb-8" aria-labelledby="sar-targets-heading">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
     <h2 id="sar-targets-heading" className="text-lg font-semibold text-slate-900">1. ตารางค่าเป้าหมาย SAR ปีการศึกษา {yearLabel}</h2>
     <span className={'rounded-full px-3 py-1 text-xs font-medium '+(locked?'bg-green-50 text-green-800':'bg-slate-100 text-slate-700')}>{locked?'ประกาศแล้ว':'ฉบับร่าง / ยังไม่ประกาศ'}</span>
    </div>
    <p className="mb-3 text-sm text-slate-600">กำหนดค่าเป้าหมายเป็นร้อยละ <strong>รายมาตรฐานและรายประเด็นย่อย</strong> ตามตารางประกาศของโรงเรียน รวมมาตรฐานที่ 1, 2 และ 3 พร้อมค่าเป้าหมายภาพรวม รายการที่ยังไม่กำหนดจะไม่ถูกคิดเป็นศูนย์</p>
    <p className="mb-4 text-sm">ค่าเป้าหมายตัวชี้วัดความสำเร็จรายข้อ: <strong>{successTargetCount}/57</strong> รายการ · <Link href="/admin/sar/success-targets" className="text-blue-700 underline">เปิดตารางตัวชี้วัดย่อย</Link></p>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
     <span>กำหนดแล้ว <strong className="text-slate-900">{filledCount} / {sections.length||27}</strong> รายการ · ร้อยละ 80 ขึ้นไป = ยอดเยี่ยม, 70–79.99 = ดีเลิศ, 60–69.99 = ดี, 50–59.99 = ปานกลาง, ต่ำกว่า 50 = กำลังพัฒนา</span>
     {years.some(y=>y.year_be===2568)&&yearLabel!==2568&&<button type="button" className="ui-secondary" onClick={()=>{const y=years.find(x=>x.year_be===2568);if(y)setYearId(y.id);}}>ตรวจตัวอย่างปี 2568</button>}
    </div>
    {[1,2,3].map(no=><div key={no} className="mb-6">
     <h3 className="mb-2 text-base font-semibold text-slate-900">มาตรฐานที่ {no} — {no===1?'คุณภาพของผู้เรียน':no===2?'กระบวนการบริหารและการจัดการ':'กระบวนการจัดการเรียนการสอนที่เน้นผู้เรียนเป็นสำคัญ'}</h3>
     <div className="overflow-x-auto border-y border-slate-200">
      <table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
       <thead><tr className="bg-slate-50 text-slate-700"><th className="w-20 border-b border-slate-200 p-3 text-left">ข้อ</th><th className="border-b border-slate-200 p-3 text-left">มาตรฐาน / ประเด็นพิจารณา</th><th className="w-36 border-b border-slate-200 p-3 text-right">เป้าหมาย (%)</th><th className="w-32 border-b border-slate-200 p-3 text-left">ระดับคุณภาพ</th></tr></thead>
       <tbody>{topics.filter(t=>t.standard_no===no).map(t=>{
        const value=targetDraft[t.code]??'';
        const valid=value.trim()!==''&&/^\\d{1,3}(?:\\.\\d{1,2})?$/.test(value.trim())&&Number(value)<=100;
        const topLevel=t.parent_code===null;
        const depth=t.code.split('.').length-1;
        return <tr key={t.code} className={topLevel?'bg-sky-50/70':'hover:bg-slate-50'}>
         <td className={'border-b border-slate-100 px-3 py-2 align-middle tabular-nums '+(topLevel?'font-bold':'font-medium')}>{t.code}</td>
         <td className={'border-b border-slate-100 py-2 pr-3 align-middle '+(topLevel?'font-semibold text-slate-900':'text-slate-800')} style={{paddingLeft:12+depth*14}}>{t.title}</td>
         <td className="border-b border-slate-100 px-3 py-2 text-right align-middle">
          <input aria-label={'ค่าเป้าหมายข้อ '+t.code} type="number" inputMode="decimal" min={0} max={100} step="0.01"
           value={value} disabled={locked||busy} placeholder="—"
           onChange={e=>{setTargetDraft(old=>({...old,[t.code]:e.target.value}));setNotice('');}}
           className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-right tabular-nums disabled:bg-transparent disabled:border-transparent"/>
         </td>
         <td className="border-b border-slate-100 px-3 py-2 text-xs">{valid?quality(Number(value)):<span className="text-slate-400">ยังไม่กำหนด</span>}</td>
        </tr>;
       })}</tbody>
      </table>
     </div>
    </div>)}
    {topics.filter(t=>t.standard_no===0).map(t=><div key={t.code} className="mb-4 grid grid-cols-[1fr_120px_112px] items-center gap-3 border-y border-slate-200 bg-slate-50 px-3 py-3 text-sm">
     <label htmlFor="sar-overall" className="font-semibold">{t.title}</label>
     <input id="sar-overall" type="number" inputMode="decimal" min={0} max={100} step="0.01"
      className="w-full rounded-md border border-slate-300 bg-white p-2 text-right tabular-nums disabled:bg-transparent disabled:border-transparent"
      value={targetDraft[t.code]??''} disabled={locked||busy} placeholder="—"
      onChange={e=>{setTargetDraft(old=>({...old,[t.code]:e.target.value}));setNotice('');}}/>
     <span className="text-right text-xs text-slate-600">{targetDraft[t.code]!==undefined&&targetDraft[t.code]!==''?quality(Number(targetDraft[t.code])):'ยังไม่กำหนด'}</span>
    </div>)}
    <label className="mt-3 block text-sm font-medium text-slate-800">คำอธิบาย / เอกสารอ้างอิง
     <textarea rows={3} maxLength={2000} disabled={locked||busy} value={notes}
      onChange={e=>setNotes(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3" placeholder="ระบุเอกสารประกาศ ค่าเป้าหมายที่กำหนดหรือที่มาของข้อมูล"/>
    </label>
    {yearLabel===2568&&<p className="mt-3 text-sm text-blue-800">ค่าเป้าหมายปี 2568 นำเข้าจากตารางประกาศค่าเป้าหมายใน SAR ขั้นพื้นฐาน หน้า 150–152 เพื่อใช้ตรวจสอบย้อนหลัง โดยยังเป็นฉบับร่างในระบบ Wichakan</p>}
    {locked?<p className="mt-4 text-sm text-green-800">ประกาศเมื่อ {setting?.published_at?new Date(setting.published_at).toLocaleString('th-TH'):'—'} และล็อกค่าเป้าหมายของปีนี้แล้ว</p>:
     <div className="mt-4 flex flex-wrap gap-3">
      <button className="ui-secondary" type="button" disabled={busy} onClick={()=>void saveTargets(false)}>บันทึกฉบับร่าง</button>
      <button className="ui-primary" type="button" disabled={busy||!allValid||successTargetCount!==57} onClick={()=>void saveTargets(true)}>{busy?'กำลังดำเนินการ...':'ประกาศค่าเป้าหมายทั้ง 3 มาตรฐาน'}</button>
     </div>}
   </section>
   <section className="mb-8" aria-labelledby="sar-progress-heading">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
     <div><h2 id="sar-progress-heading" className="text-lg font-semibold text-slate-900">2. ความคืบหน้าการประเมินของครู</h2>
      <p className="mt-1 text-sm text-slate-500">ครูทุกคนประเมินมาตรฐานที่ 2 ทั้ง 6 ข้อ และมาตรฐานที่ 3 ทั้ง 9 ข้อ</p></div>
     <button type="button" className="ui-secondary" disabled={busy} onClick={()=>void loadYear(yearId,school).catch(e=>setError((e as Error).message))}>อัปเดตข้อมูล</button>
    </div>
    <div className="mb-4 grid grid-cols-2 gap-4 border-y border-slate-200 py-4 sm:grid-cols-3">
     <div><strong className="block text-2xl">{teachers.length}</strong><span className="text-xs text-slate-500">บัญชีครูที่มีสิทธิ์ประเมิน</span></div>
     <div><strong className="block text-2xl">{submittedCount}</strong><span className="text-xs text-slate-500">ส่งแบบประเมินครบแล้ว</span></div>
     <div><strong className="block text-2xl">{teachers.length-submittedCount}</strong><span className="text-xs text-slate-500">ยังไม่ส่งแบบประเมิน</span></div>
    </div>
    {!locked&&<p className="mb-3 text-sm text-amber-800">ยังไม่ประกาศค่าเป้าหมาย ครูจึงยังไม่สามารถบันทึกแบบประเมินปีนี้ได้</p>}
    <div className="overflow-x-auto border-y border-slate-200"><table className="w-full min-w-[660px] text-sm">
     <thead><tr className="bg-slate-50 text-left"><th className="p-3">ชื่อครู</th><th className="p-3 text-center">มาตรฐาน 2</th><th className="p-3 text-center">มาตรฐาน 3</th><th className="p-3 text-center">สถานะ</th><th className="p-3 text-right">จัดการ</th></tr></thead>
     <tbody>{progress.map(t=><tr className="border-t border-slate-100" key={t.id}>
      <td className="p-3 font-medium">{t.name}</td>
      <td className="p-3 text-center">{t.standard2}/{total2}</td>
      <td className="p-3 text-center">{t.standard3}/{total3}</td>
      <td className="p-3 text-center">{t.submitted_at?'ส่งแล้ว':t.standard2+t.standard3?'กำลังประเมิน':'ยังไม่เริ่ม'}</td>
      <td className="p-3 text-right">{t.submitted_at?<button className="text-sm font-medium text-blue-700 underline disabled:opacity-50" disabled={busy} onClick={()=>void reopen(t)}>เปิดให้แก้ไข</button>:<span className="text-slate-400">—</span>}</td>
     </tr>)}</tbody>
    </table>{!teachers.length&&<p className="p-4 text-sm text-slate-500">ยังไม่พบบัญชีครูที่เปิดใช้งาน</p>}</div>
   </section>
   <section className="mb-8" aria-labelledby="sar-automatic-heading">
    <h2 id="sar-automatic-heading" className="mb-2 text-lg font-semibold text-slate-900">3. ข้อมูลพื้นฐานจาก Wichakan อัตโนมัติ</h2>
    <p className="mb-4 text-sm text-slate-600">แสดงข้อมูลปัจจุบันจากทะเบียนปีการศึกษาที่เลือก ยังไม่ใช่ตัวเลขที่รับรองหรือล็อกเป็นรายงาน SAR ฉบับสุดท้าย</p>
    <h3 className="mb-2 font-semibold">จำนวนนักเรียนชาย–หญิง ตามคำนำหน้าชื่อ</h3>
    <p className="mb-3 text-sm text-slate-600">ชาย: เด็กชาย / นาย · หญิง: เด็กหญิง / นางสาว · คำนำหน้าอื่นหรือว่าง: รอตรวจสอบ</p>
    <div className="mb-4 grid grid-cols-2 gap-3 border-y border-slate-200 py-4 sm:grid-cols-4">
     <div><strong className="block text-xl">{studentSummary?.male??'—'}</strong><span className="text-xs text-slate-500">ชาย</span></div>
     <div><strong className="block text-xl">{studentSummary?.female??'—'}</strong><span className="text-xs text-slate-500">หญิง</span></div>
     <div><strong className="block text-xl">{studentSummary?.unknown??'—'}</strong><span className="text-xs text-slate-500">รอตรวจสอบ</span></div>
     <div><strong className="block text-xl">{studentSummary?.total??'—'}</strong><span className="text-xs text-slate-500">รวมตามทะเบียนปีนี้</span></div>
    </div>
    <div className="mb-6 overflow-x-auto border-y border-slate-200">
     <table className="w-full min-w-[480px] text-sm"><thead><tr className="bg-slate-50"><th className="p-3 text-left">ชั้นเรียน</th><th className="p-3 text-center">ชาย</th><th className="p-3 text-center">หญิง</th><th className="p-3 text-center">รอตรวจสอบ</th><th className="p-3 text-center">รวม</th></tr></thead>
      <tbody>{snapshot?.students.map(row=><tr key={row.level} className="border-t border-slate-100"><td className="p-3 font-medium">{row.level}</td><td className="p-3 text-center">{row.male}</td><td className="p-3 text-center">{row.female}</td><td className="p-3 text-center">{row.unknown}</td><td className="p-3 text-center">{row.total}</td></tr>)}</tbody>
     </table>
     {!snapshot?.students.length&&<p className="p-4 text-sm text-slate-500">ยังไม่มีข้อมูลการลงทะเบียนนักเรียนในปีนี้</p>}
    </div>
    <h3 className="mb-2 font-semibold">ภาระสอนจากตารางสอนจริง</h3>
    <p className="mb-3 text-sm text-slate-600">แยกรายภาคเรียน นับคาบต่อสัปดาห์แบบไม่ซ้ำวัน–คาบของครูคนเดียวกัน และแยกคาบรายวิชาออกจากกิจกรรม ระบบจะแปลงเป็นชั่วโมงเมื่อ Admin ระบุความยาวคาบจริงเท่านั้น</p>
    <div className="mb-4 flex flex-wrap items-end gap-3"><label className="text-sm">ความยาว 1 คาบ (นาที)<input className="ml-2 w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-right" type="number" min={20} max={120} step={1} value={periodMinutes} onChange={e=>setPeriodMinutes(e.target.value)} placeholder="—"/></label><button className="ui-secondary" type="button" disabled={busy||!periodMinutes||periodMinutes===savedPeriodMinutes} onClick={()=>void savePeriodDuration()}>บันทึกความยาวคาบ</button></div>
    <div className="overflow-x-auto border-y border-slate-200">
     <table className="w-full min-w-[620px] text-sm"><thead><tr className="bg-slate-50"><th className="p-3 text-left">ภาคเรียน</th><th className="p-3 text-left">ครู</th><th className="p-3 text-center">รายวิชา</th><th className="p-3 text-center">กิจกรรม</th><th className="p-3 text-center">รวมคาบ/สัปดาห์</th><th className="p-3 text-center">ชั่วโมง/สัปดาห์</th></tr></thead>
      <tbody>{termNumbers.flatMap(term=>teachers.map(t=>{
       const info=snapshot?.teaching_load.find(row=>row.teacher_id===t.user_id&&row.term_no===term);
       return <tr className="border-t border-slate-100" key={term+':'+t.user_id}>
        <td className="p-3">{term}</td><td className="p-3 font-medium">{nameOf(t.user_id)}</td>
        <td className="p-3 text-center">{info?.course_periods??0}</td>
        <td className="p-3 text-center">{info?.activity_periods??0}</td>
        <td className="p-3 text-center font-semibold">{info?.total_periods??0}</td>
        <td className="p-3 text-center tabular-nums">{savedPeriodMinutes?(((info?.total_periods??0)*Number(savedPeriodMinutes))/60).toFixed(2):'—'}</td>
       </tr>;
      }))}</tbody>
     </table>
     {!termNumbers.length&&<p className="p-4 text-sm text-slate-500">ยังไม่มีคาบเรียนที่จัดไว้ในปีการศึกษานี้</p>}
    </div>
    {!!snapshot?.activities_without_teacher&&<p className="mt-3 text-sm text-amber-800">มีกิจกรรม {snapshot.activities_without_teacher} รายการที่ยังหาครูผู้รับผิดชอบไม่พบ จึงยังไม่รวมในภาระสอน กรุณาตรวจสอบตารางกิจกรรม</p>}
   </section>
   <section aria-labelledby="sar-items-heading">
    <h2 id="sar-items-heading" className="mb-2 text-lg font-semibold text-slate-900">4. รายการประเมินตามเอกสารต้นแบบ</h2>
    <p className="mb-4 text-sm text-slate-600">ข้อมูลต้นแบบยังไม่ระบุสูตรรวมคะแนนเป็นร้อยละ ระบบจึงเก็บคะแนนดิบรายข้อและความครบถ้วนไว้ก่อน ไม่ตีความเป็นระดับคุณภาพของสถานศึกษาอัตโนมัติ</p>
    {[2,3].map(no=><div key={no} className="mb-4">
     <h3 className="mb-2 font-semibold">มาตรฐานที่ {no} — {no===2?'กระบวนการบริหารและการจัดการ':'กระบวนการจัดการเรียนการสอนที่เน้นผู้เรียนเป็นสำคัญ'}</h3>
     <div className="divide-y divide-slate-100 border-y border-slate-200">
      {items.filter(x=>x.standard_no===no).map(item=><div className="flex items-start gap-3 py-2 text-sm" key={item.code}>
       <span className="w-14 shrink-0 font-semibold text-blue-800">{item.code}</span><span>{item.title}</span>
      </div>)}
     </div>
    </div>)}
   </section>
   <p className="mt-6 text-sm text-slate-500">ข้อมูลพื้นฐาน ภาระงานสอน และผลการประเมินเป็นข้อมูลปัจจุบันที่ต้องตรวจสอบหลักฐานก่อนนำเข้ารายงานฉบับรับรอง ส่วนการอัปโหลด Google Drive ต้องให้โรงเรียนเชื่อมบัญชี Google ของตนเอง</p>
   <p className="mt-2 text-sm"><Link className="text-blue-700 underline" href="/teacher/sar">ดูหน้าประเมิน SAR สำหรับครู</Link></p>
  </>}
 </main>;
}
