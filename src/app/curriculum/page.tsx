'use client';
import PageHeader from '@/components/page-header';
import Link from 'next/link';
import PageControls,{PAGE_SIZE} from '@/components/page-controls';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type School={id:string;name_th:string};
type Curriculum={id:string;name_th:string};
type Version={id:string;curriculum_id:string;version_label:string;effective_year_be:number};
type Subject={id:string;curriculum_version_id:string;subject_code:string;name_th:string;learning_hours:number;category:string;grade_level:string|null;hour_basis:'year'|'term'|null};
export default function CurriculumPage(){
 const router=useRouter();const db=getSupabaseBrowserClient();
 const [schools,setSchools]=useState<School[]>([]),[schoolId,setSchoolId]=useState('');
 const [canEdit,setCanEdit]=useState(false),[loading,setLoading]=useState(true);
 const [curricula,setCurricula]=useState<Curriculum[]>([]),[versions,setVersions]=useState<Version[]>([]),[subjects,setSubjects]=useState<Subject[]>([]);
 const [curriculumId,setCurriculumId]=useState(''),[versionId,setVersionId]=useState('');
 const [step,setStep]=useState<1|2|3>(1);
 const [formOpen,setFormOpen]=useState(false);
 const [name,setName]=useState(''),[versionName,setVersionName]=useState(''),[effectiveYear,setEffectiveYear]=useState('2569');
 const [subjectQuery,setSubjectQuery]=useState(''),[subjectPage,setSubjectPage]=useState(1);
 const [gradeLevel,setGradeLevel]=useState('ป.1'),[filterGrade,setFilterGrade]=useState('ป.1');
 const gradeLevels=['ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'];
 const [hourBasis,setHourBasis]=useState<'year'|'term'>('year');
 const [subjectCode,setSubjectCode]=useState(''),[subjectName,setSubjectName]=useState(''),[hours,setHours]=useState('40'),[category,setCategory]=useState('basic');
 const [offerings,setOfferings]=useState<{id:string;subject_id:string;term_id:string;classroom_id:string}[]>([]),[assignedOfferingIds,setAssignedOfferingIds]=useState<string[]>([]),[cancelReason,setCancelReason]=useState(''),[cancelId,setCancelId]=useState('');
 const [editing,setEditing]=useState<Subject|null>(null),[usedSubjectIds,setUsedSubjectIds]=useState<string[]>([]);
 const [editHourBasis,setEditHourBasis]=useState<'year'|'term'>('year');
 const [editCode,setEditCode]=useState(''),[editName,setEditName]=useState(''),[editGrade,setEditGrade]=useState('ป.1'),[editHours,setEditHours]=useState('40'),[editCategory,setEditCategory]=useState('basic');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let mounted=true;(async()=>{
  if(!db){setError('ยังไม่ได้เชื่อมต่อ Supabase');setLoading(false);return;}
  const {data:{user}}=await db.auth.getUser();if(!mounted)return;
  if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
  if(!mounted)return;if(e){setError(e.message);setLoading(false);return;}
  const members=(data??[]) as unknown as {school_id:string;role:string;schools:School|null}[];
  const list=[...new Map(members.filter(m=>m.schools).map(m=>[m.school_id,m.schools!])).values()];
  setSchools(list);setSchoolId(list[0]?.id??'');setLoading(false);
 })();return()=>{mounted=false;};},[db,router]);
 useEffect(()=>{let mounted=true;(async()=>{
  if(!db||!schoolId)return;
  const {data:{user}}=await db.auth.getUser();if(!user)return;
  const [c,v,s,m,o,a]=await Promise.all([
   db.from('curricula').select('id,name_th').eq('school_id',schoolId).order('name_th'),
   db.from('curriculum_versions').select('id,curriculum_id,version_label,effective_year_be').eq('school_id',schoolId),
   db.from('subjects').select('id,curriculum_version_id,subject_code,name_th,learning_hours,category,grade_level,hour_basis').eq('school_id',schoolId),
   db.from('school_memberships').select('role').eq('school_id',schoolId).eq('user_id',user.id).eq('active',true),
   db.from('course_offerings').select('id,subject_id,term_id,classroom_id').eq('school_id',schoolId),
   db.from('teaching_assignments').select('course_offering_id').eq('school_id',schoolId)
  ]);
  if(!mounted)return;const e=[c.error,v.error,s.error,m.error,o.error,a.error].find(Boolean);
  if(e){setError(e.message);return;}
  setCurricula(c.data??[]);setVersions(v.data??[]);setSubjects(s.data??[]);setOfferings(o.data??[]);setUsedSubjectIds([...(new Set((o.data??[]).map(x=>x.subject_id)))]);setAssignedOfferingIds((a.data??[]).map(x=>x.course_offering_id));
  setCanEdit((m.data??[]).some(x=>['school_admin','academic'].includes(x.role)));
  setCurriculumId(old=>(c.data??[]).some(x=>x.id===old)?old:'');
 })();return()=>{mounted=false;};},[db,schoolId,notice]);
 const filteredVersions=versions.filter(v=>v.curriculum_id===curriculumId);
 const selectedVersion=filteredVersions.some(v=>v.id===versionId)?versionId:'';
 const selectedSubjects=subjects.filter(s=>s.curriculum_version_id===selectedVersion&&s.grade_level===filterGrade);
 const filteredSubjects=selectedSubjects.filter(s=>(s.subject_code+' '+s.name_th).toLocaleLowerCase().includes(subjectQuery.toLocaleLowerCase()));
 const visibleSubjects=filteredSubjects.slice((subjectPage-1)*PAGE_SIZE,subjectPage*PAGE_SIZE);
 function beginEdit(s:Subject){
  setFormOpen(true);
  setEditing(s);setEditCode(s.subject_code);setEditName(s.name_th);setEditGrade(s.grade_level??'ป.1');
  setEditCategory(s.category);setEditHours(String(s.learning_hours));setEditHourBasis(s.hour_basis??(s.grade_level?.startsWith('ม.')?'term':'year'));setError('');setNotice('');
 }
 async function cancelOffering(){
  if(!db||!canEdit||busy||!cancelId||cancelReason.trim().length<5)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {error:e}=await db.rpc('cancel_unused_course_offering',{p_offering_id:cancelId,p_reason:cancelReason.trim()});
   if(e)setError(e.message);else{setCancelId('');setCancelReason('');setNotice('ยกเลิกรายการเปิดสอนแล้ว โดยบันทึกเหตุผลและประวัติการยกเลิกไว้');}
  }catch(e){setError(e instanceof Error?e.message:'ไม่สามารถยกเลิกรายการเปิดสอนได้');}finally{setBusy(false);}
 }
 async function saveEdit(){
  if(!db||!editing||!canEdit||busy)return;
  if(!editCode.trim()||!editName.trim()||!Number.isInteger(Number(editHours))||Number(editHours)<0||Number(editHours)>2000){
   setError('กรุณากรอกข้อมูลรายวิชาให้ครบและชั่วโมงเรียนให้ถูกต้อง');return;
  }
  setBusy(true);setError('');setNotice('');
  try{
   const {error:e}=await db.rpc('edit_curriculum_subject_with_hours',{p_subject_id:editing.id,p_subject_code:editCode.trim(),p_name_th:editName.trim(),p_grade_level:editGrade,p_category:editCategory,p_learning_hours:Number(editHours),p_hour_basis:editHourBasis});
   if(e)setError(e.message);else{setEditing(null);setFormOpen(false);setNotice('แก้ไขรายวิชาเรียบร้อยแล้ว');setFilterGrade(editGrade);}
  }catch(e){setError(e instanceof Error?e.message:'แก้ไขรายวิชาไม่สำเร็จ');}
  finally{setBusy(false);}
 }
 async function save(task:()=>PromiseLike<{error:{message:string}|null}>,message:string){
  if(!canEdit||busy)return;setBusy(true);setError('');setNotice('');
  try{const result=await task();if(result.error)setError(result.error.message);else setNotice(message);}
  catch(e){setError(e instanceof Error?e.message:'ไม่สามารถบันทึกข้อมูลได้');}
  finally{setBusy(false);}
 }

 const inputClass='mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
 const unit=(s:Subject)=>s.hour_basis==='year'?'ชม./ปี':s.hour_basis==='term'?'ชม./ภาคเรียน':'ชม. (ไม่ระบุ)';
 const categoryText=(s:string)=>s==='basic'?'พื้นฐาน':s==='additional'?'เพิ่มเติม':'กิจกรรม';
 const categoryColor=(s:string)=>s==='basic'?'bg-blue-50 text-blue-700':s==='additional'?'bg-orange-50 text-orange-700':'bg-emerald-50 text-emerald-700';
 const total=(type:string,basis:'year'|'term')=>selectedSubjects.filter(s=>s.category===type&&s.hour_basis===basis).reduce((sum,s)=>sum+s.learning_hours,0);
 const createValid=!!canEdit&&!busy&&!!selectedVersion&&subjectCode.trim().length>1&&subjectName.trim().length>1&&hours.trim()!==''&&Number.isInteger(Number(hours))&&Number(hours)>=0&&Number(hours)<=2000;
 function openCreate(){setEditing(null);setCancelId('');setGradeLevel(filterGrade);setHourBasis(filterGrade.startsWith('ม.')?'term':'year');setFormOpen(true);}
 function closeForm(){setFormOpen(false);setEditing(null);setCancelId('');setCancelReason('');}
 async function createSubject(){
  if(!db||!createValid)return;
  await save(()=>db.from('subjects').insert({school_id:schoolId,curriculum_version_id:selectedVersion,subject_code:subjectCode.trim(),name_th:subjectName.trim(),learning_hours:Number(hours),hour_basis:hourBasis,category,grade_level:gradeLevel}),'เพิ่มรายวิชาแล้ว');
  // On success the data reloads through notice; the form remains visible until the user closes it.
 }
 return <main className="wichakan-page mx-auto max-w-7xl px-4 pb-5 pt-4 sm:px-6">
  <PageHeader title="หลักสูตรและรายวิชา" context={schools.find(s=>s.id===schoolId)?.name_th}/>
  {loading&&<p className="mt-4 text-sm text-slate-500">กำลังตรวจสอบสิทธิ์และโหลดข้อมูล...</p>}
  {schools.length>1&&<label className="mt-3 block text-sm">โรงเรียน <select className="ml-2 rounded-lg border p-2" value={schoolId} onChange={e=>{setSchoolId(e.target.value);setCurriculumId('');setVersionId('');setStep(1);closeForm();}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>}
  {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  {schoolId&&<>
   <nav className="mt-4 flex gap-2 overflow-x-auto" aria-label="ขั้นตอนหลักสูตร">
    {([{id:1,label:'หลักสูตร',icon:'▤'},{id:2,label:'ฉบับหลักสูตร',icon:'▣'},{id:3,label:'รายวิชา',icon:'▥'}] as const).map(s=><button key={s.id} type="button" disabled={s.id===2&&!curriculumId||s.id===3&&!selectedVersion} onClick={()=>{setStep(s.id);closeForm();}}
      aria-current={step===s.id?'step':undefined} className={`min-w-32 shrink-0 rounded-t-xl border border-b-2 px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${step===s.id?'border-blue-300 border-b-blue-600 bg-blue-50 text-blue-700':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
      <span aria-hidden="true" className="mr-2">{s.icon}</span>{s.id}. {s.label}
    </button>)}
   </nav>
   {step===1&&<section className="ui-panel mt-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-blue-950">เลือกหลักสูตรสถานศึกษา</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">ขั้นที่ 1 จาก 3</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{curricula.map(item=><button key={item.id} type="button" onClick={()=>{setCurriculumId(item.id);setVersionId('');closeForm();setSubjectPage(1);}} className={`rounded-2xl border p-5 text-left transition ${curriculumId===item.id?'border-blue-500 bg-blue-50 shadow-sm':'border-slate-200 bg-slate-50/40 hover:border-blue-300'}`}>
     <span className="text-xl text-blue-700">▤</span><span className="mt-3 block font-bold text-slate-900">{item.name_th}</span><span className="mt-1 block text-xs text-slate-500">{versions.filter(v=>v.curriculum_id===item.id).length} ฉบับหลักสูตร</span></button>)}
    {!curricula.length&&<p className="text-sm text-slate-500">ยังไม่มีหลักสูตร กรุณาเพิ่มหลักสูตรก่อน</p>}</div>
    {canEdit&&<details className="mt-5 rounded-xl border border-blue-100 p-4"><summary className="cursor-pointer text-sm font-semibold text-blue-700">+ เพิ่มหลักสูตรใหม่</summary><div className="mt-3 flex flex-wrap gap-2"><input aria-label="ชื่อหลักสูตร" className="min-w-52 flex-1 rounded-xl border p-3 text-sm" value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อหลักสูตรสถานศึกษา"/><button disabled={busy||!name.trim()} onClick={()=>save(()=>db!.from('curricula').insert({school_id:schoolId,name_th:name.trim()}),'เพิ่มหลักสูตรแล้ว')} className="ui-primary rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">บันทึกหลักสูตร</button></div></details>}
    <div className="mt-6 flex justify-end"><button type="button" disabled={!curriculumId} onClick={()=>setStep(2)} className="ui-primary rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">ถัดไป: ฉบับหลักสูตร →</button></div>
   </section>}
   {step===2&&curriculumId&&<section className="ui-panel rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-blue-950">เลือกฉบับหลักสูตร</h2><p className="mt-1 text-sm text-slate-500">{curricula.find(x=>x.id===curriculumId)?.name_th}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">ขั้นที่ 2 จาก 3</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredVersions.map(v=><button key={v.id} type="button" onClick={()=>{setVersionId(v.id);closeForm();setSubjectPage(1);}} className={`rounded-2xl border p-5 text-left ${selectedVersion===v.id?'border-blue-500 bg-blue-50':'border-slate-200 bg-slate-50/40 hover:border-blue-300'}`}><span className="text-xl text-blue-700">▣</span><span className="mt-3 block font-bold">{v.version_label}</span><span className="mt-1 block text-xs text-slate-500">เริ่มใช้ พ.ศ. {v.effective_year_be}</span></button>)}{!filteredVersions.length&&<p className="text-sm text-slate-500">ยังไม่มีฉบับหลักสูตร</p>}</div>
    {canEdit&&<details className="mt-5 rounded-xl border border-blue-100 p-4"><summary className="cursor-pointer text-sm font-semibold text-blue-700">+ เพิ่มฉบับหลักสูตร</summary><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]"><input aria-label="ชื่อฉบับ" className="rounded-xl border p-3 text-sm" placeholder="ชื่อฉบับหลักสูตร" value={versionName} onChange={e=>setVersionName(e.target.value)}/><input aria-label="ปีเริ่มใช้" type="number" className="rounded-xl border p-3 text-sm" value={effectiveYear} onChange={e=>setEffectiveYear(e.target.value)}/><button disabled={busy||!versionName.trim()||Number(effectiveYear)<2500||Number(effectiveYear)>2800} onClick={()=>save(()=>db!.from('curriculum_versions').insert({school_id:schoolId,curriculum_id:curriculumId,version_label:versionName.trim(),effective_year_be:Number(effectiveYear)}),'เพิ่มฉบับหลักสูตรแล้ว')} className="ui-primary rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">บันทึกฉบับ</button></div></details>}
    <div className="mt-6 flex justify-between gap-3"><button onClick={()=>setStep(1)} className="rounded-xl border px-5 py-3 text-sm">← หลักสูตร</button><button disabled={!selectedVersion} onClick={()=>setStep(3)} className="ui-primary rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">ถัดไป: รายวิชา →</button></div>
   </section>}
   {step===3&&curriculumId&&selectedVersion&&<div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.95fr)_minmax(320px,1fr)]">
    <section className="ui-panel min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
     <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-bold text-blue-950">รายการรายวิชา</h2><p className="mt-1 text-xs text-slate-500">{curricula.find(x=>x.id===curriculumId)?.name_th} / {filteredVersions.find(v=>v.id===selectedVersion)?.version_label}</p></div><button type="button" onClick={()=>{setStep(2);closeForm();}} className="text-xs font-semibold text-blue-700">เปลี่ยนฉบับ →</button></div>
     <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_125px_auto]">
      <input className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" aria-label="ค้นหารายวิชา" placeholder="⌕ ค้นหารหัสหรือชื่อรายวิชา" value={subjectQuery} onChange={e=>{setSubjectQuery(e.target.value);setSubjectPage(1);}}/>
      <select aria-label="ระดับชั้น" className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm" value={filterGrade} onChange={e=>{setFilterGrade(e.target.value);setSubjectPage(1);}}>{gradeLevels.map(g=><option key={g}>{g}</option>)}</select>
      <button type="button" disabled={!canEdit} onClick={openCreate} className="ui-primary rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">+ เพิ่มรายวิชา</button>
     </div>
     <div className="mt-4 max-h-[min(55vh,600px)] overflow-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[660px] text-left text-sm"><thead className="sticky top-0 z-10 bg-[#eff5fc] text-xs text-[#284b7d]"><tr><th className="px-3 py-3">รหัสวิชา</th><th className="px-3 py-3">ชื่อรายวิชา</th><th className="px-3 py-3">ประเภท</th><th className="px-3 py-3 text-right">ชั่วโมงเรียน</th><th className="px-3 py-3 text-right">หน่วยกิต</th><th className="px-3 py-3 text-right">จัดการ</th></tr></thead>
       <tbody>{visibleSubjects.map(s=><tr key={s.id} className={`border-t border-slate-100 hover:bg-blue-50/40 ${editing?.id===s.id?'bg-blue-50':''}`}><td className="px-3 py-3 font-semibold text-blue-950">{s.subject_code}</td><td className="px-3 py-3">{s.name_th}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${categoryColor(s.category)}`}>{categoryText(s.category)}</span></td><td className="whitespace-nowrap px-3 py-3 text-right">{s.learning_hours} {unit(s)}</td><td className="px-3 py-3 text-right">{s.grade_level?.startsWith('ม.')&&s.category!=='activity'&&s.hour_basis?(s.learning_hours/40).toFixed(2):'—'}</td><td className="px-3 py-3 text-right"><button type="button" disabled={!canEdit} onClick={()=>beginEdit(s)} className="font-semibold text-blue-700 disabled:opacity-40">✎ แก้ไข</button></td></tr>)}</tbody>
      </table>
      {!filteredSubjects.length&&<p className="px-4 py-10 text-center text-sm text-slate-400">ไม่พบรายวิชาสำหรับระดับชั้นนี้</p>}
     </div>
     <PageControls total={filteredSubjects.length} page={Math.min(subjectPage,Math.max(1,Math.ceil(filteredSubjects.length/PAGE_SIZE)))} onChange={setSubjectPage}/>
    </section>
    <div className="min-w-0 space-y-4">
     <section className="ui-panel rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5" aria-label="สรุปโครงสร้างเวลาเรียน">
      <h2 className="text-lg font-bold text-blue-950">▥ สรุปโครงสร้างเวลาเรียน</h2><p className="mt-1 text-xs text-slate-500">ระดับชั้น {filterGrade} · เฉพาะฉบับหลักสูตรที่เลือก</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-blue-50"><table className="w-full min-w-[300px] text-xs"><thead className="bg-blue-50 text-blue-800"><tr><th className="p-3 text-left">ประเภท</th><th className="p-3 text-right">ชม./ปี</th><th className="p-3 text-right">ชม./ภาค</th></tr></thead><tbody>{([['basic','รายวิชาพื้นฐาน'],['additional','รายวิชาเพิ่มเติม'],['activity','กิจกรรมพัฒนาผู้เรียน']] as const).map(([type,label])=><tr key={type} className="border-t"><td className="p-3"><span className={`mr-1 inline-block h-2 w-2 rounded-full ${type==='basic'?'bg-blue-500':type==='additional'?'bg-orange-500':'bg-emerald-500'}`}/>{label}</td><td className="p-3 text-right tabular-nums">{total(type,'year')}</td><td className="p-3 text-right tabular-nums">{total(type,'term')}</td></tr>)}</tbody></table></div>
      {selectedSubjects.some(s=>!s.hour_basis)&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">มี {selectedSubjects.filter(s=>!s.hour_basis).length} วิชาที่ยังไม่ระบุหน่วยเวลา จึงไม่รวมในผลรวม</p>}
      <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">ชั่วโมง/ปี และ ชั่วโมง/ภาคเรียนเป็นคนละหน่วย จึงไม่บวกรวมกัน</p>
     </section>
     <section className="ui-panel rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold text-blue-950">{editing?'แก้ไขรายวิชา':'เพิ่มรายวิชา'}</h2>{formOpen&&<button type="button" onClick={closeForm} aria-label="ปิดแบบฟอร์ม" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button>}</div>
      {!formOpen?<div className="mt-3"><button type="button" disabled={!canEdit} onClick={openCreate} className="mt-4 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40">+ เพิ่มรายวิชา</button></div>:
       <div className="mt-3 max-h-[min(45vh,480px)] space-y-3 overflow-y-auto pr-1">
        {editing&&usedSubjectIds.includes(editing.id)&&<div role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">รายวิชานี้มีประวัติเปิดสอน จึงแก้ไขไม่ได้จนกว่าจะยกเลิกการเปิดสอนที่ไม่มีครูผู้สอน หากมีประวัติการสอนจริงให้สร้างฉบับหลักสูตรใหม่</div>}
        <div className="grid grid-cols-2 gap-3">
         <label className="text-xs font-semibold text-slate-600">รหัสวิชา<input className={inputClass} value={editing?editCode:subjectCode} onChange={e=>editing?setEditCode(e.target.value):setSubjectCode(e.target.value)}/></label>
         <label className="text-xs font-semibold text-slate-600">ชื่อรายวิชา<input className={inputClass} value={editing?editName:subjectName} onChange={e=>editing?setEditName(e.target.value):setSubjectName(e.target.value)}/></label>
         <label className="text-xs font-semibold text-slate-600">ระดับชั้น<select className={inputClass} value={editing?editGrade:gradeLevel} onChange={e=>{const g=e.target.value;if(editing){setEditGrade(g);setEditHourBasis(g.startsWith('ม.')?'term':'year');}else{setGradeLevel(g);setHourBasis(g.startsWith('ม.')?'term':'year');}}}>{gradeLevels.map(g=><option key={g}>{g}</option>)}</select></label>
         <label className="text-xs font-semibold text-slate-600">ประเภท<select className={inputClass} value={editing?editCategory:category} onChange={e=>editing?setEditCategory(e.target.value):setCategory(e.target.value)}><option value="basic">พื้นฐาน</option><option value="additional">เพิ่มเติม</option><option value="activity">กิจกรรม</option></select></label>
         <label className="text-xs font-semibold text-slate-600">ช่วงเวลาเรียน<select className={inputClass} value={editing?editHourBasis:hourBasis} onChange={e=>editing?setEditHourBasis(e.target.value as 'year'|'term'):setHourBasis(e.target.value as 'year'|'term')}><option value="year">ชั่วโมง/ปี</option><option value="term">ชั่วโมง/ภาคเรียน</option></select></label>
         <label className="text-xs font-semibold text-slate-600">ชั่วโมงเรียน<input type="number" min="0" max="2000" className={inputClass} value={editing?editHours:hours} onChange={e=>editing?setEditHours(e.target.value):setHours(e.target.value)}/></label>
        </div>
        <p className="text-xs text-slate-500">หน่วยกิตมัธยม (ยกเว้นกิจกรรม): {((editing?editGrade:gradeLevel).startsWith('ม.')&&(editing?editCategory:category)!=='activity')?((Number(editing?editHours:hours)||0)/40).toFixed(2):'—'}</p>
        {editing&&usedSubjectIds.includes(editing.id)&&<div className="space-y-2 rounded-lg border p-3"><h3 className="text-sm font-semibold">รายการเปิดสอนที่เกี่ยวข้อง</h3>{offerings.filter(o=>o.subject_id===editing.id).map(o=><div key={o.id} className="flex items-center justify-between gap-2 border-t pt-2 text-xs"><span>{o.id.slice(0,8)} · {assignedOfferingIds.includes(o.id)?'มีครูสอน':'ไม่มีครูสอน'}</span><button type="button" disabled={busy||assignedOfferingIds.includes(o.id)} onClick={()=>{setCancelId(o.id);setCancelReason('');}} className="text-amber-700 disabled:opacity-40">ยกเลิกการเปิดสอน</button></div>)}{cancelId&&<div className="space-y-2"><input className={inputClass} placeholder="ระบุเหตุผลอย่างน้อย 5 ตัวอักษร" value={cancelReason} onChange={e=>setCancelReason(e.target.value)}/><button type="button" disabled={busy||cancelReason.trim().length<5} onClick={cancelOffering} className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white disabled:opacity-40">ยืนยันยกเลิก</button></div>}</div>}
        <div className="flex justify-end gap-2 border-t pt-3"><button type="button" onClick={closeForm} className="rounded-xl border px-4 py-2 text-sm">ยกเลิก</button><button type="button" disabled={editing?(!canEdit||busy||usedSubjectIds.includes(editing.id)):!createValid} onClick={editing?saveEdit:createSubject} className="ui-primary rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy?'กำลังบันทึก...':'บันทึกรายวิชา'}</button></div>
       </div>}
     </section>
    </div>
   </div>}
  </>}
 </main>;
}
