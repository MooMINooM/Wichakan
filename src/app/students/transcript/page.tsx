'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type School={id:string;name_th:string};
type Membership={school_id:string;role:string;schools:School|null};
type Student={id:string;student_no:string;name_prefix_th:string|null;first_name_th:string;last_name_th:string};
type TranscriptRow={
 year_be:number;level_code:string;term_no:number;subject_code:string;subject_name:string;
 group_name:string;grade:string;weight:number|null;weight_confirmed:boolean;
 status:string;is_activity:boolean;source:string;provenance:string|null;
};
type TranscriptGroup={group_name:string;subjects:number;pending:number;gpa:number|null};
type TranscriptYear={year_be:number;level_code:string;term_no:number;subjects:number;pending:number;gpa:number|null};
type SemesterResult={
 sequence:number;year_be:number;level_code:string;term_no:number;
 subjects:number;expected_subjects:number;pending:number;credits:number|null;
 gpa:number|null;gpax_to_date:number|null;status:string;complete:boolean
};
type SemesterSummary={
 terms:SemesterResult[];gpax:number|null;completed_terms:number;
 expected_terms:number;status:string;
};
type Transcript={
 rows:TranscriptRow[];by_year:TranscriptYear[];by_group:TranscriptGroup[];
 gpax:number|null;status:string;counts:{subject_count:number;ready_count:number;pending_count:number}|null;
 coverage:{expected_periods:number;covered_periods:number}|null
};
const gradeFormatter=(value:number|null)=>value===null?'—':Number(value).toFixed(2);
const statusLabels:Record<string,string>={
 ready:'พร้อมคำนวณ',missing_weight:'รอตรวจหน่วยน้ำหนัก',missing_result:'ยังไม่มีผล',activity:'กิจกรรม',
 incomplete_results:'ผลเรียน/น้ำหนักไม่ครบ',incomplete_history:'ประวัติช่วงชั้นไม่ครบ',
 not_started:'ยังไม่มีผลการเรียน',missing_courses:'รายวิชายังไม่ครบ',extra_courses:'จำนวนรายวิชาไม่ตรงหลักสูตร',missing_credits:'หน่วยกิตไม่ครบ',
 complete:'ครบถ้วน',no_data:'ยังไม่มีข้อมูล',missing_weights:'รอน้ำหนัก'
};
export default function StudentTranscriptPage(){
 const router=useRouter();
 const [schools,setSchools]=useState<School[]>([]),[schoolId,setSchoolId]=useState('');
 const [students,setStudents]=useState<Student[]>([]),[studentId,setStudentId]=useState('');
 const [search,setSearch]=useState(''),[year,setYear]=useState(''),[includeActivities,setIncludeActivities]=useState(true);
 const [transcript,setTranscript]=useState<Transcript|null>(null),[semester,setSemester]=useState<SemesterSummary|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{
  const db=getSupabaseBrowserClient();if(!db){setError('ไม่ได้เชื่อมต่อ Supabase');return;}
  const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
  const r=await db.from('school_memberships').select('school_id,role,schools(id,name_th)').eq('user_id',user.id).eq('active',true);
  if(!active)return;if(r.error){setError(r.error.message);return;}
  const m=(r.data??[]) as unknown as Membership[];
  const schools=[...new Map(m.filter(x=>['school_admin','registrar'].includes(x.role)&&x.schools).map(x=>[x.school_id,x.schools!])).values()];
  setSchools(schools);setSchoolId(schools[0]?.id??'');
  if(!schools.length)setError('บัญชีนี้ไม่มีสิทธิ์เปิดแฟ้มทะเบียนผลการเรียน');
 })();return()=>{active=false;};},[router]);
 useEffect(()=>{if(!schoolId)return;let live=true;(async()=>{
  setStudentId('');setTranscript(null);setSemester(null);setError('');
  const db=getSupabaseBrowserClient();if(!db)return;
  const r=await db.from('students').select('id,student_no,name_prefix_th,first_name_th,last_name_th').eq('school_id',schoolId).order('student_no');
  if(!live)return;if(r.error)setError(r.error.message);else setStudents((r.data??[]) as Student[]);
 })();return()=>{live=false;};},[schoolId]);
 useEffect(()=>{if(!schoolId||!studentId){setTranscript(null);setSemester(null);return;}let active=true;(async()=>{
  setLoading(true);setError('');setTranscript(null);setSemester(null);
  const db=getSupabaseBrowserClient();if(!db){setLoading(false);return;}
  const [r,terms]=await Promise.all([
   db.rpc('schoolmis_student_transcript',{p_school:schoolId,p_student:studentId}),
   db.rpc('schoolmis_student_semester_summary',{p_school:schoolId,p_student:studentId})
  ]);
  if(!active)return;
  const issue=r.error||terms.error;
  if(issue)setError(issue.message);
  else{
   setTranscript(r.data as Transcript);
   setSemester(terms.data as SemesterSummary);
  }
  setLoading(false);
 })();return()=>{active=false;};},[schoolId,studentId]);
 const filteredStudents=useMemo(()=>students.filter(s=>(s.student_no+' '+s.name_prefix_th+s.first_name_th+' '+s.last_name_th).toLocaleLowerCase().includes(search.toLocaleLowerCase())),[students,search]);
 const years=[...new Set(transcript?.rows.map(r=>r.year_be)??[])].sort((a,b)=>b-a);
 const visible=transcript?.rows.filter(r=>(!year||r.year_be===Number(year))&&(includeActivities||!r.is_activity))??[];
 const selectedStudent=students.find(s=>s.id===studentId);
 const cumulative=semester?.status==='not_secondary'?null:semester;
 const displayedGpax=cumulative?cumulative.gpax:transcript?.gpax??null;
 function downloadCsv(){
  if(!transcript||!selectedStudent)return;
  const escape=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const headers=['ปีการศึกษา','ชั้น','ภาคเรียน','รหัสวิชา','รายวิชา','กลุ่มสาระ','ผลการเรียน','หน่วยน้ำหนัก','สถานะ','ที่มา'];
  const rows=transcript.rows.map(r=>[r.year_be,r.level_code,r.term_no||'รายปี',r.subject_code,r.subject_name,r.group_name,r.grade,
   r.weight??'',statusLabels[r.status]??r.status,r.source].map(escape).join(','));
  const text='\uFEFF'+[headers.map(escape).join(','),...rows].join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='Wichakan-Transcript-'+selectedStudent.student_no+'.csv';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
 }
 function downloadTermCsv(){
  if(!semester||!selectedStudent||semester.status==='not_secondary')return;
  const escape=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const columns=['ปีการศึกษา','ชั้น','ภาคเรียน','รายวิชาที่มี','รายวิชาตามหลักสูตร','GPA ภาคเรียน','GPAX สะสม','สถานะ'];
  const data=semester.terms.map(t=>[t.year_be,t.level_code,t.term_no,t.subjects,t.expected_subjects,
   t.gpa===null?'':Number(t.gpa).toFixed(2),t.gpax_to_date===null?'':Number(t.gpax_to_date).toFixed(2),
   statusLabels[t.status]??t.status].map(escape).join(','));
  const rows=['รหัสนักเรียน,'+escape(selectedStudent.student_no),columns.map(escape).join(','),...data];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='Wichakan-GPA-GPAX-'+selectedStudent.student_no+'.csv';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
 }
 return <main className="wichakan-page mx-auto max-w-7xl px-4 py-6">
  <Link href="/students" className="text-sm font-semibold text-blue-700">← ทะเบียนนักเรียน</Link>
  <PageHeader title="แฟ้มประวัติผลการเรียนตลอดช่วงชั้น"/>
  <p className="mb-4 text-sm text-slate-600">แสดง GPA รายภาคเรียน และ GPAX สะสมจากภาคเรียนที่มีผลครบต่อเนื่อง โดยรวมผลย้อนหลัง SchoolMIS กับผลปัจจุบันจาก WICHAKAN</p>
  <section className="ui-panel p-4">
   <div className="grid gap-3 md:grid-cols-3">
    <label className="text-sm">โรงเรียน<select className="mt-1 block w-full rounded-lg border p-2" value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name_th}</option>)}</select></label>
    <label className="text-sm">ค้นหารหัสหรือชื่อนักเรียน<input className="mt-1 block w-full rounded-lg border p-2" value={search} onChange={e=>setSearch(e.target.value)} placeholder="พิมพ์ชื่อหรือรหัสนักเรียน"/></label>
    <label className="text-sm">เลือกนักเรียน<select aria-label="เลือกนักเรียนเพื่อดูประวัติ" className="mt-1 block w-full rounded-lg border p-2" value={studentId} onChange={e=>{setStudentId(e.target.value);setYear('');}}>
     <option value="">เลือกนักเรียน</option>{filteredStudents.map(s=><option key={s.id} value={s.id}>{s.student_no} · {s.name_prefix_th??''}{s.first_name_th} {s.last_name_th}</option>)}
    </select></label>
   </div>
  </section>
  {error&&<p role="alert" className="teacher-error mt-3">{error}</p>}
  {loading&&<p className="mt-4 text-sm">กำลังโหลดประวัติผลการเรียน...</p>}
  {transcript&&selectedStudent&&<div className="mt-4 space-y-4">
   <section className="ui-panel p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <h2 className="text-lg font-bold">{selectedStudent.name_prefix_th??''}{selectedStudent.first_name_th} {selectedStudent.last_name_th}</h2>
      <p className="text-sm text-slate-600">รหัสนักเรียน {selectedStudent.student_no}</p>
    </div><div className="flex flex-wrap gap-2">
      <button className="ui-secondary" onClick={downloadCsv}>ส่งออกประวัติ CSV (ส่วนตัว)</button>
      {cumulative&&<button className="ui-secondary" onClick={downloadTermCsv}>ส่งออก GPA / GPAX CSV</button>}
    </div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-4">
     <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{cumulative?'GPAX สะสม '+cumulative.completed_terms+' ภาคเรียน':'GPAX ตลอดช่วงชั้น'}</p>
      <strong className="text-2xl">{gradeFormatter(displayedGpax)}</strong>
      <p className="text-xs text-slate-600">{cumulative?(cumulative.completed_terms===cumulative.expected_terms?'ครบตามช่วงชั้น':'สะสมถึงภาคที่ผลครบแล้ว'):statusLabels[transcript.status]??transcript.status}</p></div>
     <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">รายวิชาพร้อมคำนวณ</p><strong className="text-xl">{transcript.counts?.ready_count??0} / {transcript.counts?.subject_count??0}</strong></div>
     <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">รายวิชาที่ยังต้องตรวจ</p><strong className="text-xl">{transcript.counts?.pending_count??0}</strong></div>
     <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">ภาคเรียนที่ครบต่อเนื่อง</p><strong className="text-xl">{cumulative?cumulative.completed_terms:transcript.coverage?.covered_periods??0} / {cumulative?cumulative.expected_terms:transcript.coverage?.expected_periods??'—'}</strong></div>
    </div>
    {cumulative&&cumulative.completed_terms>0&&cumulative.completed_terms<cumulative.expected_terms&&
     <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
      GPAX {gradeFormatter(cumulative.gpax)} เป็นผลสะสม {cumulative.completed_terms} ภาคเรียนที่มีผลครบ ยังไม่ใช่ GPAX เมื่อจบช่วงชั้น
     </p>}
    {displayedGpax===null&&<p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">ยังไม่มีภาคเรียนที่ผลการเรียนครบต่อเนื่องสำหรับคำนวณ GPAX สะสม</p>}
   </section>
   <section className="ui-panel p-4">
    <h2 className="font-bold">GPA แยกทุกภาคเรียน และ GPAX สะสม</h2>
    <p className="mt-1 text-xs text-slate-600">GPAX คิดจากผลรวม (เกรด × หน่วยกิต) ÷ ผลรวมหน่วยกิต โดยไม่เฉลี่ย GPA ที่ปัดแล้ว และไม่รวมภาคเรียนที่ผลยังไม่ครบ</p>
    {cumulative?<div className="mt-3 overflow-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr><th className="p-2">ปี</th><th>ชั้น</th><th>ภาค</th><th>รายวิชา</th><th>สถานะ</th><th>GPA ภาคเรียน</th><th>GPAX สะสม</th></tr></thead><tbody>{cumulative.terms.map(t=><tr className="border-t" key={t.sequence}><td className="p-2 text-center">{t.year_be}</td><td className="text-center">{t.level_code}</td><td className="text-center">{t.term_no}</td><td className="text-center">{t.subjects}/{t.expected_subjects}</td><td className="text-center text-xs">{statusLabels[t.status]??t.status}</td><td className="text-center font-semibold">{gradeFormatter(t.gpa)}</td><td className="text-center font-semibold">{gradeFormatter(t.gpax_to_date)}</td></tr>)}</tbody></table></div>:
    !transcript.by_year.length?<p className="mt-2 text-sm text-slate-500">ยังไม่มีผลรายวิชาที่บันทึกไว้</p>:
    <div className="mt-3 overflow-auto"><table className="w-full min-w-[570px] text-sm"><thead><tr><th className="p-2">ปี</th><th>ชั้น</th><th>ภาค</th><th>รายวิชา</th><th>รอตรวจ</th><th>GPA</th></tr></thead><tbody>{transcript.by_year.map(r=><tr key={[r.year_be,r.level_code,r.term_no].join('-')} className="border-t"><td className="p-2 text-center">{r.year_be}</td><td className="text-center">{r.level_code}</td><td className="text-center">{r.term_no||'รายปี'}</td><td className="text-center">{r.subjects}</td><td className="text-center">{r.pending}</td><td className="text-center font-semibold">{gradeFormatter(r.gpa)}</td></tr>)}</tbody></table></div>}
   </section>
   <section className="ui-panel p-4"><h2 className="font-bold">ผลสะสมรายกลุ่มสาระ</h2>
    <p className="mt-1 text-xs text-slate-600">คำนวณตามหน่วยน้ำหนักของผลการเรียนแต่ละรายวิชา ไม่รวมกิจกรรมพัฒนาผู้เรียน</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{transcript.by_group.map(g=><div className="rounded-lg border p-3" key={g.group_name}>
     <p className="text-sm font-semibold">{g.group_name}</p><strong className="text-xl">{gradeFormatter(g.gpa)}</strong>
     <p className="text-xs text-slate-500">รายวิชา {g.subjects} · รอตรวจ {g.pending}</p>
    </div>)}</div>
   </section>
   <section className="ui-panel p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">ทะเบียนผลการเรียนรายวิชา</h2>
    <div className="flex items-center gap-3"><label className="text-sm">ปีการศึกษา <select className="rounded-lg border p-2" value={year} onChange={e=>setYear(e.target.value)}><option value="">ทุกปี</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeActivities} onChange={e=>setIncludeActivities(e.target.checked)}/>แสดงกิจกรรม</label></div></div>
    <div className="mt-3 max-h-[650px] overflow-auto"><table className="w-full min-w-[960px] text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">ปี/ชั้น</th><th>ภาค</th><th className="text-left">รายวิชา</th><th>ผล</th><th>น้ำหนัก</th><th>สถานะ</th><th>ที่มา</th></tr></thead>
     <tbody>{visible.map((r,i)=><tr key={[i,r.year_be,r.subject_code].join('|')} className="border-t">
      <td className="p-2 text-center">{r.year_be} / {r.level_code}</td><td className="text-center">{r.term_no||'รายปี'}</td>
      <td className="p-2">{r.subject_code} {r.subject_name}<div className="text-xs text-slate-500">{r.group_name}</div></td>
      <td className="text-center">{r.grade||'—'}</td><td className="text-center">{r.is_activity?'—':r.weight_confirmed?r.weight:'ยังไม่ยืนยัน'}</td>
      <td className="text-center">{statusLabels[r.status]??r.status}</td><td className="text-center">{r.source}</td>
     </tr>)}</tbody></table></div>
    <div className="mt-3 flex flex-wrap gap-3"><Link href="/students/schoolmis" className="text-sm font-semibold text-blue-700 underline">นำเข้าข้อมูลย้อนหลัง</Link>
     <Link href="/students/schoolmis/weights" className="text-sm font-semibold text-blue-700 underline">ตรวจสอบหน่วยน้ำหนักย้อนหลัง</Link>
     <Link href="/students/schoolmis/gpa" className="text-sm font-semibold text-blue-700 underline">สรุป GPA / GPAX ทั้งห้อง</Link></div>
   </section>
  </div>}
 </main>;
}
