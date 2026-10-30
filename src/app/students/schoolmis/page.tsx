'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {buildSchoolmisPreview,normalizeStudentName,recognizeSchoolmisLevel,type HistoryEntry} from '@/lib/schoolmis-history';

type School={id:string;name_th:string};
type Membership={school_id:string;role:string;schools:School|null};
type Student={id:string;student_no:string;name_prefix_th:string|null;first_name_th:string;last_name_th:string};
type ImportBatch={id:string;file_name:string;reference_year_be:number;current_level_code:string;imported_rows:number;created_at:string};
type StudentNumberAlias={source_student_no:string;student_id:string};
type Grade={academic_year_be:number;level_code:string;term_no:number;subject_code:string;subject_name:string;subject_group:string;result_text:string;source_raw_value:string|null;grade_value:number|null;weight_units:number|null;weight_confirmed:boolean;is_activity:boolean};
type GroupGpa={area:string;records:number;pending:number;gpax:number|null};
const LEVELS=['ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3'];
export default function SchoolmisHistoryPage(){
 const router=useRouter();
 const [schools,setSchools]=useState<School[]>([]),[schoolId,setSchoolId]=useState('');
 const [students,setStudents]=useState<Student[]>([]),[studentAliases,setStudentAliases]=useState<StudentNumberAlias[]>([]);
 const [years,setYears]=useState<number[]>([]),[year,setYear]=useState(2569);
 const [fileName,setFileName]=useState(''),[raw,setRaw]=useState(''),[level,setLevel]=useState('');
 const [skipUnmatched,setSkipUnmatched]=useState(false),[backupVerified,setBackupVerified]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [batches,setBatches]=useState<ImportBatch[]>([]),[studentId,setStudentId]=useState('');
 const [grades,setGrades]=useState<Grade[]>([]),[gpax,setGpax]=useState<GroupGpa[]>([]);
 useEffect(()=>{let live=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db){setError('ไม่พบการเชื่อมต่อฐานข้อมูล');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const r=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
  if(!live)return;if(r.error){setError(r.error.message);return;}
  const allowed=((r.data??[]) as unknown as Membership[]).filter(m=>['school_admin','registrar'].includes(m.role)&&m.schools);
  const list=[...new Map(allowed.map(m=>[m.school_id,m.schools!])).values()];
  setSchools(list);setSchoolId(list[0]?.id??'');
 })();return()=>{live=false;};},[router]);
 async function reloadHistory(school:string){
  const db=getSupabaseBrowserClient();if(!db)return;
  const r=await db.from('schoolmis_history_imports').select('id,file_name,reference_year_be,current_level_code,imported_rows,created_at').eq('school_id',school).order('created_at',{ascending:false}).limit(20);
  if(r.error)throw Error(r.error.message);
  setBatches((r.data??[]) as ImportBatch[]);
 }
 useEffect(()=>{if(!schoolId)return;let live=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db)return;
  const [s,y,b,a]=await Promise.all([
   db.from('students').select('id,student_no,name_prefix_th,first_name_th,last_name_th').eq('school_id',schoolId).order('student_no'),
   db.from('academic_years').select('year_be').eq('school_id',schoolId).order('year_be',{ascending:false}),
   db.from('schoolmis_history_imports').select('id,file_name,reference_year_be,current_level_code,imported_rows,created_at').eq('school_id',schoolId).order('created_at',{ascending:false}).limit(20),
   db.from('schoolmis_student_number_aliases').select('source_student_no,student_id').eq('school_id',schoolId)
  ]);
  if(!live)return;
  const issue=[s.error,y.error,b.error,a.error].find(Boolean);if(issue){setError(issue.message);return;}
  setStudents((s.data??[]) as Student[]);
  setStudentAliases((a.data??[]) as StudentNumberAlias[]);
  setBatches((b.data??[]) as ImportBatch[]);
  const available=(y.data??[]).map(x=>x.year_be);
  setYears(available);setYear(available.includes(2569)?2569:available[0]??2569);
 })();return()=>{live=false;};},[schoolId]);
 const parsed=useMemo(()=>{
  if(!raw)return {preview:null,error:''};
  try{return {preview:buildSchoolmisPreview(raw,year,level),error:''};}
  catch(e){return {preview:null,error:e instanceof Error?e.message:'อ่านไฟล์ CSV ไม่สำเร็จ'};}
 },[raw,year,level]);
 const matched=useMemo(()=>{
  const byNo=new Map(students.map(s=>[s.student_no,s]));
  const byId=new Map(students.map(s=>[s.id,s]));
  const aliasMap=new Map(studentAliases.map(a=>[a.source_student_no,a.student_id]));
  const unmatched=new Map<string,string>(),aliasMatches=new Map<string,string>();
  const entries:HistoryEntry[]=[],seen=new Set<string>();
  for(const row of parsed.preview?.entries??[]){
   const person=byNo.get(row.student_no)??byId.get(aliasMap.get(row.student_no)??'');
   if(!person){unmatched.set(row.student_no,'ไม่พบรหัสนักเรียนในทะเบียน');continue;}
   const expected=normalizeStudentName([person.name_prefix_th??'',person.first_name_th,person.last_name_th].join(''));
   if(expected!==normalizeStudentName(row.student_name)){
    unmatched.set(row.student_no,'รหัสตรงแต่ชื่อ–สกุลไม่ตรง');continue;
   }
   if(person.student_no!==row.student_no)aliasMatches.set(row.student_no,person.student_no);
   entries.push({...row,student_id:person.id,source_student_no:row.student_no,student_no:person.student_no});seen.add(person.id);
  }
  return {entries,unmatched:[...unmatched.entries()],students:seen.size,aliasMatches:[...aliasMatches.entries()]};
 },[parsed.preview,students,studentAliases]);
 async function readFile(file:File){
  setRaw('');setError('');setNotice('');setSkipUnmatched(false);setBackupVerified(false);
  setFileName(file.name);setLevel(recognizeSchoolmisLevel(file.name));
  if(!/\.csv$/i.test(file.name)){setError('เลือกไฟล์ SchoolMIS นามสกุล .csv เท่านั้น');return;}
  if(file.size>2*1024*1024){setError('ไฟล์มีขนาดเกิน 2 MB');return;}
  try{setRaw(await file.text());}catch{setError('อ่านไฟล์ไม่สำเร็จ');}
 }
 async function commit(){
  const preview=parsed.preview;
  if(!schoolId||!preview||!level||busy||!backupVerified||!matched.entries.length||preview.issues.length||(!skipUnmatched&&matched.unmatched.length))return;
  if(!window.confirm('ยืนยันบันทึกประวัติผลการเรียนย้อนหลัง '+matched.entries.length+' รายการ?\nระบบไม่แก้คะแนนปัจจุบันและไม่เขียนทับผลย้อนหลังที่ต่างจากเดิม และเกรด 0 จะถูกนำเข้าตาม SchoolMIS'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล');
   const payload=matched.entries.map(r=>({
    student_id:r.student_id,student_no:r.student_no,source_student_no:r.source_student_no??r.student_no,academic_year_be:r.academic_year_be,
    level_code:r.level_code,grade_number:r.grade_number,term_no:r.term_no,
    subject_key:r.subject_key,subject_code:r.subject_code,subject_name:r.subject_name,
    source_column:r.source_column,result_text:r.result_text,source_raw_value:r.result_text,grade_value:r.grade_value,is_activity:r.is_activity
   }));
   const res=await db.rpc('schoolmis_import_history',{
    p_school:schoolId,p_reference_year_be:year,p_current_level:level,p_file_name:fileName,p_rows:payload
   });
   if(res.error)throw Error(res.error.message);
   const outcome=res.data as {imported:number;unchanged:number};
   setNotice('นำเข้าสำเร็จ '+outcome.imported+' รายการ · ข้อมูลเดิมที่ไม่เปลี่ยน '+outcome.unchanged+' รายการ');
   setRaw('');setFileName('');
   await reloadHistory(schoolId);
  }catch(e){setError(e instanceof Error?e.message:'บันทึกผลย้อนหลังไม่สำเร็จ');}
  finally{setBusy(false);}
 }
 useEffect(()=>{if(!studentId||!schoolId){setGrades([]);setGpax([]);return;}let live=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db)return;
  const [r,g]=await Promise.all([
   db.from('schoolmis_grade_history').select('academic_year_be,level_code,term_no,subject_code,subject_name,subject_group,result_text,source_raw_value,grade_value,weight_units,weight_confirmed,is_activity')
    .eq('school_id',schoolId).eq('student_id',studentId).order('academic_year_be').order('term_no').order('subject_code'),
   db.rpc('schoolmis_student_historical_gpax',{p_school:schoolId,p_student:studentId})
  ]);
  if(!live)return;
  if(r.error||g.error){setError(r.error?.message??g.error?.message??'โหลดประวัติไม่สำเร็จ');return;}
  setGrades((r.data??[]) as Grade[]);setGpax((g.data??[]) as GroupGpa[]);
 })();return()=>{live=false;};},[studentId,schoolId,notice]);

 return <main className="wichakan-page mx-auto max-w-6xl px-4 py-6">
  <Link href="/students" className="text-sm font-semibold text-blue-700">← ทะเบียนนักเรียน</Link>
  <PageHeader title="นำเข้าประวัติผลการเรียน SchoolMIS"/>
  <p className="mb-5 text-sm text-slate-600">สำหรับผู้ดูแลทะเบียนและวัดผล · นำเข้าข้อมูลย้อนหลังเท่านั้น ไม่แก้ไขคะแนนรายวิชาที่ครูบันทึกใน WICHAKAN</p>
  <p role="note" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">ก่อนยืนยันนำเข้าข้อมูลจริง ตรวจสอบว่ามีสำเนาสำรองฐานข้อมูลและไฟล์ที่สามารถกู้คืนได้แล้ว · <a href="https://supabase.com/docs/guides/platform/backups" target="_blank" rel="noreferrer" className="underline">แนวทางสำรองข้อมูล Supabase</a> · <Link href="/students/transcript" className="underline">แฟ้มประวัตินักเรียน</Link> · <Link href="/students/schoolmis/gpa" className="underline">GPA / GPAX รายห้อง</Link> · <Link href="/students/schoolmis/weights" className="underline">หน่วยน้ำหนักย้อนหลัง</Link></p>
  {!schools.length&&<p className="teacher-error">ต้องมีสิทธิ์ผู้ดูแลระบบหรือทะเบียนจึงจะใช้เมนูนี้ได้</p>}
  <section className="ui-panel p-5">
   <div className="grid gap-4 md:grid-cols-3">
    <label className="text-sm font-semibold">โรงเรียน
     <select value={schoolId} onChange={e=>{setSchoolId(e.target.value);setRaw('');setStudentId('');}} className="mt-2 block w-full rounded-lg border p-2">
      {schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}
     </select>
    </label>
    <label className="text-sm font-semibold">ปีที่ส่งออกจาก SchoolMIS
     <select value={year} className="mt-2 block w-full rounded-lg border p-2" onChange={e=>setYear(Number(e.target.value))}>
      {years.map(y=><option key={y} value={y}>{y}</option>)}
     </select>
    </label>
    <label className="text-sm font-semibold">ระดับชั้นในไฟล์
     <select value={level} className="mt-2 block w-full rounded-lg border p-2" onChange={e=>setLevel(e.target.value)}>
      <option value="">เลือกระดับชั้น</option>{LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
     </select>
    </label>
   </div>
   <label className="mt-4 block text-sm font-semibold">ไฟล์คะแนนจาก SchoolMIS (.csv)
    <input type="file" accept=".csv,text/csv" disabled={!schoolId||busy} onChange={e=>{const f=e.target.files?.[0];if(f)void readFile(f);e.target.value='';}} className="mt-2 block w-full rounded-lg border border-dashed p-3 text-sm"/>
   </label>
   <p className="mt-2 text-xs text-slate-600">ปีการศึกษาที่ปรากฏในไฟล์จะคำนวณย้อนจากชั้นปัจจุบันของไฟล์ · ข้อมูลปีปัจจุบันไม่ถูกนำเข้า · ไม่อัปโหลดไฟล์ดิบไปจัดเก็บ</p>
  </section>
  {(error||parsed.error)&&<p role="alert" className="teacher-error mt-4">{error||parsed.error}</p>}
  {notice&&<p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  {parsed.preview&&<section className="ui-panel mt-4 p-5">
   <h2 className="text-lg font-bold">ตรวจสอบก่อนนำเข้า · {fileName}</h2>
   <div className="mt-3 grid gap-2 sm:grid-cols-4">
    {[
     ['นักเรียนในไฟล์',parsed.preview.studentCount+' คน'],
     ['รายวิชาย้อนหลัง',parsed.preview.historicalGradeCount+' รายการ'],
     ['ผลกิจกรรมย้อนหลัง',parsed.preview.activityCount+' รายการ'],
     ['จับคู่ทะเบียนสำเร็จ',matched.students+' คน']
    ].map(([name,value])=><div className="rounded-lg bg-slate-50 p-3" key={name}><p className="text-xs text-slate-500">{name}</p><strong>{value}</strong></div>)}
   </div>
   <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
    <p>เกรด 0 ที่นำเข้าตาม SchoolMIS: <b>{parsed.preview.zeroGradeCount}</b> รายการ · ช่องรายวิชาย้อนหลังที่ยังไม่มีผล: {parsed.preview.missingGradeCount} · ผลปีปัจจุบันที่ข้าม: {parsed.preview.currentSkipped} · ผลที่ไม่รู้จัก: {parsed.preview.unknownResults}</p>
    <p className="mt-2 text-xs">ระบบยึดเกรด 0 จาก SchoolMIS เป็นผลการเรียนจริงโดยอัตโนมัติ ตามหลักการที่สถานศึกษายืนยันแล้ว</p>
   </div>
   {parsed.preview.issues.length>0&&<div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"><strong>ปัญหาโครงสร้างไฟล์ ({parsed.preview.issues.length}) — ต้องแก้ก่อนนำเข้า</strong><ul className="mt-2 list-inside list-disc">{parsed.preview.issues.slice(0,12).map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
   {matched.aliasMatches.length>0&&<div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
    <strong>จับคู่รหัส SchoolMIS ที่ต่างจากรหัส WICHAKAN ตามข้อมูลที่ตรวจสอบแล้ว</strong>
    {matched.aliasMatches.map(([source,canonical])=><p key={source}>รหัสในไฟล์ {source} → รหัสนักเรียน WICHAKAN {canonical}</p>)}
    <p className="mt-1 text-xs">ระบบยังตรวจชื่อ–สกุลทุกครั้งและเก็บรหัสต้นฉบับไว้ในประวัติการนำเข้า</p>
   </div>}
   {matched.unmatched.length>0&&<div role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
    <strong>มีนักเรียนที่จับคู่ไม่ได้ {matched.unmatched.length} คน</strong>
    <div className="mt-2 max-h-32 overflow-y-auto">{matched.unmatched.slice(0,20).map(([number,reason])=><p key={number}>รหัส {number} · {reason}</p>)}</div>
    <label className="mt-2 flex gap-2"><input type="checkbox" checked={skipUnmatched} onChange={e=>setSkipUnmatched(e.target.checked)}/>ยืนยันข้ามเฉพาะนักเรียนที่จับคู่ไม่ได้ (ไม่สร้างนักเรียนใหม่)</label>
   </div>}
   <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={backupVerified} onChange={e=>setBackupVerified(e.target.checked)}/><span>ข้าพเจ้าได้ตรวจสอบด้วยตนเองแล้วว่ามีสำเนาสำรองฐานข้อมูล WICHAKAN ที่กู้คืนได้ และมีสำเนาไฟล์ Storage ที่เกี่ยวข้อง ก่อนนำเข้าผลการเรียนจริง (ระบบไม่สามารถตรวจสถานะการสำรองใน Supabase Dashboard ให้โดยอัตโนมัติ)</span></label>
   <p className="mt-3 text-sm">พร้อมนำเข้า <b>{matched.entries.length}</b> รายการ (รวมช่องรายวิชาที่ยังไม่มีผลเพื่อป้องกัน GPAX ผิดพลาด) · ระบบตรวจรายการที่มีอยู่แล้วและจะไม่เขียนทับผลที่ต่างกัน</p>
   <button className="ui-primary mt-3" disabled={busy||!backupVerified||!matched.entries.length||parsed.preview.issues.length>0||(matched.unmatched.length>0&&!skipUnmatched)} onClick={()=>void commit()}>{busy?'กำลังบันทึก...':'ยืนยันนำเข้าประวัติย้อนหลัง'}</button>
  </section>}
  <section className="ui-panel mt-4 p-5">
   <h2 className="text-lg font-bold">ประวัติการนำเข้า</h2>
   {!batches.length?<p className="mt-2 text-sm text-slate-500">ยังไม่มีประวัตินำเข้า SchoolMIS</p>:<div className="mt-2 overflow-x-auto"><table className="w-full text-sm">
    <thead><tr><th className="p-2 text-left">ไฟล์</th><th>ปีอ้างอิง</th><th>ระดับ</th><th>ใหม่</th><th>วันที่บันทึก</th></tr></thead>
    <tbody>{batches.map(b=><tr className="border-t" key={b.id}><td className="p-2">{b.file_name}</td><td className="text-center">{b.reference_year_be}</td><td className="text-center">{b.current_level_code}</td><td className="text-center">{b.imported_rows}</td><td className="text-center">{new Date(b.created_at).toLocaleDateString('th-TH')}</td></tr>)}</tbody>
   </table></div>}
  </section>
  <section className="ui-panel mt-4 p-5">
   <h2 className="text-lg font-bold">ตรวจสอบข้อมูลย้อนหลังที่นำเข้าแล้ว</h2>
   <p className="mt-1 text-xs text-slate-600">แสดงเฉพาะข้อมูลที่นำเข้าจาก SchoolMIS ไม่รวมผลปีปัจจุบัน · ค่าเฉลี่ยจากข้อมูลย้อนหลังที่นำเข้าเป็นเพียงผลเบื้องต้น ยังไม่ใช่ GPAX ตลอดช่วงชั้น · ตรวจสอบในแฟ้มประวัติสะสมก่อนรับรอง</p>
   <label className="mt-3 block text-sm">เลือกนักเรียน
    <select className="mt-1 block w-full max-w-lg rounded-lg border p-2" value={studentId} onChange={e=>setStudentId(e.target.value)}>
     <option value="">เลือกนักเรียน</option>{students.map(s=><option key={s.id} value={s.id}>{s.student_no} {s.name_prefix_th??''}{s.first_name_th} {s.last_name_th}</option>)}
    </select>
   </label>
   {studentId&&<>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">{gpax.map(g=><div key={g.area} className="rounded-lg bg-slate-50 p-3">
     <p className="text-xs text-slate-500">{g.area}</p>
     <strong className="text-xl">{g.gpax===null?'—':Number(g.gpax).toFixed(2)}</strong>
     <p className="text-xs text-slate-500">{g.pending?g.pending+' วิชายังไม่พร้อมคำนวณ':'น้ำหนักครบ'} · {g.records} วิชา</p>
    </div>)}</div>
    {grades.length===0?<p className="mt-3 text-sm text-slate-500">ยังไม่มีประวัติผลการเรียนย้อนหลังของนักเรียนคนนี้</p>:
     <div className="mt-3 max-h-72 overflow-auto"><table className="w-full min-w-[700px] text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th>ปี</th><th>ชั้น</th><th>ภาค</th><th>รายวิชา</th><th>ผล</th><th>หน่วยน้ำหนัก</th></tr></thead>
      <tbody>{grades.map((g,i)=><tr className="border-t" key={i}><td className="p-2 text-center">{g.academic_year_be}</td><td>{g.level_code}</td><td className="text-center">{g.term_no||'รายปี'}</td><td>{g.subject_code} {g.subject_name}</td><td className="text-center">{g.result_text|| (g.source_raw_value==='0'?'0 (รอตรวจสอบ)':'—')}</td><td className="text-center">{g.is_activity?'—':g.weight_confirmed?g.weight_units:'ยังไม่ยืนยัน'}</td></tr>)}</tbody>
     </table></div>}
    <div className="mt-4 flex flex-wrap gap-3">
      <Link href="/students/schoolmis/weights" className="text-sm font-semibold text-blue-700 underline">ตรวจสอบหน่วยน้ำหนักย้อนหลังทั้งโรงเรียน</Link>
      <Link href="/students/transcript" className="text-sm font-semibold text-blue-700 underline">แฟ้มประวัติผลการเรียนสะสม</Link>
     </div>
   </>}
  </section>
 </main>;
}
