'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {createSarDocx} from '@/lib/sar-docx';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Topic={code:string;title:string;standard_no:number;sort_order:number};
type Target={section_code:string;target_percent:number};
type Review={code:string;narrative:string;strength:string;improvement:string;action_plan:string;review_status:string};
type Measure={code:string;numerator:number|null;denominator:number|null;manually_observed_percent:number|null;source_note:string};
type Context={category:string;title:string;narrative:string;source_note:string};
type National={test_kind:string;grade_level:string;component:string;participants:number|null;school_average:number|null;area_average:number|null;national_average:number|null};
type Evidence={kind:string;title:string;activity_year_be:number;target_codes:string[];verification_status:string};
type TeacherAverage={item_code:string;n:number;mean_rating:number};
type DetailTarget={indicator_code:string;target_percent:number};
type StaffInfo={user_id?:string;display_name?:string|null;employment_type:string;position_title:string;qualification:string;major:string;academic_rank:string};
type DetailItem={code:string;parent_code:string;description:string};
type Version={id:string;version_no:number;snapshot:Report;approved_at:string};
type GradeSummary={rows:{level:string;term:number;subject_code:string;expected:number;recorded:number;grade3plus:number;pct_of_recorded:number|null}[]};
type Gender={students:{level:string;male:number;female:number;unknown:number;total:number}[];teaching_load:{teacher_id:string;term_no:number;total_periods:number}[]};
type Report={year:number;school:string;targets:Target[];success_targets?:DetailTarget[];staff_profiles?:StaffInfo[];reviews:Review[];measurements:Measure[];context:Context[];national_tests:National[];evidence:Evidence[];teacher_summary:TeacherAverage[];academic_summary?:GradeSummary;roster?:Gender};
const safe=(v:unknown)=>String(v??'—').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const pct=(m:Measure|undefined)=>!m?null:m.denominator&&m.denominator>0&&m.numerator!==null?
  Math.round(10000*m.numerator/m.denominator)/100:m.manually_observed_percent;
function makeHtml(report:Report,topics:Topic[],details:DetailItem[],version:number|null){
 const tar=new Map(report.targets.map(t=>[t.section_code,t.target_percent]));
 const rev=new Map(report.reviews.map(x=>[x.code,x]));
 const success=new Map((report.success_targets??[]).map(x=>[x.indicator_code,x.target_percent]));
 const met=new Map(report.measurements.map(x=>[x.code,x]));
 const esc=safe;
 const table=(headers:string[],rows:string[][])=>'<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 const fmt=(code:string)=>{const m=pct(met.get(code));return m==null?'ไม่มีข้อมูล':m.toFixed(2)+'%';};
 const parts=['<!doctype html><html lang="th"><head><meta charset="utf-8"/><title>SAR '+esc(report.year)+'</title><style>',
  '@page{size:A4;margin:20mm 16mm}body{font-family:TH Sarabun New,Sarabun,Arial,sans-serif;color:#111827;font-size:15pt;line-height:1.4}h1{text-align:center;font-size:22pt}h2{font-size:18pt;border-bottom:1px solid #9ca3af;padding-bottom:4px;break-after:avoid}h3{font-size:16pt}p{margin:7px 0}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #94a3b8;padding:5px;text-align:left;font-size:12pt}th{background:#eef2f7}tr{break-inside:avoid}.small{font-size:11pt;color:#475569}.section{break-before:page}div{white-space:pre-wrap}</style></head><body>',
  '<h1>รายงานการประเมินตนเองของสถานศึกษา (SAR)</h1>',
  '<h2 style="text-align:center">'+esc(report.school)+'</h2>',
  '<p style="text-align:center">ระดับการศึกษาขั้นพื้นฐาน ปีการศึกษา '+esc(report.year)+'</p>',
  '<p style="text-align:center">'+(version?'ฉบับรับรอง รุ่นที่ '+version:'ฉบับร่างสำหรับตรวจสอบ (ยังไม่รับรอง)')+'</p>',
  '<h2>ส่วนที่ 1 ข้อมูลพื้นฐานของสถานศึกษา</h2>'];
 for(const c of report.context){
  parts.push('<h3>'+esc(c.title||c.category)+'</h3><div>'+esc(c.narrative)+'</div>');
  if(c.source_note)parts.push('<p class="small">แหล่งข้อมูล: '+esc(c.source_note)+'</p>');
 }
 if(report.staff_profiles?.length)parts.push('<h3>ข้อมูลวุฒิการศึกษาและวิชาชีพบุคลากร</h3>',table(['บุคลากร','ตำแหน่ง','วุฒิ','สาขา','วิทยฐานะ'],report.staff_profiles.map(s=>[s.display_name??s.user_id??'—',s.position_title,s.qualification,s.major,s.academic_rank])));
 if(report.roster?.students?.length)parts.push('<h3>สรุปจำนวนนักเรียนรายระดับชั้น (จากทะเบียน)</h3>',
  table(['ชั้น','ชาย','หญิง','รอตรวจสอบ','รวม'],report.roster.students.map(s=>[s.level,String(s.male),String(s.female),String(s.unknown),String(s.total)])));
 if(report.roster?.teaching_load?.length)parts.push('<h3>ภาระสอนรายครูจากตารางสอน (จำนวนคาบต่อสัปดาห์)</h3>',
  table(['ครู (รหัสบัญชี)','ภาคเรียน','คาบ/สัปดาห์'],report.roster.teaching_load.map(s=>[s.teacher_id,s.term_no.toString(),s.total_periods.toString()])));
 if(report.national_tests.length)parts.push('<h3>ผลการทดสอบระดับชาติ</h3>',
  table(['แบบทดสอบ','ชั้น','วิชา/ด้าน','จำนวน','โรงเรียน','เขต','ประเทศ'],report.national_tests.map(n=>[n.test_kind,n.grade_level,n.component,String(n.participants??'—'),String(n.school_average??'—'),String(n.area_average??'—'),String(n.national_average??'—')])));
 if(report.academic_summary?.rows?.length)parts.push('<h3>ผลสัมฤทธิ์ระดับ 3 ขึ้นไป (เฉพาะข้อมูลที่มีเกรดสมบูรณ์)</h3>',
  table(['ชั้น','ภาค','รหัสรายวิชา','มีผลเกรด','คาดว่าต้องมี','เกรด 3+','% ของเกรดที่มี'],report.academic_summary.rows.map(a=>[a.level,String(a.term),a.subject_code,String(a.recorded),String(a.expected),String(a.grade3plus),a.pct_of_recorded===null?'—':a.pct_of_recorded+'%'])));
 parts.push('<h2 class="section">ส่วนที่ 2 ผลการประเมินคุณภาพตามมาตรฐาน</h2>');
 for(const standard of [1,2,3]){
  const group=topics.filter(x=>x.standard_no===standard);
  parts.push('<h3>มาตรฐานที่ '+standard+' '+esc(group.find(t=>t.code===String(standard))?.title??'')+'</h3>');
  parts.push(table(['ข้อ','ประเด็นพิจารณา','ค่าเป้าหมาย','ผลประเมิน','สถานะ'],group.map(t=>[t.code,t.title,tar.has(t.code)?tar.get(t.code)+'%':'—',fmt(t.code),rev.get(t.code)?.review_status==='reviewed'?'ตรวจแล้ว':'ยังไม่ตรวจ'])));
  for(const t of group){
   const related=details.filter(d=>d.parent_code===t.code);
   if(related.length)parts.push('<p class="small">ตัวชี้วัดความสำเร็จรายข้อ</p>',table(['รายการ','รายละเอียด','เป้าหมาย'],related.map(x=>[x.code,x.description,success.has(x.code)?success.get(x.code)+'%':'—'])));
   const q=rev.get(t.code);if(!q||!q.narrative.trim())continue;
   parts.push('<h3>'+esc(t.code+' '+t.title)+'</h3><p>'+esc(q.narrative)+'</p>');
   if(q.strength)parts.push('<p><strong>จุดเด่น:</strong> '+esc(q.strength)+'</p>');
   if(q.improvement)parts.push('<p><strong>จุดควรพัฒนา:</strong> '+esc(q.improvement)+'</p>');
  }
 }
 if(report.teacher_summary?.length)parts.push('<h3>ผลประเมินของครูมาตรฐานที่ 2–3 (คะแนนดิบ 1–5)</h3>',
  '<p class="small">ค่าเฉลี่ยแสดงเพื่อประกอบการพิจารณา ไม่ใช่ร้อยละผลสำเร็จของสถานศึกษาหรือระดับคุณภาพที่ระบบรับรองอัตโนมัติ</p>',
  table(['ข้อ','ผู้ส่งประเมิน','เฉลี่ยดิบ (1–5)'],report.teacher_summary.map(x=>[x.item_code,String(x.n),String(x.mean_rating)])));
 parts.push('<h2 class="section">ส่วนที่ 3 สรุปจุดเด่นและแนวทางพัฒนา</h2>');
 for(const t of topics.filter(t=>t.code!=='overall')){
  const q=rev.get(t.code);if(!q||(!q.action_plan&&!q.improvement))continue;
  parts.push('<h3>'+esc(t.code+' '+t.title)+'</h3>');
  if(q.improvement)parts.push('<p>จุดที่ควรพัฒนา: '+esc(q.improvement)+'</p>');
  if(q.action_plan)parts.push('<p>แนวทางพัฒนา: '+esc(q.action_plan)+'</p>');
 }
 parts.push('<h2 class="section">ส่วนที่ 4 ภาคผนวกหลักฐานที่รับรอง</h2>');
 if(report.evidence?.length)parts.push(table(['ปี','ประเภท','ชื่อหลักฐาน','เชื่อมประเด็น'],report.evidence.map(x=>[String(x.activity_year_be),x.kind,x.title,x.target_codes.join(', ')])));
 else parts.push('<p>ยังไม่มีหลักฐานที่ผ่านการรับรอง</p>');
 parts.push('<p class="small">จัดทำด้วย Wichakan โดยข้อมูลที่ไม่มีหลักฐานแสดงว่าไม่มีข้อมูล ไม่ใช้ค่า 0 โดยอัตโนมัติ</p></body></html>');
 return parts.join('');
}
function downloadDocx(report:Report,topics:Topic[],details:DetailItem[],version:number|null){
 const data=createSarDocx(report,topics,details,version);
 const blob=new Blob([new Uint8Array(data)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='SAR_'+report.year+(version?'_v'+version:'_draft')+'.docx';
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
export default function SarReportPage(){
 const db=getSupabaseBrowserClient();
 const [school,setSchool]=useState(''),[years,setYears]=useState<Year[]>([]),[year,setYear]=useState(''),[topics,setTopics]=useState<Topic[]>([]),[details,setDetails]=useState<DetailItem[]>([]);
 const [draft,setDraft]=useState<Report|null>(null),[versions,setVersions]=useState<Version[]>([]),[selected,setSelected]=useState('draft');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ไม่พบฐานข้อมูล');
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบ');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('เฉพาะ Admin จึงจัดทำรายงานได้');
  const sid=m.data.school_id as string;
  const [y,t,z]=await Promise.all([db.from('academic_years').select('id,year_be,is_active').eq('school_id',sid).order('year_be',{ascending:false}),
   db.from('sar_target_topics').select('code,title,standard_no,sort_order').order('sort_order'),
   db.from('sar_success_indicators').select('code,parent_code,description').order('code')]);
  if(y.error||t.error||z.error)throw Error(y.error?.message||t.error?.message||z.error?.message);
  if(!live)return;const list=y.data as Year[];setSchool(sid);setYears(list);setTopics(t.data as Topic[]);setDetails(z.data as DetailItem[]);setYear(list.find(x=>x.is_active)?.id??list[0]?.id??'');
 }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดไม่สำเร็จ')}finally{if(live)setLoading(false);}})();return()=>{live=false};},[db]);
 async function reload(){
  if(!db||!school||!year)return;
  const [a,b,c,d,e,f,g,h,k,y,detailRows,staffRows]=await Promise.all([
   db.from('sar_indicator_targets').select('section_code,target_percent').eq('school_id',school).eq('academic_year_id',year),
   db.from('sar_quality_reviews').select('code,narrative,strength,improvement,action_plan,review_status').eq('school_id',school).eq('academic_year_id',year),
   db.from('sar_indicator_measurements').select('code,numerator,denominator,manually_observed_percent,source_note').eq('school_id',school).eq('academic_year_id',year),
   db.from('sar_context').select('category,title,narrative,source_note').eq('school_id',school).eq('academic_year_id',year),
   db.from('sar_national_tests').select('test_kind,grade_level,component,participants,school_average,area_average,national_average').eq('school_id',school).eq('academic_year_id',year),
   db.from('sar_evidence').select('kind,title,activity_year_be,target_codes,verification_status').eq('school_id',school).eq('academic_year_id',year).eq('verification_status','verified'),
   db.from('sar_report_versions').select('id,version_no,snapshot,approved_at').eq('school_id',school).eq('academic_year_id',year).order('version_no',{ascending:false}),
   db.rpc('sar_admin_auto_snapshot',{p_year:year}),db.rpc('sar_admin_academic_summary',{p_year:year}),
   db.from('academic_years').select('year_be,schools(name_th)').eq('id',year).single(),
   db.from('sar_success_targets').select('indicator_code,target_percent').eq('school_id',school).eq('academic_year_id',year),
   db.from('sar_staff_profiles').select('user_id,employment_type,position_title,qualification,major,academic_rank').eq('school_id',school)
  ]);
  const errors=[a,b,c,d,e,f,g,h,k,y,detailRows,staffRows].find(x=>x.error);
  if(errors?.error)throw Error(errors.error.message);
  const yearRow=y.data as unknown as {year_be:number;schools:{name_th:string}|null};
  const summary=(await db.from('sar_teacher_submissions').select('teacher_user_id').eq('school_id',school).eq('academic_year_id',year)).data??[];
  const scores=(await db.from('sar_teacher_assessments').select('item_code,rating,teacher_user_id').eq('school_id',school).eq('academic_year_id',year)).data??[];
  const submitted=new Set(summary.map(x=>x.teacher_user_id));
  const means=[...new Set(scores.map(x=>x.item_code))].map(code=>{
   const v=scores.filter(x=>x.item_code===code&&x.rating!=null&&submitted.has(x.teacher_user_id));
   return {item_code:code,n:v.length,mean_rating:v.length?Math.round(100*v.reduce((sum,x)=>sum+(x.rating??0),0)/v.length)/100:0}
  }).filter(x=>x.n>0);
  setDraft({year:yearRow.year_be,school:yearRow.schools?.name_th??'สถานศึกษา',
   targets:a.data as Target[],success_targets:detailRows.data as DetailTarget[],staff_profiles:staffRows.data as StaffInfo[],reviews:b.data as Review[],measurements:c.data as Measure[],
   context:d.data as Context[],national_tests:e.data as National[],evidence:f.data as Evidence[],
   teacher_summary:means,roster:h.data as Gender,academic_summary:k.data as GradeSummary});
  setVersions(g.data as Version[]);
 }
 useEffect(()=>{if(!school||!year)return;let live=true;setLoading(true);setError('');setSelected('draft');
  void reload().catch(e=>{if(live)setError(e instanceof Error?e.message:'โหลดรายงานไม่สำเร็จ')}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[school,year]);
 const selectedVersion=versions.find(x=>x.id===selected);
 const report=selectedVersion?.snapshot??draft;
 const html=report?makeHtml(report,topics,details,selectedVersion?.version_no??null):'';
 async function approve(){
  if(!db||!year||busy||!window.confirm('ยืนยันจัดทำรายงาน SAR ฉบับรับรอง? ระบบจะล็อกภาพรวมข้อมูลในวันที่อนุมัติ และไม่แก้ไขรายงานรุ่นก่อน'))return;
  setBusy(true);setError('');setNotice('');
  try{const r=await db.rpc('sar_approve_report',{p_year:year});if(r.error)throw Error(r.error.message);
   await reload();setNotice('สร้างรายงานฉบับรับรองรุ่นที่ '+r.data+' แล้ว');}
  catch(e){setError(e instanceof Error?e.message:'อนุมัติไม่สำเร็จ')}finally{setBusy(false)}
 }
 function printPdf(){
  const w=window.open('','_blank');if(!w){setError('กรุณาอนุญาตหน้าต่างป๊อปอัปเพื่อพิมพ์ PDF');return;}
  w.document.open();w.document.write(html);w.document.close();w.focus();w.print();
 }
 const complete=topics.filter(t=>t.code!=='overall').every(t=>draft?.reviews.some(r=>r.code===t.code&&r.review_status==='reviewed'));
 const hasPublished=!!draft&&draft.targets.length===topics.length;
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-12">
  <PageHeader title="จัดทำรายงาน SAR ขั้นพื้นฐาน" context="ตรวจฉบับร่าง รับรองข้อมูล และส่งออก Word หรือ PDF"/>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
   <label className="text-sm font-medium">ปีการศึกษา <select className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2" value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <Link href="/admin/sar/review" className="text-sm text-blue-700 underline">← ตรวจรับรองมาตรฐาน</Link>
  </div>
  {error&&<p className="teacher-error mb-3" role="alert">{error}</p>}
  {notice&&<p className="teacher-success mb-3" role="status">{notice}</p>}
  {loading&&<p role="status">กำลังรวบรวมข้อมูล...</p>}
  <div className="mb-4 flex flex-wrap gap-3">
   <label className="text-sm">ฉบับรายงาน <select className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2" value={selected} onChange={e=>setSelected(e.target.value)}>
    <option value="draft">ฉบับร่าง (ข้อมูลปัจจุบัน)</option>{versions.map(v=><option value={v.id} key={v.id}>ฉบับรับรอง รุ่น {v.version_no} — {new Date(v.approved_at).toLocaleDateString('th-TH')}</option>)}
   </select></label>
   <button className="ui-secondary" disabled={!report} onClick={()=>downloadDocx(report!,topics,details,selectedVersion?.version_no??null)}>ส่งออก Word (.docx)</button>
   <button className="ui-secondary" disabled={!report} onClick={printPdf}>พิมพ์ / บันทึก PDF</button>
  </div>
  <p className="mb-4 text-xs text-slate-500">Word เป็นไฟล์ DOCX ที่แก้ไขต่อได้ ส่วน PDF ใช้คำสั่งพิมพ์ของเบราว์เซอร์ การสร้างเอกสารไม่ส่งคะแนนรายบุคคลออกไปภายนอก</p>
  <section className="mb-6 border-y border-slate-200 py-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">สถานะความพร้อมรายงาน</h2>
    <button className="ui-primary" disabled={busy||!complete||!hasPublished} onClick={()=>void approve()}>รับรองรายงานฉบับใหม่</button></div>
   <p className="mt-2 text-sm">ค่าเป้าหมายครบ: {hasPublished?'ครบ':'ยังไม่ครบ'} · ประเด็นที่ตรวจรับรอง: {draft?.reviews.filter(x=>x.code!=='overall'&&x.review_status==='reviewed').length??0}/{topics.length?topics.length-1:26}</p>
   {!complete&&<p className="mt-2 text-sm text-amber-800">กรุณาให้ Admin ตรวจรับรองทั้ง 26 ประเด็นก่อนสร้างฉบับรับรอง</p>}
  </section>
  {report&&<section aria-label="ตัวอย่างเนื้อหา SAR">
   <h2 className="mb-3 text-lg font-semibold">สารบัญข้อมูลในรายงาน</h2>
   <div className="grid gap-3 sm:grid-cols-3">{([
    ['รายการค่าเป้าหมาย',report.targets.length],
    ['ตัวชี้วัดความสำเร็จ',report.success_targets?.length??0],
    ['ผลการประเมินที่บันทึก',report.measurements.length],
    ['หลักฐานที่รับรอง',report.evidence.length],
    ['ผลทดสอบระดับชาติ',report.national_tests.length],
    ['ข้อมูลพื้นฐาน/แผนงาน',report.context.length],
    ['รายการผลประเมินครู',report.teacher_summary?.length??0]
   ] as const).map(([label,n])=><div className="border-b border-slate-200 py-3" key={label}><strong className="block text-2xl tabular-nums">{n}</strong><span className="text-xs text-slate-500">{label}</span></div>)}</div>
   <div className="mt-5 overflow-x-auto border border-slate-200 bg-white p-6">
    <h3 className="text-center text-xl font-bold">รายงานการประเมินตนเองของสถานศึกษา (SAR)</h3>
    <p className="text-center">{report.school} · ปีการศึกษา {report.year} · {selectedVersion?'ฉบับรับรองรุ่น '+selectedVersion.version_no:'ฉบับร่าง'}</p>
    {[1,2,3].map(no=><div key={no} className="mt-5"><h4 className="font-semibold">มาตรฐานที่ {no}</h4><table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-100"><th className="p-2 text-left">ประเด็น</th><th className="p-2 text-right">เป้าหมาย</th><th className="p-2 text-right">ผลประเมิน</th></tr></thead>
     <tbody>{topics.filter(t=>t.standard_no===no).map(t=><tr key={t.code} className="border-t border-slate-100"><td className="p-2">{t.code} {t.title}</td><td className="p-2 text-right">{report.targets.find(x=>x.section_code===t.code)?.target_percent??'—'}%</td><td className="p-2 text-right">{pct(report.measurements.find(x=>x.code===t.code))??'ไม่มีข้อมูล'}</td></tr>)}</tbody></table></div>)}
   </div>
  </section>}
 </main>;
}
