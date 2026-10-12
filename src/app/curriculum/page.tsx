'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type School={id:string;name_th:string};
type Curriculum={id:string;name_th:string};
type Version={id:string;curriculum_id:string;version_label:string;effective_year_be:number};
type Subject={id:string;curriculum_version_id:string;subject_code:string;name_th:string;learning_hours:number;category:string;grade_level:string|null};
export default function CurriculumPage(){
 const router=useRouter();const db=getSupabaseBrowserClient();
 const [schools,setSchools]=useState<School[]>([]),[schoolId,setSchoolId]=useState('');
 const [canEdit,setCanEdit]=useState(false),[loading,setLoading]=useState(true);
 const [curricula,setCurricula]=useState<Curriculum[]>([]),[versions,setVersions]=useState<Version[]>([]),[subjects,setSubjects]=useState<Subject[]>([]);
 const [curriculumId,setCurriculumId]=useState(''),[versionId,setVersionId]=useState('');
 const [name,setName]=useState(''),[versionName,setVersionName]=useState(''),[effectiveYear,setEffectiveYear]=useState('2569');
 const [gradeLevel,setGradeLevel]=useState('ป.1'),[filterGrade,setFilterGrade]=useState('ป.1');
 const gradeLevels=['ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'];
 const [subjectCode,setSubjectCode]=useState(''),[subjectName,setSubjectName]=useState(''),[hours,setHours]=useState('40'),[category,setCategory]=useState('basic');
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
  const [c,v,s,m]=await Promise.all([
   db.from('curricula').select('id,name_th').eq('school_id',schoolId).order('name_th'),
   db.from('curriculum_versions').select('id,curriculum_id,version_label,effective_year_be').eq('school_id',schoolId),
   db.from('subjects').select('id,curriculum_version_id,subject_code,name_th,learning_hours,category,grade_level').eq('school_id',schoolId),
   db.from('school_memberships').select('role').eq('school_id',schoolId).eq('user_id',user.id).eq('active',true)
  ]);
  if(!mounted)return;const e=[c.error,v.error,s.error,m.error].find(Boolean);
  if(e){setError(e.message);return;}
  setCurricula(c.data??[]);setVersions(v.data??[]);setSubjects(s.data??[]);
  setCanEdit((m.data??[]).some(x=>['school_admin','academic'].includes(x.role)));
  setCurriculumId(old=>(c.data??[]).some(x=>x.id===old)?old:c.data?.[0]?.id??'');
 })();return()=>{mounted=false;};},[db,schoolId,notice]);
 const filteredVersions=versions.filter(v=>v.curriculum_id===curriculumId);
 const selectedVersion=filteredVersions.some(v=>v.id===versionId)?versionId:filteredVersions[0]?.id??'';
 const selectedSubjects=subjects.filter(s=>s.curriculum_version_id===selectedVersion&&s.grade_level===filterGrade);
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
   <div className="mt-4 grid gap-3 md:grid-cols-4">
    <label className="text-sm">ระดับชั้น<select value={gradeLevel} onChange={e=>setGradeLevel(e.target.value)} className="mt-2 w-full rounded-xl border p-3">{gradeLevels.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
    <label className="text-sm">รหัสวิชา<input className="mt-2 w-full rounded-xl border p-3" value={subjectCode} onChange={e=>setSubjectCode(e.target.value)}/></label>
    <label className="text-sm md:col-span-2">ชื่อรายวิชา<input className="mt-2 w-full rounded-xl border p-3" value={subjectName} onChange={e=>setSubjectName(e.target.value)}/></label>
    <label className="text-sm">ชั่วโมงเรียน<input type="number" min="0" max="2000" className="mt-2 w-full rounded-xl border p-3" value={hours} onChange={e=>setHours(e.target.value)}/></label>
    <label className="text-sm">ประเภท<select className="mt-2 w-full rounded-xl border p-3" value={category} onChange={e=>setCategory(e.target.value)}><option value="basic">พื้นฐาน</option><option value="additional">เพิ่มเติม</option><option value="activity">กิจกรรม</option></select></label>
   </div>
   <button disabled={!canEdit||busy||!selectedVersion||!subjectCode.trim()||!subjectName.trim()||Number(hours)<0||Number(hours)>2000} className="mt-4 rounded-xl bg-blue-800 px-5 py-3 text-sm text-white disabled:opacity-40" onClick={()=>save(()=>db!.from('subjects').insert({school_id:schoolId,curriculum_version_id:selectedVersion,subject_code:subjectCode.trim(),name_th:subjectName.trim(),learning_hours:Number(hours),category,grade_level:gradeLevel}),'เพิ่มรายวิชาแล้ว')}>เพิ่มรายวิชา</button>
   <label className="mt-6 block text-sm font-medium">แสดงรายวิชาของระดับชั้น<select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} className="mt-2 w-full rounded-xl border p-3">{gradeLevels.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
   <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">รหัสวิชา</th><th>รายวิชา</th><th>ประเภท</th><th className="text-right">ชั่วโมง</th></tr></thead><tbody>{selectedSubjects.map(s=><tr className="border-b" key={s.id}><td className="py-3">{s.subject_code}</td><td>{s.name_th}</td><td>{s.category==='basic'?'พื้นฐาน':s.category==='additional'?'เพิ่มเติม':'กิจกรรม'}</td><td className="text-right">{s.learning_hours}</td></tr>)}</tbody></table></div>
   <p className="mt-4 text-sm text-slate-500">รวมชั่วโมงระดับชั้น {filterGrade}: {selectedSubjects.reduce((a,s)=>a+s.learning_hours,0)} ชั่วโมง (รวมเฉพาะรายวิชาของฉบับที่เลือก)</p>
  </section>
 </div>}
 </main>;
}
