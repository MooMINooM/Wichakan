'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Topic={code:string;title:string;standard_no:number;sort_order:number};
type Review={code:string;narrative:string;strength:string;improvement:string;action_plan:string;review_status:string;reviewed_at:string|null};
type Measure={code:string;numerator:number|null;denominator:number|null;manually_observed_percent:number|null};
type Target={section_code:string;target_percent:number};
type ReviewForm=Omit<Review,'reviewed_at'>;
const empty=(code:string):ReviewForm=>({code,narrative:'',strength:'',improvement:'',action_plan:'',review_status:'draft'});
function percent(m:Measure|undefined):number|null{
 if(!m)return null;
 if(m.denominator!==null&&m.denominator>0&&m.numerator!==null)return Math.round((10000*m.numerator/m.denominator))/100;
 return m.manually_observed_percent;
}
export default function SarReviewPage(){
 const db=getSupabaseBrowserClient();const [school,setSchool]=useState(''),[year,setYear]=useState(''),[years,setYears]=useState<Year[]>([]);
 const [topics,setTopics]=useState<Topic[]>([]),[targets,setTargets]=useState<Target[]>([]),[reviews,setReviews]=useState<Review[]>([]),[measurements,setMeasurements]=useState<Measure[]>([]);
 const [selected,setSelected]=useState('1'),[form,setForm]=useState<ReviewForm>(empty('1'));
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const fields=[['narrative','ผลการดำเนินงาน / กระบวนการพัฒนา'],['strength','จุดเด่น'],['improvement','จุดควรพัฒนา'],['action_plan','แนวทางพัฒนาปีถัดไป']] as const;
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ไม่พบฐานข้อมูล');const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบ');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('เฉพาะ Admin จึงรับรอง SAR ได้');
  const sid=m.data.school_id as string;
  const [y,t]=await Promise.all([db.from('academic_years').select('id,year_be,is_active').eq('school_id',sid).order('year_be',{ascending:false}),
   db.from('sar_target_topics').select('code,title,standard_no,sort_order').order('sort_order')]);
  if(y.error||t.error)throw Error(y.error?.message||t.error?.message);
  if(!live)return;const list=y.data as Year[];setSchool(sid);setYears(list);setTopics(t.data as Topic[]);setYear(list.find(x=>x.is_active)?.id??list[0]?.id??'');
 }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่ได้');}finally{if(live)setLoading(false)}})();return()=>{live=false};},[db]);
 async function reload(yid=year,sid=school){
  if(!db||!sid||!yid)return;
  const [r,t,m]=await Promise.all([
   db.from('sar_quality_reviews').select('code,narrative,strength,improvement,action_plan,review_status,reviewed_at').eq('school_id',sid).eq('academic_year_id',yid),
   db.from('sar_indicator_targets').select('section_code,target_percent').eq('school_id',sid).eq('academic_year_id',yid),
   db.from('sar_indicator_measurements').select('code,numerator,denominator,manually_observed_percent').eq('school_id',sid).eq('academic_year_id',yid)
  ]);
  if(r.error||t.error||m.error)throw Error(r.error?.message||t.error?.message||m.error?.message);
  setReviews(r.data as Review[]);setTargets(t.data as Target[]);setMeasurements(m.data as Measure[]);
 }
 useEffect(()=>{if(!year||!school)return;let live=true;setError('');void reload(year,school).catch(e=>{if(live)setError((e as Error).message)});return()=>{live=false};},[year,school]);
 useEffect(()=>{setForm(reviews.find(x=>x.code===selected)??empty(selected));},[reviews,selected]);
 const total=topics.filter(x=>x.code!=='overall').length,reviewed=reviews.filter(x=>x.code!=='overall'&&x.review_status==='reviewed').length;
 const chosen=topics.find(x=>x.code===selected),target=targets.find(x=>x.section_code===selected)?.target_percent??null;
 const outcome=percent(measurements.find(x=>x.code===selected));
 const style='w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
 async function save(status:'draft'|'reviewed'){
  if(!db||!school||!year||busy)return;
  if(status==='reviewed'&&!form.narrative.trim()){setError('กรุณาระบุผลการดำเนินงานก่อนตรวจรับรอง');return;}
  if(status==='reviewed'&&!window.confirm('ยืนยันตรวจรับรองประเด็น '+selected+' โดยอ้างอิงหลักฐานและผลประเมินที่ตรวจสอบแล้ว?'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const {data:{user}}=await db.auth.getUser();if(!user)throw Error('หมดอายุการเข้าสู่ระบบ');
   const r=await db.from('sar_quality_reviews').upsert({school_id:school,academic_year_id:year,...form,review_status:status,
    reviewed_by:status==='reviewed'?user.id:null,reviewed_at:status==='reviewed'?new Date().toISOString():null,updated_at:new Date().toISOString()},
    {onConflict:'school_id,academic_year_id,code'});
   if(r.error)throw Error(r.error.message);
   await reload();setNotice(status==='reviewed'?'รับรองประเด็น '+selected+' เรียบร้อยแล้ว':'บันทึกฉบับร่างแล้ว');
  }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{setBusy(false)}
 }
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-12">
  <PageHeader title="ตรวจสอบและรับรองมาตรฐาน SAR" context="บันทึกผลการพัฒนา จุดเด่น จุดควรพัฒนา และรับรองผลรายมาตรฐาน"/>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
   <label className="text-sm font-medium">ปีการศึกษา <select className={style+' ml-2 inline-block w-auto'} value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <Link href="/admin/sar" className="text-sm text-blue-700 underline">← กลับหน้า SAR</Link>
  </div>
  {error&&<p role="alert" className="teacher-error mb-3">{error}</p>}
  {notice&&<p role="status" className="teacher-success mb-3">{notice}</p>}
  <div className="mb-5 border-y border-slate-200 py-3">
   <div className="flex items-center justify-between gap-3"><strong>ความคืบหน้าการรับรองประเด็น</strong><strong>{reviewed}/{total||26}</strong></div>
   <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700" style={{width:(total?reviewed/total*100:0)+'%'}}/></div>
  </div>
  <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
   <nav className="max-h-[70vh] overflow-y-auto border-y border-slate-200" aria-label="ประเด็น SAR">
    {[1,2,3].map(no=><div key={no}>
     <p className="sticky top-0 bg-slate-100 px-3 py-2 text-sm font-bold">มาตรฐานที่ {no}</p>
     {topics.filter(t=>t.standard_no===no).map(t=><button type="button" key={t.code}
      className={'flex w-full items-start justify-between gap-2 border-b border-slate-100 p-3 text-left text-xs '+(selected===t.code?'bg-blue-50 text-blue-900':'hover:bg-slate-50')}
      onClick={()=>setSelected(t.code)}><span><b>{t.code}</b> {t.title}</span>
      <span className="shrink-0 text-slate-500">{reviews.find(x=>x.code===t.code)?.review_status==='reviewed'?'✓':'—'}</span></button>)}
    </div>)}
    {topics.filter(t=>t.code==='overall').map(t=><button key={t.code} className={'w-full p-3 text-left text-sm '+(selected===t.code?'bg-blue-50':'')} onClick={()=>setSelected(t.code)}>ภาพรวมสถานศึกษา</button>)}
   </nav>
   <section>
    <h2 className="mb-2 text-lg font-semibold">{chosen?.code} {chosen?.title}</h2>
    <div className="mb-4 flex flex-wrap gap-5 border-y border-slate-200 py-3 text-sm">
     <div>ค่าเป้าหมาย <strong>{target==null?'ยังไม่กำหนด':target+'%'}</strong></div>
     <div>ผลที่มีหลักฐาน <strong>{outcome==null?'ยังไม่มีผล':outcome.toFixed(2)+'%'}</strong></div>
     <div>สถานะ <strong>{form.review_status==='reviewed'?'ตรวจรับรองแล้ว':'ฉบับร่าง'}</strong></div>
    </div>
    {outcome==null&&<p className="mb-4 text-sm text-amber-800">ยังไม่มีผลประเมินร้อยละของประเด็นนี้ ให้บันทึกข้อมูลในหน้า “ข้อมูลประกอบ SAR” ก่อน หากต้องใช้ผลเชิงคุณภาพ ให้ระบุวิธีประเมินและหลักฐานในคำอธิบาย</p>}
    <div className="grid gap-4">{fields.map(([key,label])=><label key={key} className="text-sm font-medium">{label}
     <textarea rows={key==='narrative'?6:3} className={style+' mt-1'} value={form[key]} maxLength={10000}
      onChange={e=>setForm(old=>({...old,[key]:e.target.value,review_status:'draft'}))} placeholder={'กรอก'+label+' พร้อมอ้างอิงหลักฐานจริง'}/></label>)}</div>
    <div className="mt-5 flex flex-wrap gap-3">
     <button className="ui-secondary" disabled={busy} onClick={()=>void save('draft')}>บันทึกฉบับร่าง</button>
     <button className="ui-primary" disabled={busy||!form.narrative.trim()} onClick={()=>void save('reviewed')}>ตรวจรับรองประเด็นนี้</button>
    </div>
    <p className="mt-4 text-xs text-slate-500">การรับรองหมายถึง Admin ตรวจสอบคำอธิบายและหลักฐานแล้ว ระบบไม่อนุมานว่าผ่านเป้าหมายจากคะแนนที่ยังไม่ครบ</p>
   </section>
  </div>
  <div className="mt-8 border-t border-slate-200 pt-5"><Link href="/admin/sar/report" className="text-sm font-semibold text-blue-700 underline">ดูร่างรายงานและสร้างรายงานฉบับรับรอง</Link></div>
  {loading&&<p role="status">กำลังโหลด...</p>}
 </main>;
}
