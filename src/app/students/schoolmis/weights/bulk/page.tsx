'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {parseSchoolmisCsv} from '@/lib/schoolmis-history';
import {creditSuggestion,type CurriculumCreditSubject,type CurriculumCreditVersion} from '@/lib/schoolmis-credit-suggestions';
type School={id:string;name_th:string};
type Membership={school_id:string;role:string;schools:School|null};
type WeightRow={year:number;level:string;term:number;subject_code:string;name:string;weight:number|null;last_verification:string|null};
type Entry={year:number;level:string;term:number;subject_code:string;weight:number;evidence:string};
const key=(r:{year:number;level:string;term:number;subject_code:string})=>[r.year,r.level,r.term,r.subject_code].join('|');
const quote=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
export default function BulkWeights(){
 const router=useRouter();
 const [schoolId,setSchoolId]=useState(''),[schools,setSchools]=useState<School[]>([]);
 const [rows,setRows]=useState<WeightRow[]>([]),[entries,setEntries]=useState<Entry[]>([]);
 const [creditSubjects,setCreditSubjects]=useState<CurriculumCreditSubject[]>([]);
 const [creditVersions,setCreditVersions]=useState<CurriculumCreditVersion[]>([]);
 const [year,setYear]=useState(''),[fileName,setFileName]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let alive=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db){setError('ไม่พบการเชื่อมต่อฐานข้อมูล');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const r=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
  if(!alive)return;if(r.error){setError(r.error.message);return;}
  const list=[...new Map(((r.data??[]) as unknown as Membership[])
   .filter(m=>['school_admin','registrar'].includes(m.role)&&m.schools).map(m=>[m.school_id,m.schools!])).values()];
  setSchools(list);setSchoolId(list[0]?.id??'');
 })();return()=>{alive=false;};},[router]);
 useEffect(()=>{if(!schoolId)return;let live=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db)return;
  const [r,s,v]=await Promise.all([
   db.rpc('schoolmis_review_weights',{p_school:schoolId}),
   db.from('subjects').select('subject_code,grade_level,name_th,learning_hours,hour_basis,curriculum_version_id').eq('school_id',schoolId),
   db.from('curriculum_versions').select('id,version_label,effective_year_be').eq('school_id',schoolId)
  ]);
  if(live){
   if(r.error||s.error||v.error)setError((r.error||s.error||v.error)!.message);
   else{
    setRows((r.data??[]) as WeightRow[]);
    setCreditSubjects((s.data??[]) as CurriculumCreditSubject[]);
    setCreditVersions((v.data??[]) as CurriculumCreditVersion[]);
   }
  }
 })();return()=>{live=false;};},[schoolId,notice]);
 const source=rows.filter(r=>!year||r.year===Number(year));
 const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>b-a);
 const suggestionFor=(r:WeightRow)=>creditSuggestion({...r,name:r.name},creditSubjects,creditVersions);
 const suggestedCount=source.filter(r=>suggestionFor(r)!==null).length;
 function downloadTemplate(){
  const head=['year','level','term','subject_code','subject_name','weight','evidence'];
  const content=source.map(r=>[r.year,r.level,r.term,r.subject_code,r.name,r.weight??suggestionFor(r)?.credit??'',r.last_verification??''].map(quote).join(','));
  const blob=new Blob(['\uFEFF',[head.join(','),...content].join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='schoolmis-historical-weight-review.csv';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function readFile(file:File){
  setError('');setNotice('');setEntries([]);setFileName(file.name);
  try{
   if(!/\.csv$/i.test(file.name)||file.size>500*1024)throw Error('เลือกไฟล์ CSV ขนาดไม่เกิน 500 KB');
   const matrix=parseSchoolmisCsv(await file.text());
   const head=['year','level','term','subject_code','subject_name','weight','evidence'];
   if(matrix[0]?.join('|')!==head.join('|'))throw Error('รูปแบบคอลัมน์ไม่ตรงกับไฟล์แม่แบบที่ระบบส่งออก');
   const known=new Set(rows.map(key)),seen=new Set<string>(),valid:Entry[]=[];
   for(const [i,r] of matrix.slice(1).entries()){
    if(r.length!==7)throw Error('แถว '+(i+2)+': จำนวนคอลัมน์ไม่ครบ');
    const [y,l,t,code,_name,w,evidence]=r.map(x=>x.trim());
    if(!w&&!evidence)continue;
    const item={year:Number(y),level:l,term:Number(t),subject_code:code,weight:Number(w),evidence};
    if(!known.has(key(item)))throw Error('แถว '+(i+2)+': ไม่พบรายวิชาในข้อมูลย้อนหลัง');
    if(seen.has(key(item)))throw Error('แถว '+(i+2)+': รายวิชาซ้ำ');
    seen.add(key(item));
    if(!w||!evidence||!/^[0-9]+([.][0-9]{1,2})?$/.test(w)
     ||item.weight<=0||item.weight>30||evidence.length<10||evidence.length>500)
     throw Error('แถว '+(i+2)+': กรุณาใส่หน่วยน้ำหนักและหลักฐานที่ถูกต้อง (อย่างน้อย 10 ตัวอักษร)');
    valid.push(item);
   }
   if(valid.length<1||valid.length>250)throw Error('ต้องมีข้อมูลที่ตรวจสอบแล้ว 1–250 รายวิชา');
   setEntries(valid);
  }catch(e){setError(e instanceof Error?e.message:'อ่านไฟล์ไม่สำเร็จ');}
 }
 async function confirm(){
  if(!entries.length||busy||!schoolId)return;
  if(!window.confirm('ยืนยันการตรวจหน่วยน้ำหนักย้อนหลัง '+entries.length+' รายวิชา? ข้อมูลต้องมาจากหลักสูตรฉบับที่ใช้จริง'))return;
  const db=getSupabaseBrowserClient();if(!db)return;
  setBusy(true);setError('');setNotice('');
  try{
   const r=await db.rpc('schoolmis_verify_weights_batch',{p_school:schoolId,p_rows:entries});
   if(r.error)throw Error(r.error.message);
   const result=r.data as {subjects:number;student_rows:number};
   setNotice('บันทึกหลักฐานสำเร็จ '+result.subjects+' รายวิชา · ปรับข้อมูล '+result.student_rows+' รายการ');
   setEntries([]);setFileName('');
  }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}
  finally{setBusy(false);}
 }
 return <main className="wichakan-page mx-auto max-w-5xl px-4 py-6">
  <Link href="/students/schoolmis/weights" className="text-sm font-semibold text-blue-700">← ตรวจสอบหน่วยน้ำหนัก</Link>
  <PageHeader title="ตรวจหน่วยน้ำหนักย้อนหลังแบบหลายรายวิชา"/>
  <p className="mb-4 text-sm text-slate-600">ระบบเติมช่อง weight จากชั่วโมงรายวิชาที่มีอยู่ในหลักสูตร WICHAKAN ให้อัตโนมัติ (ชั่วโมง ÷ 40) เพื่อไม่ต้องกรอกหน่วยกิตซ้ำ แต่ยังต้องกรอกช่อง evidence จากหลักสูตรปีที่เรียนจริงก่อนยืนยัน</p>
  <section className="ui-panel p-5">
   <div className="flex flex-wrap gap-4">
    <label className="text-sm">โรงเรียน<select className="mt-1 block w-full rounded-lg border p-2" value={schoolId} onChange={e=>{setSchoolId(e.target.value);setEntries([]);}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>
    <label className="text-sm">ปีการศึกษา<select className="mt-1 block w-full rounded-lg border p-2" value={year} onChange={e=>setYear(e.target.value)}><option value="">ทุกปี</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   </div>
   <button type="button" className="ui-secondary mt-4" disabled={!source.length||busy} onClick={downloadTemplate}>ดาวน์โหลดแม่แบบ CSV · {source.length} รายวิชา · แนะนำหน่วยกิต {suggestedCount} รายวิชา</button>
   <label className="mt-4 block text-sm font-semibold">นำเข้าตารางที่ตรวจสอบหลักฐานเรียบร้อยแล้ว
    <input type="file" accept=".csv,text/csv" className="mt-2 block w-full rounded-lg border p-3 text-sm" disabled={busy||!schoolId} onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file);e.target.value='';}}/>
   </label>
   <p className="mt-2 text-xs text-amber-800">คำเตือน: รายวิชาย้อนหลัง ม.1 (2567) และ ม.2 (2568) จับคู่ได้กับหลักสูตรปี 2569 เท่านั้น การเสนอหน่วยกิตไม่ใช่การยืนยันว่าหลักสูตรปีเก่าเหมือนปี 2569 ต้องตรวจสอบชื่อรายวิชาที่เปลี่ยนและหลักฐานปีที่เรียนจริง โดยเฉพาะ ท22201 การพูด</p>
   <p className="mt-2 text-xs text-slate-500">ยังไม่บันทึกหน่วยกิตจนกว่าจะนำเข้าตารางพร้อมกรอก evidence และกดยืนยัน (เก็บผู้ยืนยันและหลักฐานทุกครั้ง)</p>
  </section>
  {error&&<p role="alert" className="teacher-error mt-3">{error}</p>}
  {notice&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
  {entries.length>0&&<section className="ui-panel mt-4 p-4"><h2 className="font-bold">ตรวจสอบก่อนบันทึก · {fileName}</h2>
   <p className="mt-2 text-sm">พบข้อมูลที่กรอกครบ <strong>{entries.length}</strong> รายวิชา · บันทึกแบบธุรกรรมเดียว หากพบข้อผิดพลาดจะไม่มีการบันทึกบางส่วน</p>
   <div className="mt-3 max-h-64 overflow-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr><th className="p-2">ปี/ชั้น</th><th>รหัสวิชา</th><th>น้ำหนัก</th><th>หลักฐาน</th></tr></thead><tbody>{entries.slice(0,50).map(r=><tr key={key(r)} className="border-t"><td className="p-2">{r.year} {r.level} {r.term?'ภาค '+r.term:''}</td><td>{r.subject_code}</td><td>{r.weight}</td><td>{r.evidence}</td></tr>)}</tbody></table></div>
   <button className="ui-primary mt-4" disabled={busy} onClick={()=>void confirm()}>{busy?'กำลังบันทึก...':'ยืนยันหน่วยน้ำหนัก '+entries.length+' รายวิชา'}</button>
  </section>}
 </main>;
}
