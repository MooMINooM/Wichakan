'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AcademicIcon,SchoolScene} from '@/components/academic-visuals';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import {summarizeLevels,type SchoolRoom,type SchoolEnrollment,type SchoolOffering,type SchoolAssignment,type SchoolSubject,type SchoolCurriculumVersion} from '@/lib/school-readiness';

type Year={id:string;year_be:number;is_active:boolean};
type Term={id:string;academic_year_id:string;term_no:number};
type Snapshot={yearId:string;rooms:SchoolRoom[];enrollments:SchoolEnrollment[];offerings:SchoolOffering[];assignments:SchoolAssignment[];subjects:SchoolSubject[];versions:SchoolCurriculumVersion[]};
const emptySnapshot:Snapshot={yearId:'',rooms:[],enrollments:[],offerings:[],assignments:[],subjects:[],versions:[]};
const statusLabels={ready:'พร้อมลงคะแนน',progress:'กำลังดำเนินการ',empty:'ยังไม่เริ่มดำเนินการ'};

// Read every page so school totals are not truncated by the Data API row limit.
async function readAll<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>):Promise<T[]>{
 const rows:T[]=[];
 for(let from=0;;from+=500){const result=await query(from,from+499);if(result.error)throw new Error(result.error.message);rows.push(...(result.data??[]));if((result.data?.length??0)<500)return rows;}
}

export default function AdminPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [schoolId,setSchoolId]=useState(''),[schoolName,setSchoolName]=useState('');
 const [years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]);
 const [yearId,setYearId]=useState(''),[termId,setTermId]=useState(''),[view,setView]=useState('all');
 const [snapshot,setSnapshot]=useState<Snapshot>(emptySnapshot);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[updatedAt,setUpdatedAt]=useState('');
 const [showAll,setShowAll]=useState(false),[selectedLevel,setSelectedLevel]=useState('');
 useEffect(()=>{let live=true;(async()=>{
  try{
   if(!db)throw new Error('ยังไม่ได้เชื่อมต่อ Supabase');
   const {data:{user},error:authError}=await db.auth.getUser();if(!live)return;
   if(authError)throw authError;if(!user){router.replace('/login');return;}
   const result=await db.from('school_memberships').select('school_id,schools(name_th)').eq('user_id',user.id).eq('role','school_admin').eq('active',true).limit(1);
   if(result.error)throw result.error;if(!live)return;
   if(!result.data?.length){router.replace('/workspace');return;}
   const member=result.data[0] as unknown as {school_id:string;schools:{name_th:string}|null};
   const [y,t]=await Promise.all([
    db.from('academic_years').select('id,year_be,is_active').eq('school_id',member.school_id).order('year_be',{ascending:false}),
    db.from('terms').select('id,academic_year_id,term_no').eq('school_id',member.school_id).order('term_no')
   ]);
   if(y.error||t.error)throw y.error??t.error;if(!live)return;
   setYears(y.data??[]);setTerms(t.data??[]);setSchoolName(member.schools?.name_th??'');setSchoolId(member.school_id);setYearId(resolveYear(y.data??[],member.school_id));
  }catch(e){if(live){setError(e instanceof Error?e.message:(e as {message?:string})?.message??'โหลดข้อมูลไม่สำเร็จ');setLoading(false);}}
 })();return()=>{live=false;};},[db,router]);
 useEffect(()=>{
  if(!schoolId)return;
  const sync=(event:Event)=>{const detail=(event as CustomEvent<{schoolId:string;yearId:string}>).detail;if(detail?.schoolId===schoolId&&years.some(y=>y.id===detail.yearId)){setYearId(detail.yearId);setTermId('');setSelectedLevel('');}};
  window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);
 },[schoolId,years]);
 useEffect(()=>{let live=true;
  if(!db||!schoolId)return;
  if(!yearId){setSnapshot(emptySnapshot);setLoading(false);return;}
  setLoading(true);setError('');
  (async()=>{try{
   const [rooms,enrollments,offerings,assignments,subjects,versions]=await Promise.all([
    readAll<SchoolRoom>((a,b)=>db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',schoolId).eq('academic_year_id',yearId).order('id').range(a,b)),
    readAll<SchoolEnrollment>((a,b)=>db.from('enrollments').select('student_id,classroom_id,academic_year_id,status').eq('school_id',schoolId).eq('academic_year_id',yearId).in('status',['active','completed']).order('id').range(a,b)),
    readAll<SchoolOffering>((a,b)=>db.from('course_offerings').select('id,classroom_id,term_id,subject_id').eq('school_id',schoolId).order('id').range(a,b)),
    readAll<SchoolAssignment>((a,b)=>db.from('teaching_assignments').select('course_offering_id').eq('school_id',schoolId).order('id').range(a,b)),
    readAll<SchoolSubject>((a,b)=>db.from('subjects').select('id,curriculum_version_id,subject_code,grade_level').eq('school_id',schoolId).order('id').range(a,b)),
    readAll<SchoolCurriculumVersion>((a,b)=>db.from('curriculum_versions').select('id,curriculum_id,effective_year_be').eq('school_id',schoolId).order('id').range(a,b))
   ]);
   if(!live)return;setSnapshot({yearId,rooms,enrollments,offerings,assignments,subjects,versions});setUpdatedAt(new Date().toLocaleString('th-TH',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}));
  }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}finally{if(live)setLoading(false);}})();
  return()=>{live=false;};
 },[db,schoolId,yearId,revision]);
 const year=years.find(y=>y.id===yearId);
 const yearTerms=terms.filter(t=>t.academic_year_id===yearId);
 const term=yearTerms.find(t=>t.id===termId)??yearTerms[0];
 const current=snapshot.yearId===yearId;
 const rows=current?summarizeLevels(snapshot.rooms,snapshot.enrollments,snapshot.offerings,snapshot.assignments,yearId,term?.id??'',snapshot.subjects,snapshot.versions,year?.year_be??0):[];
 const shown=rows.filter(r=>(view==='all'||(view==='needs'?r.status!=='ready':r.level.startsWith(view)))&&(!selectedLevel||r.level===selectedLevel));
 const readyCount=rows.filter(r=>r.status==='ready').length;
 const readiness=rows.length?Math.round(readyCount/rows.length*100):0;
 const students=new Set(snapshot.enrollments.filter(e=>current&&snapshot.rooms.some(r=>r.id===e.classroom_id)&&['active','completed'].includes(e.status)).map(e=>e.student_id)).size;
 const alerts=[...rows].sort((a,b)=>(a.status==='ready'?1:0)-(b.status==='ready'?1:0)||a.progress-b.progress).map(r=>({level:r.level,title:!r.courses?'ยังไม่มีรายวิชาในหลักสูตร':r.unassigned?'ขาดครูสอนอีก '+r.unassigned+' วิชา':r.missingStudentRooms?'ยังไม่มีรายชื่อนักเรียน '+r.missingStudentRooms+' ห้อง':'เตรียมข้อมูลพร้อม รอข้อมูลคะแนน',detail:r.courses?'มีครูครบทุกห้อง '+r.assigned+' จาก '+r.courses+' วิชา':r.rooms+' ห้อง · '+r.students+' คน',status:r.status}));
 const visibleAlerts=showAll?alerts:alerts.slice(0,4);
 const canShow=current&&!error;
 function chooseYear(id:string){setYearId(id);setTermId('');setSelectedLevel('');setYearSelection(schoolId,id);}
 return <main className="academic-dashboard school-dashboard mx-auto px-4 pb-6 pt-4 sm:px-6">
  <header className="academic-hero"><div className="relative z-10"><h1>จัดการสถานศึกษา</h1><p>ติดตามความพร้อมของแต่ละระดับชั้นและภาพรวมงานวิชาการของโรงเรียน</p><span>{schoolName||'Wichakan · ระบบบริหารจัดการสถานศึกษา'}</span></div><SchoolScene/></header>
  {error&&<div role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 font-bold underline" onClick={()=>schoolId?setRevision(x=>x+1):window.location.reload()}>ลองอีกครั้ง</button></div>}
  <div className="academic-filters school-filters" aria-busy={loading}>
   <label><AcademicIcon name="calendar"/><span>ปีการศึกษา</span><select disabled={!years.length} value={yearId} onChange={e=>chooseYear(e.target.value)}>{!years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{years.map(y=><option key={y.id} value={y.id}>{y.year_be}{y.is_active?' (ปัจจุบัน)':''}</option>)}</select></label>
   <label><AcademicIcon name="file"/><span>ภาคเรียน</span><select disabled={!yearTerms.length} value={term?.id??''} onChange={e=>setTermId(e.target.value)}>{!yearTerms.length&&<option value="">ยังไม่มีภาคเรียน</option>}{yearTerms.map(t=><option key={t.id} value={t.id}>ภาคเรียนที่ {t.term_no}</option>)}</select></label>
   <label><AcademicIcon name="chart"/><span>มุมมอง</span><select value={view} onChange={e=>{setView(e.target.value);setSelectedLevel('');}}><option value="all">ทุกระดับชั้น</option><option value="อ.">อนุบาล</option><option value="ป.">ประถมศึกษา</option><option value="ม.">มัธยมศึกษา</option><option value="needs">ต้องติดตาม</option></select></label>
   <button type="button" disabled={loading||!schoolId} className="academic-primary" onClick={()=>setRevision(x=>x+1)}><AcademicIcon name="search"/>{loading?'กำลังโหลด...':'แสดงข้อมูล'}</button>
  </div>
  {loading&&<p role="status" className="school-loading">กำลังโหลดข้อมูลสถานศึกษา...</p>}
  <section className="school-metrics" aria-label="ภาพรวมสถานศึกษา" aria-busy={loading}>
   {([{label:'ระดับชั้นทั้งหมด',value:rows.length,unit:'ระดับ',detail:rows.length?rows[0].level+' – '+rows[rows.length-1].level:'ยังไม่มีห้องเรียน',icon:'school',color:'blue'},{label:'นักเรียนทั้งหมด',value:students,unit:'คน',detail:year?'ปีการศึกษา '+year.year_be:'ยังไม่กำหนดปี',icon:'users',color:'green'},{label:'รายวิชาที่ลงทะเบียน',value:rows.reduce((n,r)=>n+r.courses,0),unit:'รายวิชา',detail:year?'ตามหลักสูตรปี '+year.year_be:'ยังไม่กำหนดปี',icon:'book',color:'purple'},{label:'พร้อมลงคะแนน',value:readiness,unit:'%',detail:readyCount+' จาก '+rows.length+' ระดับเตรียมข้อมูลครบ',icon:'check',color:'green'}] as const).map(m=><div key={m.label} className={'academic-stat '+m.color}><i><AcademicIcon name={m.icon}/></i><div><p>{m.label}</p><strong>{loading||!canShow?'—':m.value.toLocaleString('th-TH')}<small>{m.unit==='%'?'%':' '+m.unit}</small></strong><span>{m.detail}</span></div></div>)}
  </section>
  <div className="school-grid">
   <section className="academic-panel school-table-panel" aria-labelledby="school-level-heading">
    <div className="academic-panel-heading"><h2 id="school-level-heading"><AcademicIcon name="chart"/>ภาพรวมความพร้อมรายระดับชั้น</h2><span>{updatedAt&&canShow?'ข้อมูล ณ '+updatedAt:''}</span></div>
    {selectedLevel&&<div className="school-selection">กำลังดู {selectedLevel}<button onClick={()=>setSelectedLevel('')}>แสดงทุกระดับชั้น ×</button></div>}
    <div className="school-table-scroll"><table className="school-table"><thead><tr><th>ระดับชั้น</th><th>จำนวนนักเรียน</th><th>จำนวนรายวิชา</th><th>มอบหมายครู</th><th>ลงคะแนน</th><th>ความพร้อม</th><th>สถานะ</th></tr></thead><tbody>
     {canShow&&!loading&&shown.map(r=><tr key={r.level}><th scope="row"><button title={'ดูรายละเอียด '+r.level} onClick={()=>setSelectedLevel(r.level)}>{r.level}</button></th><td>{r.students} คน</td><td>{r.courses} รายวิชา</td><td><span className={'school-cell-status '+(r.courses&&!r.unassigned?'done':'waiting')}><b aria-hidden="true">{r.courses&&!r.unassigned?'✓':'!'}</b>{!r.courses?'ยังไม่มีหลักสูตร':r.unassigned?'ขาดครู '+r.unassigned+' วิชา':'ครบทุกวิชา'}</span></td><td className="school-no-scores">ยังไม่มีข้อมูล</td><td><div className="school-progress-cell"><progress max="100" value={r.progress} aria-label={'ความพร้อม '+r.level} className={r.status==='ready'?'complete':''}/><span>{r.progress}%</span></div></td><td><span className={'school-status '+r.status}>{statusLabels[r.status]}</span></td></tr>)}
    </tbody></table></div>
    {(!canShow||loading)&&<p className="school-empty">{loading?'กำลังโหลดข้อมูล...':'ยังไม่สามารถแสดงข้อมูลได้'}</p>}
    {canShow&&!loading&&!shown.length&&<div className="school-empty"><p>{rows.length?'ไม่มีระดับชั้นในมุมมองนี้':'ยังไม่มีห้องเรียนในปีการศึกษาที่เลือก'}</p><Link href="/academic">ไปตั้งค่างานวิชาการ →</Link></div>}
    <p className="school-table-note">จำนวนวิชาอิงรายวิชาที่ลงทะเบียนในรุ่นหลักสูตรล่าสุดที่มีผลในปีที่เลือก วิชาที่ขาดครูนับรวมวิชาที่ยังไม่เปิดสอน และต้องมีครูครบทุกห้องในภาคเรียนที่เลือก ยังไม่รวมผลการลงคะแนน</p>
    <div className="school-footer-links"><Link href="/academic">ตั้งค่างานวิชาการ ↗</Link><Link href="/academic/teachers">มอบหมายครู ↗</Link><Link href="/students/history">จัดนักเรียนเข้าห้อง ↗</Link></div>
   </section>
   <aside className="school-aside">
    <section className="academic-panel school-followup"><div className="academic-panel-heading"><h2><span className="school-alert-symbol" aria-hidden="true">!</span>รายการที่ต้องติดตาม</h2><button type="button" className="academic-soft-button" onClick={()=>setShowAll(x=>!x)}>{showAll?'ย่อรายการ':'ดูทั้งหมด'}</button></div>
     {canShow&&!loading&&visibleAlerts.map(a=><button type="button" key={a.level} className="school-alert-item" onClick={()=>{setSelectedLevel(a.level);setView('all');document.getElementById('school-level-heading')?.scrollIntoView({block:'nearest',behavior:'smooth'});}}><span className={'school-alert-mark '+(a.status==='ready'?'info':'warning')} aria-hidden="true">{a.status==='ready'?'i':'!'}</span><strong>{a.level}</strong><span><b>{a.title}</b><small>{a.detail}</small></span><span aria-hidden="true" className="school-arrow">›</span></button>)}
     {canShow&&!loading&&!alerts.length&&<p className="school-empty">ยังไม่มีรายการที่ต้องติดตาม</p>}
    </section>
    <section className="academic-panel school-status-summary"><h2><AcademicIcon name="chart"/>สรุปสถานะรายระดับชั้น</h2>{(['ready','progress','empty'] as const).map(status=>{const count=rows.filter(r=>r.status===status).length;return <div key={status}><span className={'school-dot '+status}/><span>{statusLabels[status]}</span><progress max={Math.max(rows.length,1)} value={canShow&&!loading?count:0} className={status}/><b>{canShow&&!loading?count:'—'} ระดับชั้น</b></div>;})}</section>
   </aside>
  </div>
 </main>;
}
