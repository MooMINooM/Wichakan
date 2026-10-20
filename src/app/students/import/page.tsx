'use client';
import PageHeader from '@/components/page-header';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {resolveYear} from '@/lib/academic-year-selection';

type School={id:string;name_th:string;code:string|null};
type Year={id:string;year_be:number;is_active:boolean};
type Item={name_prefix_th:string|null;student_no:string;first_name_th:string;last_name_th:string;level_code:string;room_code:string;row_number:number;citizen_id?:string};
type ImportResult={updated_prefixes:number;new_students:number;existing_students:number;new_rooms:number;new_enrollments:number;conflicts:number;details:{row:number;student_no:string;reason:string}[]};
const grades=['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3'];
const value=(v:unknown)=>String(v??'').trim();
export default function DmcImportPage(){
 const router=useRouter();
 const [schools,setSchools]=useState<School[]>([]),[schoolId,setSchoolId]=useState('');
 const [years,setYears]=useState<Year[]>([]),[yearId,setYearId]=useState('');
 const [rows,setRows]=useState<Item[]>([]),[schoolCode,setSchoolCode]=useState('');
 const [hasCitizenColumn,setHasCitizenColumn]=useState(false),[citizenResult,setCitizenResult]=useState<{updated:number;unmatched:number}|null>(null),[citizenProgress,setCitizenProgress]=useState('');
 const [fileName,setFileName]=useState(''),[problems,setProblems]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<ImportResult|null>(null);
 useEffect(()=>{let active=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db){setError('ไม่ได้เชื่อมต่อ Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const {data,error:e}=await db.from('school_memberships').select('school_id,role,schools(id,name_th,code)').eq('user_id',user.id).eq('active',true);
  if(!active)return;if(e){setError(e.message);return;}
  const list=[...new Map((data??[]).filter(m=>['school_admin','registrar'].includes(m.role)&&m.schools).map(m=>[m.school_id,m.schools as unknown as School])).values()];
  setSchools(list);setSchoolId(list[0]?.id??'');
 })();return()=>{active=false;};},[router]);
 useEffect(()=>{let active=true;(async()=>{
  if(!schoolId)return;
  const db=getSupabaseBrowserClient();if(!db)return;
  const {data,error:e}=await db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('year_be',{ascending:false});
  if(!active)return;if(e){setError(e.message);return;}
  setYears(data??[]);setYearId(resolveYear(data??[],schoolId));
 })();return()=>{active=false;};},[schoolId]);
 const selectedSchool=schools.find(s=>s.id===schoolId),selectedYear=years.find(y=>y.id===yearId);
 const roomCounts=useMemo(()=>{const counts=new Map<string,number>();for(const r of rows){const name=r.level_code+'/'+r.room_code;counts.set(name,(counts.get(name)??0)+1);}return [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0],'th'));},[rows]);
 async function parseFile(file:File){
  setError('');setResult(null);setProblems([]);setRows([]);setCitizenProgress('');setSchoolCode('');setFileName(file.name);setHasCitizenColumn(false);setCitizenResult(null);
  if(!/\.xlsx?$/i.test(file.name)){setError('กรุณาเลือกไฟล์ Excel จาก DMC (.xlsx หรือ .xls)');return;}
  if(file.size>8*1024*1024){setError('ไฟล์ใหญ่เกิน 8 MB');return;}
  setBusy(true);
  try{
   const XLSX=await import('xlsx');
   const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false,cellFormula:false});
   const sheet=wb.Sheets[wb.SheetNames[0]];
   if(!sheet)throw new Error('ไม่พบแผ่นงานในไฟล์');
   const matrix=(XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:false}) as unknown[][]);
   const headerAt=matrix.findIndex(r=>value(r[0])==='รหัสโรงเรียน'&&value(r[3])==='ชั้น'&&value(r[4])==='ห้อง'&&value(r[5])==='เลขประจำตัวนักเรียน');
   if(headerAt<0||value(matrix[headerAt][8])!=='ชื่อ'||value(matrix[headerAt][9])!=='นามสกุล')throw new Error('ไม่พบคอลัมน์ DMC ตามรูปแบบตัวอย่าง กรุณาใช้ไฟล์ส่งออกจาก DMC');
   // DMC exports can label BOTH column C (13-digit citizen ID) and column F
   // (school student number) as "เลขประจำตัวนักเรียน". Never use column F as a citizen ID.
   const header=matrix[headerAt].map(v=>value(v).replace(/\\s/g,''));
   const explicitCitizenIndex=header.findIndex(v=>['เลขประจำตัวประชาชน','เลขบัตรประชาชน','เลขประจำตัวประชาชน13หลัก'].includes(v));
   const dmcCitizenCol=header[2]==='เลขประจำตัวนักเรียน'&&header[5]==='เลขประจำตัวนักเรียน';
   const citizenIndex=explicitCitizenIndex>=0?explicitCitizenIndex:dmcCitizenCol?2:-1;
   setHasCitizenColumn(citizenIndex>=0);
   const prefixIndex=matrix[headerAt].findIndex(v=>['คำนำหน้าชื่อ','คำนำหน้า','ชื่อคำนำหน้า'].includes(value(v).replace(/\s/g,'')));
   const items:Item[]=[],issues:string[]=[],numbers=new Set<string>(),codes=new Set<string>();
   for(let i=headerAt+1;i<matrix.length;i++){
    const r=matrix[i];if(!r||r.every(v=>!value(v)))continue;
    const code=value(r[0]),no=value(r[5]),level=value(r[3]).replace(/\s/g,''),room=value(r[4]);
    const first=value(r[8]),last=value(r[9]),line=i+1;
    const prefix=prefixIndex>=0?value(r[prefixIndex]):'';
    const citizen=citizenIndex>=0?value(r[citizenIndex]).replace(/[-\s]/g,''):'';
    if(citizenIndex>=0&&!/^[0-9]{13}$/.test(citizen)){issues.push('แถว '+line+': เลขประจำตัวประชาชนต้องมี 13 หลัก');continue;}
    if(prefix&&!['เด็กชาย','เด็กหญิง','นาย','นางสาว','นาง'].includes(prefix)){issues.push('แถว '+line+': คำนำหน้าชื่อไม่อยู่ในรายการที่รองรับ');continue;}
    codes.add(code);
    if(!no||!first||!last||!grades.includes(level)||!room||room.length>12||!/^[-\wก-๙./]+$/u.test(room)){
      issues.push('แถว '+line+': ข้อมูลรหัสนักเรียน ชื่อ ชั้น หรือห้องไม่ถูกต้อง');continue;
    }
    if(numbers.has(no)){issues.push('แถว '+line+': รหัสนักเรียนซ้ำในไฟล์');continue;}
    numbers.add(no);
    items.push({name_prefix_th:prefix||null,student_no:no,first_name_th:first,last_name_th:last,level_code:level,room_code:room,row_number:line,...(citizenIndex>=0?{citizen_id:citizen}:{})});
   }
   if(codes.size!==1||!codes.has([...codes][0])||!([...codes][0]||'').trim())issues.push('ไฟล์มีรหัสโรงเรียนไม่ตรงกันหรือว่าง');
   if(selectedSchool?.code&&codes.size===1&&selectedSchool.code!==[...codes][0])issues.push('รหัสโรงเรียนใน DMC ไม่ตรงกับโรงเรียนที่เลือก');
   if(items.length===0)issues.push('ไม่พบข้อมูลนักเรียนที่นำเข้าได้');
   if(items.length>1000)issues.push('ไฟล์มีมากกว่า 1,000 รายการ กรุณาแบ่งไฟล์');
   setSchoolCode([...codes][0]??'');setRows(items);setProblems(issues);
  }catch(e){setError(e instanceof Error?e.message:'อ่านไฟล์ DMC ไม่สำเร็จ');}
  finally{setBusy(false);}
 }
 async function commit(){
  if(busy||!schoolId||!yearId||!rows.length||problems.length||!selectedYear)return;
  if(!window.confirm('ยืนยันนำเข้านักเรียน '+rows.length+' คน เข้าปีการศึกษา '+selectedYear.year_be+'? ระบบไม่เปลี่ยนห้องที่มีประวัติลงทะเบียนอยู่แล้ว'))return;
  const db=getSupabaseBrowserClient();if(!db)return;
  setBusy(true);setError('');setResult(null);setCitizenProgress('');setCitizenResult(null);
  try{
   const {data,error:e}=await db.rpc('import_dmc_students',{p_school_id:schoolId,p_academic_year_id:yearId,p_school_code:schoolCode,p_rows:rows});
   if(e)throw new Error(e.message);
   setResult(data as ImportResult);
   if(hasCitizenColumn){
    const citizenRows=rows.filter(r=>r.citizen_id).map(r=>({student_no:r.student_no,first_name_th:r.first_name_th,last_name_th:r.last_name_th,citizen_id:r.citizen_id}));
    let updated=0,unmatched=0;
    // bcrypt is intentionally expensive: keep each database request comfortably below the statement timeout.
    for(let from=0;from<citizenRows.length;from+=10){
     const slice=citizenRows.slice(from,from+10);
     setCitizenProgress('กำลังอัปเดตรหัสตรวจสอบ LINE '+Math.min(from+slice.length,citizenRows.length)+'/'+citizenRows.length+' คน');
     const {data:chunk,error:chunkError}=await db.rpc('import_dmc_citizen_verifiers',{p_school:schoolId,p_rows:slice});
     if(chunkError)throw new Error('นำเข้าทะเบียนสำเร็จ แต่การอัปเดตเลขบัตรสำหรับ LINE หยุดที่ '+from+'/'+citizenRows.length+' คน: '+chunkError.message+' กรุณานำเข้าไฟล์เดิมอีกครั้งได้โดยไม่สร้างนักเรียนซ้ำ');
     updated+=(chunk as {updated:number;unmatched:number}).updated;
     unmatched+=(chunk as {updated:number;unmatched:number}).unmatched;
     setCitizenResult({updated,unmatched});
    }
    setCitizenProgress('');
   }
   setRows([]);
  }catch(e){setError(e instanceof Error?e.message:'นำเข้าไม่สำเร็จ');}
  finally{setBusy(false);}
 }
 return <main className="wichakan-page mx-auto max-w-5xl px-4 py-6 sm:px-6">
  <Link href="/students" className="text-sm font-semibold text-blue-700">← ทะเบียนนักเรียน</Link>
  <PageHeader title="นำเข้านักเรียนจาก DMC"/>
  <section className="ui-panel mt-5 rounded-2xl border bg-white p-5 shadow-sm">
   <div className="grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl bg-blue-50 p-3 text-sm"><span className="text-xs text-slate-500">โรงเรียนหลัก</span><p className="mt-1 font-semibold text-blue-900">{selectedSchool?.name_th??"ยังไม่พบโรงเรียน"}</p><p className="text-xs text-slate-500">รหัส DMC: {selectedSchool?.code??"—"}</p></div>
    <label className="text-sm font-semibold">ปีการศึกษาปลายทาง<select className="mt-2 w-full rounded-xl border p-3" value={yearId} onChange={e=>{setYearId(e.target.value);setRows([]);setResult(null);}}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}{y.is_active?' (ปัจจุบัน)':''}</option>)}</select></label>
   </div>
   <label className="mt-5 block text-sm font-semibold">ไฟล์ DMC (.xlsx, .xls)<input type="file" accept=".xlsx,.xls" className="mt-2 block w-full rounded-xl border border-dashed border-blue-200 p-4 text-sm" disabled={busy||!schoolId||!yearId} onChange={e=>{const f=e.target.files?.[0];if(f)void parseFile(f);e.target.value='';}}/></label>
   <p className="mt-2 text-xs text-slate-500">อ่านรหัสโรงเรียน รหัสนักเรียน (คอลัมน์ F) คำนำหน้าชื่อ ชื่อ นามสกุล ชั้น และห้อง โดยค้นหาคำนำหน้าจากชื่อคอลัมน์ในไฟล์ หากไฟล์มีคอลัมน์เลขประจำตัวประชาชน 13 หลัก จะใช้สำหรับการจับคู่ลงทะเบียน LINE โดยส่งเข้าฟังก์ชันรักษาความปลอดภัยและเก็บเฉพาะรหัสตรวจสอบแบบ bcrypt ไม่บันทึกเลขบัตรแบบอ่านได้</p>
  </section>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {problems.length>0&&<div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"><h2 className="font-bold">ต้องแก้ไขก่อนนำเข้า ({problems.length})</h2><ul className="mt-2 max-h-40 list-inside list-disc overflow-auto">{problems.slice(0,30).map((p,i)=><li key={i}>{p}</li>)}</ul></div>}
  {rows.length>0&&<section className="ui-panel mt-4 rounded-2xl border bg-white p-5 shadow-sm">
   <h2 className="text-lg font-bold">ตรวจสอบก่อนนำเข้า</h2>
   <p className="mt-1 text-xs text-slate-500">ไฟล์ {fileName} · {rows.length} คน · {roomCounts.length} ห้องเรียน · {hasCitizenColumn?'พบเลขบัตร 13 หลัก':'ไม่พบคอลัมน์เลขบัตร (ยังใช้ LINE ลงทะเบียนไม่ได้)'}</p>
   <div className="mt-3 max-h-64 overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="px-4 py-3">ชั้น/ห้อง</th><th>จำนวนนักเรียน</th></tr></thead><tbody>{roomCounts.map(([room,count])=><tr key={room} className="border-t"><td className="px-4 py-2.5">{room}</td><td>{count} คน</td></tr>)}</tbody></table></div>
   <p className="mt-3 text-xs text-slate-500">ระบบจะเติมหรือปรับคำนำหน้าชื่อของนักเรียนเดิมที่รหัส ชื่อ และนามสกุลตรงกัน โดยไม่เปลี่ยนห้องเดิม หากรหัสเดิมมีชื่อไม่ตรงกันหรือมีการลงทะเบียนห้องอื่นแล้ว จะข้ามรายการนั้นและรายงานข้อขัดแย้ง ไม่เขียนทับประวัติเดิม</p>
   <button disabled={busy||problems.length>0||!selectedYear} onClick={commit} className="ui-primary mt-4 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-40">{busy?'กำลังประมวลผล...':'ยืนยันนำเข้า '+rows.length+' คน'}</button>
  </section>}
  {citizenProgress&&<p role="status" className="mt-3 text-sm">{citizenProgress}</p>}
  {citizenResult&&<p role="status" className="mt-3 text-sm">รหัสตรวจสอบเลขบัตรสำหรับ LINE: อัปเดต {citizenResult.updated} คน · ไม่ตรงทะเบียน {citizenResult.unmatched} คน</p>}
  {result&&<section role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-900">นำเข้าเสร็จแล้ว</h2><p className="mt-2 text-sm">นักเรียนใหม่ {result.new_students} คน · อัปเดตคำนำหน้า {result.updated_prefixes??0} คน · ลงทะเบียนใหม่ {result.new_enrollments} คน · สร้างห้องใหม่ {result.new_rooms} ห้อง · รายการขัดแย้ง {result.conflicts}</p>{result.details?.length>0&&<div className="mt-3 max-h-40 overflow-auto text-xs text-amber-900">{result.details.map((d,i)=><p key={i}>แถว {d.row} · รหัส {d.student_no} · {d.reason==='existing_enrollment_conflict'?'มีการลงทะเบียนเดิมต่างจากไฟล์':'ข้อมูลชื่อหรือสถานภาพเดิมไม่ตรงกับไฟล์'}</p>)}</div>}<Link href="/students" className="mt-4 inline-block text-sm font-semibold text-blue-700">กลับไปดูทะเบียนนักเรียน →</Link></section>}
 </main>;
}
