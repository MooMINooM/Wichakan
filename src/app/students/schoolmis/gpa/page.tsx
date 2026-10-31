'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type School={id:string;name_th:string};
type Membership={school_id:string;role:string;schools:School|null};
type ClassItem={id:string;level_code:string;room_code:string;academic_year_id:string};
type Year={id:string;year_be:number;is_active:boolean};
type Term={sequence:number;year_be:number;level_code:string;term_no:number;gpa:number|null;gpax_to_date:number|null;complete:boolean;status:string};
type StudentSummary={student_id:string;student_no:string;name:string;summary:{terms:Term[];gpax:number|null;completed_terms:number;expected_terms:number;period_type:'year'|'semester'|'none';status:string}};
type ClassSummary={year_be:number;level_code:string;room_code:string;students:StudentSummary[]};
const format=(value:number|null)=>value===null?'—':Number(value).toFixed(2);
const csv=(value:unknown)=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';

export default function SemesterGpaReportPage(){
 const router=useRouter();
 const [schools,setSchools]=useState<School[]>([]),[schoolId,setSchoolId]=useState('');
 const [years,setYears]=useState<Year[]>([]),[yearId,setYearId]=useState('');
 const [classrooms,setClassrooms]=useState<ClassItem[]>([]),[classId,setClassId]=useState('');
 const [report,setReport]=useState<ClassSummary|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db){setError('ไม่ได้เชื่อมต่อฐานข้อมูล');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const res=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
  if(!active)return;
  if(res.error){setError(res.error.message);return;}
  const allowed=((res.data??[]) as unknown as Membership[]).filter(m=>['school_admin','registrar'].includes(m.role)&&m.schools);
  const list=[...new Map(allowed.map(m=>[m.school_id,m.schools!])).values()];
  setSchools(list);setSchoolId(list[0]?.id??'');
  if(!list.length)setError('ไม่มีสิทธิ์เปิดรายงาน GPA และ GPAX ของโรงเรียน');
 })();return()=>{active=false;};},[router]);
 useEffect(()=>{if(!schoolId)return;let active=true;(async()=>{
  setYearId('');setYears([]);setClassId('');setClassrooms([]);setReport(null);
  const db=getSupabaseBrowserClient();if(!db)return;
  const res=await db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('year_be',{ascending:false});
  if(!active)return;
  if(res.error)setError(res.error.message);else{
   const available=(res.data??[]) as Year[];
   setYears(available);
   setYearId((available.find(y=>y.is_active)??available.find(y=>y.year_be===2569)??available[0])?.id??'');
  }
 })();return()=>{active=false;};},[schoolId]);
 useEffect(()=>{if(!schoolId||!yearId)return;let active=true;(async()=>{
  setClassId('');setReport(null);setClassrooms([]);
  const db=getSupabaseBrowserClient();if(!db)return;
  const res=await db.from('classrooms').select('id,level_code,room_code,academic_year_id')
   .eq('school_id',schoolId).eq('academic_year_id',yearId);
  if(!active)return;
  if(res.error)setError(res.error.message);else{
   const list=((res.data??[]) as ClassItem[])
    .filter(c=>/^(ป\.[1-6]|ม\.[1-3])$/.test(c.level_code))
    .sort((a,b)=>{
     const levelOrder=(s:string)=>s.startsWith('ป.')?Number(s.slice(2)):6+Number(s.slice(2));
     return levelOrder(a.level_code)-levelOrder(b.level_code)||a.room_code.localeCompare(b.room_code,'th',{numeric:true});
    });
   setClassrooms(list);setClassId(list[0]?.id??'');
  }
 })();return()=>{active=false;};},[schoolId,yearId]);
 const selectedYear=years.find(y=>y.id===yearId);
 useEffect(()=>{if(!schoolId||!selectedYear||!classId)return;let live=true;(async()=>{
  setLoading(true);setError('');setReport(null);
  const db=getSupabaseBrowserClient();if(!db){setLoading(false);return;}
  const res=await db.rpc('schoolmis_class_semester_summary',{
   p_school:schoolId,p_academic_year_be:selectedYear.year_be,p_classroom:classId
  });
  if(!live)return;
  if(res.error)setError(res.error.message);else setReport(res.data as ClassSummary);
  setLoading(false);
 })();return()=>{live=false;};},[schoolId,selectedYear?.year_be,classId]);
 const columns=useMemo(()=>{
  if(!report)return [];
  const first=report.students[0]?.summary.terms;
  if(first?.length)return first.map(t=>({sequence:t.sequence,label:t.term_no===0?t.level_code+' (รายปี)':t.level_code+' ภาค '+t.term_no}));
  const n=Number(report.level_code.slice(2));
  if(report.level_code.startsWith('ป.'))return Array.from({length:n},(_,i)=>({sequence:i+1,label:'ป.'+(i+1)+' (รายปี)'}));
  return Array.from({length:n*2},(_,i)=>({sequence:i+1,label:'ม.'+Math.ceil((i+1)/2)+' ภาค '+(i%2+1)}));
 },[report]);
 const complete=report?.students.filter(s=>s.summary.completed_terms>0).length??0;
 const isPrimary=report?.level_code.startsWith('ป.')??false;
 const periodNoun=isPrimary?'ปี':'ภาคเรียน';
 function exportCsv(){
  if(!report||!report.students.length)return;
  const headers=['รหัสนักเรียน','ชื่อ–สกุล',...columns.map(t=>'GPA '+t.label),'GPAX สะสม','จำนวน'+(report.level_code.startsWith('ป.')?'ปี':'ภาคเรียน')+'ที่ครบ'];
  const data=report.students.map(s=>[
   s.student_no,s.name,...columns.map(t=>{
     const g=s.summary.terms.find(x=>x.sequence===t.sequence)?.gpa;
     return g===null||g===undefined?'':format(g);
   }),s.summary.gpax===null?'':format(s.summary.gpax),s.summary.completed_terms
  ].map(csv).join(','));
  const content='\uFEFF'+[headers.map(csv).join(','),...data].join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;
  a.download='Wichakan-GPA-GPAX-'+report.level_code.replace('.','')+'-'+report.room_code+'-'+report.year_be+'.csv';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
 }
 return <main className="wichakan-page mx-auto max-w-7xl px-4 py-6">
  <Link href="/students/transcript" className="text-sm font-semibold text-blue-700">← แฟ้มประวัติผลการเรียนรายบุคคล</Link>
  <PageHeader title="รายงาน GPA รายปี / รายภาคเรียน และ GPAX สะสม"/>
  <p className="mb-4 text-sm text-slate-600">ป.1–ป.6: GPA รายปี · ม.1–ม.3: GPA รายภาค · GPAX สะสมจากผลครบต่อเนื่อง</p>
  <section className="ui-panel p-4">
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="text-sm">โรงเรียน<select className="mt-1 block w-full rounded-lg border p-2" value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>
    <label className="text-sm">ปีการศึกษา<select className="mt-1 block w-full rounded-lg border p-2" value={yearId} onChange={e=>setYearId(e.target.value)}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
    <label className="text-sm">ชั้นเรียน<select className="mt-1 block w-full rounded-lg border p-2" value={classId} onChange={e=>setClassId(e.target.value)}>{classrooms.map(c=><option key={c.id} value={c.id}>{c.level_code}/{c.room_code}</option>)}</select></label>
   </div>
  </section>
  {loading&&<p role="status" className="mt-4 text-sm">กำลังคำนวณผลการเรียนทั้งห้อง...</p>}
  {error&&<p role="alert" className="teacher-error mt-4">{error}</p>}
  {report&&<section className="ui-panel mt-4 p-5">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h2 className="text-lg font-bold">ชั้น {report.level_code}/{report.room_code} · ปีการศึกษา {report.year_be}</h2>
     <p className="mt-1 text-sm text-slate-600">นักเรียน {report.students.length} คน · มี GPAX สะสมจาก{periodNoun}ที่ผลครบ {complete} คน</p></div>
    <button className="ui-secondary" disabled={!report.students.length} onClick={exportCsv}>ส่งออก GPA / GPAX ทั้งห้อง (CSV)</button>
   </div>
   {report.students.length===0?<p className="mt-3 text-sm text-slate-500">ยังไม่มีนักเรียนในชั้นเรียนนี้</p>:
   <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[950px] text-sm">
    <thead className="bg-slate-100"><tr><th className="p-2 text-left">รหัสนักเรียน</th><th className="p-2 text-left">ชื่อ–สกุล</th>
    {columns.map(c=><th key={c.sequence} className="p-2 text-center">{c.label}</th>)}
    <th className="p-2 text-center">GPAX สะสม</th><th className="p-2 text-center">ครบ ({isPrimary?'ปี':'ภาค'})</th></tr></thead>
    <tbody>{report.students.map(s=><tr key={s.student_id} className="border-t">
     <td className="p-2">{s.student_no}</td><td className="p-2">{s.name}</td>
     {columns.map(c=><td key={c.sequence} className="p-2 text-center tabular-nums">
      {format(s.summary.terms.find(t=>t.sequence===c.sequence)?.gpa??null)}
     </td>)}
     <td className="p-2 text-center font-bold tabular-nums">{format(s.summary.gpax)}</td>
     <td className="p-2 text-center">{s.summary.completed_terms}/{s.summary.expected_terms}</td>
    </tr>)}</tbody>
   </table></div>}
   <p className="mt-3 text-xs text-slate-600">GPA และ GPAX คำนวณจากเกรด × หน่วยน้ำหนักที่ยืนยันแล้ว รวมเกรด 0 ตาม SchoolMIS สำหรับประถมใช้ผลรายปี โดยรวมสุขศึกษา–พลศึกษาและศิลปะ–ดนตรีตามผลการเรียนทางการ ช่อง — หมายถึงยังไม่มีผลครบ และ GPAX ไม่รวมปีหรือภาคเรียนที่ยังไม่สมบูรณ์</p>
  </section>}
 </main>;
}
