'use client';
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
  setCurriculumId(old=>(c.data??[]).some(x=>x.id===old)?old:c.data?.[0]?.id??'');
 })();return()=>{mounted=false;};},[db,schoolId,notice]);
 const filteredVersions=versions.filter(v=>v.curriculum_id===curriculumId);
 const selectedVersion=filteredVersions.some(v=>v.id===versionId)?versionId:filteredVersions[0]?.id??'';
 const selectedSubjects=subjects.filter(s=>s.curriculum_version_id===selectedVersion&&s.grade_level===filterGrade);
 const filteredSubjects=selectedSubjects.filter(s=>(s.subject_code+' '+s.name_th).toLocaleLowerCase().includes(subjectQuery.toLocaleLowerCase()));
 const visibleSubjects=filteredSubjects.slice((subjectPage-1)*PAGE_SIZE,subjectPage*PAGE_SIZE);
 function beginEdit(s:Subject){
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
   if(e)setError(e.message);else{setEditing(null);setNotice('แก้ไขรายวิชาเรียบร้อยแล้ว');setFilterGrade(editGrade);}
  }catch(e){setError(e instanceof Error?e.message:'แก้ไขรายวิชาไม่สำเร็จ');}
  finally{setBusy(false);}
 }
 async function save(task:()=>PromiseLike<{error:{message:string}|null}>,message:string){
  if(!canEdit||busy)return;setBusy(true);setError('');setNotice('');
  try{const result=await task();if(result.error)setError(result.error.message);else setNotice(message);}
  catch(e){setError(e instanceof Error?e.message:'ไม่สามารถบันทึกข้อมูลได้');}
  finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-6xl px-5 py-8">
 <Link href="/" className="text-sm text-blue-700">← Wichakan</Link>
 <h1 className="mt-3 text-3xl font-bold">หลักสูตรและรายวิชา</h1><p className="mt-2 text-sm text-slate-500">Curriculum Management · v0.5</p>
 {loading&&<p className="mt-4">กำลังโหลด...</p>}
 {schools.length>1&&<select className="mt-4 rounded-xl border p-3" value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select>}
 {schools.length===1&&<p className="mt-4 font-medium">{schools[0].name_th}</p>}
 {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
 {notice&&<p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">{notice}</p>}
 {schoolId&&<div className="mt-6 grid gap-5 lg:grid-cols-2">
  <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">หลักสูตรสถานศึกษา</h2>
   <label className="mt-4 block text-sm">ชื่อหลักสูตร<input className="mt-2 w-full rounded-xl border p-3" value={name} onChange={e=>setName(e.target.value)} placeholder="หลักสูตรสถานศึกษา"/></label>
   <button className="mt-3 rounded-xl bg-blue-800 px-5 py-3 text-sm text-white disabled:opacity-40" disabled={!canEdit||busy||!name.trim()} onClick={()=>save(()=>db!.from('curricula').insert({school_id:schoolId,name_th:name.trim()}),'เพิ่มหลักสูตรแล้ว')}>เพิ่มหลักสูตร</button>
   <label className="mt-5 block text-sm">เลือกหลักสูตร<select className="mt-2 w-full rounded-xl border p-3" value={curriculumId} onChange={e=>{setCurriculumId(e.target.value);setVersionId('');}}><option value="">เลือกหลักสูตร</option>{curricula.map(c=><option key={c.id} value={c.id}>{c.name_th}</option>)}</select></label>
  </section>
  <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">ฉบับหลักสูตร</h2>
   <label className="mt-4 block text-sm">ชื่อฉบับ<input className="mt-2 w-full rounded-xl border p-3" value={versionName} onChange={e=>setVersionName(e.target.value)} placeholder="ฉบับปรับปรุง 2569"/></label>
   <label className="mt-3 block text-sm">ปีเริ่มใช้ (พ.ศ.)<input type="number" min="2500" max="2800" value={effectiveYear} onChange={e=>setEffectiveYear(e.target.value)} className="mt-2 w-full rounded-xl border p-3"/></label>
   <button className="mt-3 rounded-xl bg-blue-800 px-5 py-3 text-sm text-white disabled:opacity-40" disabled={!canEdit||busy||!curriculumId||!versionName.trim()||Number(effectiveYear)<2500||Number(effectiveYear)>2800} onClick={()=>save(()=>db!.from('curriculum_versions').insert({school_id:schoolId,curriculum_id:curriculumId,version_label:versionName.trim(),effective_year_be:Number(effectiveYear)}),'เพิ่มฉบับหลักสูตรแล้ว')}>เพิ่มฉบับ</button>
   <label className="mt-5 block text-sm">เลือกฉบับ<select className="mt-2 w-full rounded-xl border p-3" value={selectedVersion} onChange={e=>setVersionId(e.target.value)}><option value="">เลือกฉบับ</option>{filteredVersions.map(v=><option key={v.id} value={v.id}>{v.version_label} (เริ่ม {v.effective_year_be})</option>)}</select></label>
  </section>
  <section className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2"><h2 className="text-lg font-bold">รายวิชา</h2>
   <details className="mt-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4"><summary className="cursor-pointer font-semibold text-blue-800">+ เพิ่มรายวิชา</summary>
   <div className="mt-4 grid gap-3 md:grid-cols-4">
    <label className="text-sm">ระดับชั้น<select value={gradeLevel} onChange={e=>{setGradeLevel(e.target.value);setHourBasis(e.target.value.startsWith('ม.')?'term':'year');}} className="mt-2 w-full rounded-xl border p-3">{gradeLevels.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
    <label className="text-sm">รหัสวิชา<input className="mt-2 w-full rounded-xl border p-3" value={subjectCode} onChange={e=>setSubjectCode(e.target.value)}/></label>
    <label className="text-sm md:col-span-2">ชื่อรายวิชา<input className="mt-2 w-full rounded-xl border p-3" value={subjectName} onChange={e=>setSubjectName(e.target.value)}/></label>
    <label className="text-sm">ชั่วโมงเรียน<input type="number" min="0" max="2000" className="mt-2 w-full rounded-xl border p-3" value={hours} onChange={e=>setHours(e.target.value)}/></label>
    <label className="text-sm">ช่วงเวลาเรียน<select className="mt-2 w-full rounded-xl border p-3" value={hourBasis} onChange={e=>setHourBasis(e.target.value as "year"|"term")}><option value="year">ชั่วโมง/ปี</option><option value="term">ชั่วโมง/ภาคเรียน</option></select></label>
    <label className="text-sm">ประเภท<select className="mt-2 w-full rounded-xl border p-3" value={category} onChange={e=>setCategory(e.target.value)}><option value="basic">พื้นฐาน</option><option value="additional">เพิ่มเติม</option><option value="activity">กิจกรรม</option></select></label>
   </div>
   <button disabled={!canEdit||busy||!selectedVersion||!subjectCode.trim()||!subjectName.trim()||Number(hours)<0||Number(hours)>2000} className="mt-4 rounded-xl bg-blue-800 px-5 py-3 text-sm text-white disabled:opacity-40" onClick={()=>save(()=>db!.from('subjects').insert({school_id:schoolId,curriculum_version_id:selectedVersion,subject_code:subjectCode.trim(),name_th:subjectName.trim(),learning_hours:Number(hours),hour_basis:hourBasis,category,grade_level:gradeLevel}),'เพิ่มรายวิชาแล้ว')}>เพิ่มรายวิชา</button></details>
   <label className="mt-6 block text-sm font-medium">แสดงรายวิชาของระดับชั้น<select value={filterGrade} onChange={e=>{setFilterGrade(e.target.value);setSubjectPage(1);}} className="mt-2 w-full rounded-xl border p-3">{gradeLevels.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
   <input aria-label="ค้นหารายวิชา" placeholder="ค้นหารหัสหรือชื่อรายวิชา..." className="mt-4 w-full rounded-xl border p-3 text-sm" value={subjectQuery} onChange={e=>{setSubjectQuery(e.target.value);setSubjectPage(1);}}/>
   <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">รหัสวิชา</th><th>รายวิชา</th><th>ประเภท</th><th className="text-right">ชั่วโมงเรียน</th><th className="text-right">หน่วยกิต*</th><th className="text-right">จัดการ</th></tr></thead><tbody>{visibleSubjects.map(s=><tr className="border-b" key={s.id}><td className="py-3">{s.subject_code}</td><td>{s.name_th}</td><td>{s.category==='basic'?'พื้นฐาน':s.category==='additional'?'เพิ่มเติม':'กิจกรรม'}</td><td className="text-right">{s.learning_hours} {s.hour_basis==='year'?'ชม./ปี':s.hour_basis==='term'?'ชม./ภาคเรียน':'ชม. (ไม่ระบุช่วง)'}</td><td className="text-right">{s.grade_level?.startsWith('ม.')&&s.category!=='activity'&&s.hour_basis?(s.learning_hours/40).toFixed(2):'—'}</td><td className="text-right"><button type="button" disabled={!canEdit} onClick={()=>beginEdit(s)} className="rounded-lg border px-3 py-2 text-blue-800 hover:bg-blue-50 disabled:opacity-40">แก้ไข</button></td></tr>)}</tbody></table></div>
   <PageControls total={filteredSubjects.length} page={Math.min(subjectPage,Math.max(1,Math.ceil(filteredSubjects.length/PAGE_SIZE)))} onChange={setSubjectPage}/>
   {editing&&<div className="mt-6 rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-5">
    <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">แก้ไขรายวิชา</h3><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-3 py-2 text-sm">ยกเลิก</button></div>
    {usedSubjectIds.includes(editing.id)&&<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">รายวิชานี้มีรายการเปิดสอนอยู่ หากสร้างผิดและยังไม่ใช้งาน ให้ยกเลิกรายการเปิดสอนด้านล่างก่อนแก้ไข โดยระบบจะเก็บบันทึกการยกเลิก</p>}
    {usedSubjectIds.includes(editing.id)&&<div className="mt-4 rounded-xl border bg-white p-4">
     <h4 className="font-semibold">รายการเปิดสอนที่ยังผูกกับรายวิชานี้</h4>
     <p className="mt-1 text-xs text-slate-500">ยกเลิกได้เฉพาะรายการที่ไม่มีการมอบหมายครูค้างอยู่ และต้องระบุเหตุผล</p>
     <div className="mt-3 space-y-2">{offerings.filter(o=>o.subject_id===editing.id).map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <span>รายการ {o.id.slice(0,8)} · {assignedOfferingIds.includes(o.id)?'ยังมีครูผู้สอน':'ไม่มีครูผู้สอน'}</span>
      <button type="button" disabled={busy||assignedOfferingIds.includes(o.id)} onClick={()=>{setCancelId(o.id);setCancelReason('');}} className="rounded-lg border border-amber-300 px-3 py-2 text-amber-800 disabled:opacity-40">ยกเลิกรายการเปิดสอน</button>
     </div>)}</div>
     {cancelId&&offerings.some(o=>o.id===cancelId&&o.subject_id===editing.id)&&<div className="mt-4 border-t pt-3">
      <label className="block text-sm">เหตุผลการยกเลิก<input className="mt-2 w-full rounded-lg border p-3" value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="เช่น สร้างรายวิชาผิดระดับชั้น"/></label>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy||cancelReason.trim().length<5} onClick={cancelOffering} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">ยืนยันการยกเลิก</button><button type="button" onClick={()=>setCancelId('')} className="rounded-lg border px-4 py-2 text-sm">กลับ</button></div>
     </div>}
    </div>}
    {versions.find(v=>v.id===editing.curriculum_version_id)&&<p className="mt-2 text-xs text-slate-500">แก้ไขข้อมูลในฉบับหลักสูตรที่เลือกเท่านั้น</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-3">
     <label className="text-sm">รหัสวิชา<input className="mt-2 w-full rounded-xl border p-3" value={editCode} onChange={e=>setEditCode(e.target.value)}/></label>
     <label className="text-sm md:col-span-2">ชื่อรายวิชา<input className="mt-2 w-full rounded-xl border p-3" value={editName} onChange={e=>setEditName(e.target.value)}/></label>
     <label className="text-sm">ระดับชั้น<select className="mt-2 w-full rounded-xl border p-3" value={editGrade} onChange={e=>{setEditGrade(e.target.value);setEditHourBasis(e.target.value.startsWith('ม.')?'term':'year');}}>{gradeLevels.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
     <label className="text-sm">ช่วงเวลาเรียน<select className="mt-2 w-full rounded-xl border p-3" value={editHourBasis} onChange={e=>setEditHourBasis(e.target.value as "year"|"term")}><option value="year">ชั่วโมง/ปี</option><option value="term">ชั่วโมง/ภาคเรียน</option></select></label>
     <label className="text-sm">ประเภท<select className="mt-2 w-full rounded-xl border p-3" value={editCategory} onChange={e=>setEditCategory(e.target.value)}><option value="basic">พื้นฐาน</option><option value="additional">เพิ่มเติม</option><option value="activity">กิจกรรม</option></select></label>
     <label className="text-sm">ชั่วโมงเรียน<input type="number" min="0" max="2000" className="mt-2 w-full rounded-xl border p-3" value={editHours} onChange={e=>setEditHours(e.target.value)}/></label>
    </div>
    <button type="button" disabled={!canEdit||busy||usedSubjectIds.includes(editing.id)} onClick={saveEdit} className="mt-4 rounded-xl bg-blue-800 px-5 py-3 font-medium text-white disabled:opacity-40">{busy?'กำลังบันทึก...':'บันทึกการแก้ไข'}</button>
   </div>}
   <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
   <p>รวมแบบชั่วโมง/ปี: <strong>{selectedSubjects.filter(s=>s.hour_basis==='year').reduce((a,s)=>a+s.learning_hours,0)}</strong> ชั่วโมง/ปี</p>
   <p className="mt-1">รวมแบบชั่วโมง/ภาคเรียน: <strong>{selectedSubjects.filter(s=>s.hour_basis==='term').reduce((a,s)=>a+s.learning_hours,0)}</strong> ชั่วโมง/ภาคเรียน</p>
   {selectedSubjects.some(s=>!s.hour_basis)&&<p className="mt-2 font-semibold text-amber-700">มีรายวิชาเดิม {selectedSubjects.filter(s=>!s.hour_basis).length} รายวิชาที่ยังไม่ระบุช่วงเวลา กรุณาตรวจสอบ</p>}
   <p className="mt-2 text-xs text-slate-500">*หน่วยกิตระดับมัธยม (ยกเว้นกิจกรรม) คำนวณ 40 ชั่วโมงต่อ 1 หน่วยกิต ไม่รวมชั่วโมงต่อปีกับต่อภาคเรียนเข้าด้วยกัน</p>
   </div>
  </section>
 </div>}
 </main>;
}
