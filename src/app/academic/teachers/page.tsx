'use client';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import PageControls,{PAGE_SIZE} from '@/components/page-controls';
import AcademicDialog from '@/components/academic-dialog';
import {AcademicIcon} from '@/components/academic-visuals';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import {teacherAssignmentRows,type AssignmentSubject,type TeachingAssignment} from '@/lib/teacher-assignment-rows';
import type {SchoolCurriculumVersion,SchoolRoom,SchoolOffering} from '@/lib/school-readiness';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Member={user_id:string;role:string};
type Teacher={user_id:string;display_name:string};
type Homeroom={id:string;classroom_id:string;teacher_user_id:string};
type Term={id:string;academic_year_id:string;term_no:number};
type Snapshot={years:Year[];rooms:SchoolRoom[];members:Member[];profiles:Teacher[];homerooms:Homeroom[];terms:Term[];subjects:AssignmentSubject[];versions:SchoolCurriculumVersion[];offerings:SchoolOffering[];assignments:TeachingAssignment[]};
const empty:Snapshot={years:[],rooms:[],members:[],profiles:[],homerooms:[],terms:[],subjects:[],versions:[],offerings:[],assignments:[]};
const gradeOrder=['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'];
const roomName=(r:SchoolRoom)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
const message=(e:unknown)=>e instanceof Error?e.message:(e as {message?:string})?.message??'โหลดข้อมูลไม่สำเร็จ';
async function all<T>(query:(start:number,end:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>):Promise<T[]>{
 const rows:T[]=[];for(let start=0;;start+=500){const r=await query(start,start+499);if(r.error)throw r.error;rows.push(...(r.data??[]) as T[]);if((r.data?.length??0)<500)return rows;}
}
export default function TeachersPage(){
 const db=getSupabaseBrowserClient(),router=useRouter(),request=useRef(0);
 const [schoolId,setSchoolId]=useState(''),[canWrite,setCanWrite]=useState(false),[data,setData]=useState<Snapshot>(empty);
 const [yearId,setYearId]=useState(''),[termId,setTermId]=useState(''),[grade,setGrade]=useState(''),[roomId,setRoomId]=useState('');
 const [homeGrade,setHomeGrade]=useState(''),[homeRoom,setHomeRoom]=useState('');
 const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(1);
 const [dialog,setDialog]=useState<{kind:'subject'|'homeroom';key:string}|null>(null),[teacherId,setTeacherId]=useState(''),[confirmRemove,setConfirmRemove]=useState('');
 const [error,setError]=useState(''),[loadError,setLoadError]=useState(''),[dialogError,setDialogError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;(async()=>{
  try{if(!db)throw Error('ยังไม่ได้เชื่อมต่อระบบ');const {data:{user},error:e}=await db.auth.getUser();if(e)throw e;if(!live)return;if(!user){router.replace('/login');return;}
   const r=await db.from('school_memberships').select('school_id,role').eq('user_id',user.id).eq('active',true);if(r.error)throw r.error;if(!live)return;
   const member=r.data?.find(m=>['school_admin','academic'].includes(m.role))??r.data?.[0];if(!member)throw Error('บัญชีนี้ไม่มีสิทธิ์เข้าถึงโรงเรียน');
   setCanWrite(['school_admin','academic'].includes(member.role));setSchoolId(member.school_id);
  }catch(e){if(live){setError(message(e));setLoading(false);}}
 })();return()=>{live=false;};},[db,router]);
 const load=useCallback(async()=>{
  if(!db||!schoolId)return false;const id=++request.current;setLoading(true);setLoadError('');
  try{
   const tables=await Promise.all([
    all<Year>((a,b)=>db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('id').range(a,b)),
    all<SchoolRoom>((a,b)=>db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',schoolId).order('id').range(a,b)),
    all<Member>((a,b)=>db.from('school_memberships').select('user_id,role').eq('school_id',schoolId).eq('active',true).order('id').range(a,b)),
    all<Homeroom>((a,b)=>db.from('homeroom_assignments').select('id,classroom_id,teacher_user_id').eq('school_id',schoolId).order('id').range(a,b)),
    all<Term>((a,b)=>db.from('terms').select('id,academic_year_id,term_no').eq('school_id',schoolId).order('id').range(a,b)),
    all<AssignmentSubject>((a,b)=>db.from('subjects').select('id,curriculum_version_id,subject_code,name_th,grade_level').eq('school_id',schoolId).order('id').range(a,b)),
    all<SchoolCurriculumVersion>((a,b)=>db.from('curriculum_versions').select('id,curriculum_id,effective_year_be').eq('school_id',schoolId).order('id').range(a,b)),
    all<SchoolOffering>((a,b)=>db.from('course_offerings').select('id,term_id,classroom_id,subject_id').eq('school_id',schoolId).order('id').range(a,b)),
    all<TeachingAssignment>((a,b)=>db.from('teaching_assignments').select('id,course_offering_id,teacher_user_id').eq('school_id',schoolId).order('id').range(a,b)),
   ]);
   const [years,rooms,members,homerooms,terms,subjects,versions,offerings,assignments]=tables;
   const ids=[...new Set([...members.filter(m=>m.role==='teacher').map(m=>m.user_id),...homerooms.map(h=>h.teacher_user_id),...assignments.map(a=>a.teacher_user_id)])];
   const profiles:Teacher[]=[];for(let i=0;i<ids.length;i+=100)profiles.push(...await all<Teacher>((a,b)=>db.from('profiles').select('user_id,display_name').in('user_id',ids.slice(i,i+100)).order('user_id').range(a,b)));
   if(id!==request.current)return false;
   setData({years:years.sort((a,b)=>b.year_be-a.year_be),rooms,members,homerooms,terms:terms.sort((a,b)=>a.term_no-b.term_no),subjects,versions,offerings,assignments,profiles});
   setYearId(prev=>resolveYear(years,schoolId,prev));return true;
  }catch(e){if(id===request.current)setLoadError(message(e));return false;}finally{if(id===request.current)setLoading(false);}
 },[db,schoolId]);
 useEffect(()=>{if(schoolId)void load();return()=>{request.current++;};},[load,schoolId]);
 useEffect(()=>{if(schoolId&&yearId)setYearSelection(schoolId,yearId);},[schoolId,yearId]);
 useEffect(()=>{if(!schoolId)return;const sync=(e:Event)=>{const d=(e as CustomEvent<{schoolId:string;yearId:string}>).detail;if(d?.schoolId===schoolId)setYearId(d.yearId);};window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);},[schoolId]);
 const yearRooms=data.rooms.filter(r=>r.academic_year_id===yearId).sort((a,b)=>roomName(a).localeCompare(roomName(b),'th',{numeric:true}));
 const grades=[...new Set(yearRooms.map(r=>r.level_code))].sort((a,b)=>gradeOrder.indexOf(a)-gradeOrder.indexOf(b));
 const validGrade=grades.includes(grade)?grade:grades[0]??'';
 const gradeRooms=yearRooms.filter(r=>r.level_code===validGrade);
 const validRoom=gradeRooms.some(r=>r.id===roomId)?roomId:'';
 const selectedRooms=gradeRooms.filter(r=>!validRoom||r.id===validRoom);
 const yearTerms=data.terms.filter(t=>t.academic_year_id===yearId),validTerm=yearTerms.some(t=>t.id===termId)?termId:yearTerms[0]?.id??'';
 const homeLevel=grades.includes(homeGrade)?homeGrade:validGrade,homeRooms=yearRooms.filter(r=>r.level_code===homeLevel);
 const selectedHome=homeRooms.find(r=>r.id===homeRoom)??homeRooms.find(r=>r.id===validRoom)??homeRooms[0];
 const homeAssignments=data.homerooms.filter(h=>h.classroom_id===selectedHome?.id);
 const activeIds=new Set(data.members.filter(m=>m.role==='teacher').map(m=>m.user_id));
 const teachers=data.profiles.filter(p=>activeIds.has(p.user_id)).sort((a,b)=>a.display_name.localeCompare(b.display_name,'th'));
 const name=(id:string)=>data.profiles.find(t=>t.user_id===id)?.display_name||'ไม่พบชื่อครู';
 const rows=teacherAssignmentRows(selectedRooms,data.subjects,data.versions,data.offerings,data.assignments,data.years.find(y=>y.id===yearId)?.year_be??0,validTerm);
 const assigned=rows.filter(r=>r.assignments.length>0).length;
 const filtered=rows.filter(r=>(!status||(status==='assigned')===!!r.assignments.length)&&[r.subject?.name_th,r.subject?.subject_code,roomName(r.room),...r.teacherIds.map(name)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const currentPage=Math.min(page,Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))),visible=filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 const dialogRow=dialog?.kind==='subject'?rows.find(r=>r.key===dialog.key):null;
 const dialogHome=dialog?.kind==='homeroom'?data.rooms.find(r=>r.id===dialog.key&&r.academic_year_id===yearId):null;
 const existing=dialogRow?.assignments??(dialogHome?data.homerooms.filter(h=>h.classroom_id===dialogHome.id):[]);
 const choices=teachers.filter(t=>!existing.some(a=>a.teacher_user_id===t.user_id));
 const validTeacher=choices.some(t=>t.user_id===teacherId)?teacherId:'';
 const ready=!!schoolId&&!loading&&!loadError&&!error;
 const metricsReady=ready&&!!validTerm&&selectedRooms.length>0;
 useEffect(()=>{setPage(1);setDialog(null);setDialogError('');setConfirmRemove('');setNotice('');},[yearId,validTerm,validGrade,validRoom]);
 function open(kind:'subject'|'homeroom',key:string){setTeacherId('');setConfirmRemove('');setDialogError('');setDialog({kind,key});}
 async function act(task:()=>PromiseLike<{data?:unknown;error:{message:string}|null}>,success:string,close=false){
  if(!db||!canWrite||busy||!ready)return;setBusy(true);setDialogError('');setNotice('');
  try{const result=await task();if(result.error)throw result.error;if(Array.isArray(result.data)&&!result.data.length)throw Error('ไม่พบรายการที่แก้ไขได้ กรุณาโหลดข้อมูลอีกครั้ง');
   const refreshed=await load();setNotice(success);setConfirmRemove('');setTeacherId('');if(close||!refreshed)setDialog(null);
  }catch(e){setDialogError(message(e));}finally{setBusy(false);}
 }
 return <main className="wichakan-page assignment-dashboard">
  <PageHeader title="มอบหมายครูผู้สอนรายวิชา"/>
  {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
  {loadError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">{loadError}<button className="ml-3 underline" onClick={()=>void load()}>ลองอีกครั้ง</button></p>}
  {notice&&<p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-green-800">{notice}</p>}
  <section className="ui-panel assignment-filters" aria-label="กรองรายวิชา">
   <label>ปีการศึกษา<select aria-label="ปีการศึกษารายวิชา" value={yearId} disabled={!ready||busy} onChange={e=>{setYearId(e.target.value);setTermId('');setRoomId('');setHomeRoom('');}}>{!data.years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <label>ภาคเรียน<select aria-label="ภาคเรียนรายวิชา" value={validTerm} disabled={!ready||busy} onChange={e=>setTermId(e.target.value)}>{!yearTerms.length&&<option value="">ยังไม่มีภาคเรียน</option>}{yearTerms.map(t=><option key={t.id} value={t.id}>ภาคเรียนที่ {t.term_no}</option>)}</select></label>
   <label>ระดับชั้น<select aria-label="ระดับชั้นรายวิชา" value={validGrade} disabled={!ready||busy} onChange={e=>{setGrade(e.target.value);setRoomId('');setHomeGrade(e.target.value);setHomeRoom('');}}>{!grades.length&&<option value="">ยังไม่มีห้องเรียน</option>}{grades.map(g=><option key={g}>{g}</option>)}</select></label>
   <label>ห้องเรียน<select aria-label="ห้องเรียนรายวิชา" value={validRoom} disabled={!ready||busy} onChange={e=>{setRoomId(e.target.value);setHomeRoom(e.target.value);}}><option value="">ทุกห้อง</option>{gradeRooms.map(r=><option key={r.id} value={r.id}>{roomName(r)}</option>)}</select></label>
   <button className="ui-primary" onClick={()=>void load()} disabled={!schoolId||loading||busy}><AcademicIcon name="search"/>แสดงข้อมูล</button>
  </section>
  <section className="assignment-metrics" aria-label="สรุปการมอบหมาย">
   {([{label:'รายวิชาทั้งหมด',value:rows.length,icon:'file',color:'blue'},{label:'มอบหมายแล้ว',value:assigned,icon:'users',color:'green'},{label:'ยังไม่มอบหมายครู',value:rows.length-assigned,icon:'alert',color:'orange'}] as const).map(m=><div className={'academic-stat '+m.color} key={m.label}><i><AcademicIcon name={m.icon}/></i><div><p>{m.label}</p><strong>{metricsReady?m.value:'—'} <small>{selectedRooms.length>1?'รายการ':'รายวิชา'}</small></strong></div></div>)}
  </section>
  {selectedRooms.length>1&&<p className="assignment-count-note">นับรายวิชาแยกตามห้องเรียน · {selectedRooms.length} ห้อง</p>}
  <section className="ui-panel assignment-homeroom" aria-labelledby="homeroom-heading">
   <div className="assignment-section-title"><i><AcademicIcon name="users"/></i><h2 id="homeroom-heading">มอบหมายครูประจำชั้น</h2></div>
   <label>ระดับชั้น<select aria-label="ระดับชั้นครูประจำชั้น" value={homeLevel} disabled={!ready||busy} onChange={e=>{setHomeGrade(e.target.value);setHomeRoom('');}}>{!grades.length&&<option value="">ยังไม่มีห้องเรียน</option>}{grades.map(g=><option key={g}>{g}</option>)}</select></label>
   <label>ห้องเรียน<select aria-label="ห้องเรียนครูประจำชั้น" value={selectedHome?.id??''} disabled={!ready||busy} onChange={e=>setHomeRoom(e.target.value)}>{!homeRooms.length&&<option value="">ยังไม่มีห้องเรียน</option>}{homeRooms.map(r=><option key={r.id} value={r.id}>{roomName(r)}</option>)}</select></label>
   <div className={'assignment-current-home '+(homeAssignments.length?'assigned':'')}><AcademicIcon name="users"/><div><span>ครูประจำชั้น (ปัจจุบัน)</span><p>{!ready?'รอข้อมูล':homeAssignments.length?homeAssignments.map(h=>name(h.teacher_user_id)).join(', '):'ยังไม่มอบหมาย'}</p></div></div>
   <button className="ui-secondary" disabled={!canWrite||!ready||busy||!selectedHome} onClick={()=>selectedHome&&open('homeroom',selectedHome.id)}><AcademicIcon name="edit"/>{homeAssignments.length?'เปลี่ยนครูประจำชั้น':'มอบหมายครูประจำชั้น'}</button>
  </section>
  <section className="ui-panel assignment-roster" aria-labelledby="assignment-list-heading">
   <div className="assignment-roster-toolbar"><div className="assignment-section-title"><i><AcademicIcon name="users"/></i><h2 id="assignment-list-heading">รายการรายวิชา <small>({ready?filtered.length:'—'} รายการ)</small></h2></div><div className="assignment-search-controls"><select aria-label="กรองสถานะการมอบหมาย" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">ทุกสถานะ</option><option value="assigned">มอบหมายแล้ว</option><option value="missing">ยังไม่มอบหมายครู</option></select><label className="assignment-search"><AcademicIcon name="search"/><input aria-label="ค้นหารายวิชาหรือครูผู้สอน" placeholder="ค้นหาชื่อวิชาหรือครูผู้สอน..." value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label></div></div>
   <div className="assignment-table-scroll"><table className="assignment-table"><thead><tr><th scope="col">#</th><th scope="col">ชื่อวิชา</th><th scope="col">รหัสวิชา</th><th scope="col">ชั้น/ห้อง</th><th scope="col">ครูผู้สอน</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr></thead><tbody>{ready&&visible.map((r,i)=><tr key={r.key} className={r.assignments.length?'':'assignment-missing'}><td>{(currentPage-1)*PAGE_SIZE+i+1}</td><th scope="row">{r.subject?.name_th??'ไม่พบข้อมูลรายวิชา'}{r.legacy&&<small className="assignment-legacy">รายวิชาเปิดสอนเดิม</small>}</th><td>{r.subject?.subject_code??'—'}</td><td>{roomName(r.room)}</td><td>{r.teacherIds.length?r.teacherIds.map(id=><div key={id} title={id}>{name(id)}{!activeIds.has(id)&&<small className="assignment-legacy">ไม่มีสิทธิ์ครูผู้สอนที่เปิดใช้งาน</small>}</div>):'—'}</td><td><span className={'assignment-status '+(r.assignments.length?'assigned':'missing')}><b aria-hidden="true">{r.assignments.length?'✓':'!'}</b>{r.assignments.length?'มอบหมายแล้ว':'ยังไม่มอบหมายครู'}</span></td><td><button className="ui-secondary assignment-row-action" disabled={!canWrite||busy} aria-label={(r.assignments.length?'แก้ไข':'มอบหมาย')+' '+(r.subject?.name_th??'รายวิชา')+' '+roomName(r.room)} onClick={()=>open('subject',r.key)}><AcademicIcon name={r.assignments.length?'edit':'users'}/>{r.assignments.length?'แก้ไข':'มอบหมาย'}</button></td></tr>)}</tbody></table></div>
   {loading&&<p role="status" className="assignment-empty">กำลังโหลดข้อมูล...</p>}
   {!loading&&!ready&&<p className="assignment-empty">ไม่สามารถแสดงข้อมูลได้</p>}
   {ready&&!filtered.length&&<div className="assignment-empty">{!validTerm?'ยังไม่มีภาคเรียนในปีที่เลือก':!gradeRooms.length?'ยังไม่มีห้องเรียนในปีที่เลือก':rows.length?'ไม่พบรายการตามเงื่อนไข':'ยังไม่มีรายวิชาในหลักสูตรของระดับชั้นนี้'}{!rows.length&&<Link href="/curriculum" className="mt-2 block text-blue-700">จัดการหลักสูตร →</Link>}</div>}
   {ready&&<PageControls total={filtered.length} page={currentPage} onChange={setPage}/>}
  </section>
  {dialog&&(dialogRow||dialogHome)&&<AcademicDialog title={dialogHome?'มอบหมายครูประจำชั้น':'มอบหมายครูผู้สอน'} onClose={()=>{if(!busy)setDialog(null);}}>
   <p className="mb-4 text-sm text-slate-600">{dialogRow?dialogRow.subject?.name_th+' · '+roomName(dialogRow.room):roomName(dialogHome!)} · ปี {data.years.find(y=>y.id===yearId)?.year_be}{dialogRow?' · ภาคเรียน '+yearTerms.find(t=>t.id===validTerm)?.term_no:''}</p>
   {dialogError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">{dialogError}</p>}
   {existing.length>0&&<div className="assignment-dialog-list"><h3>ครูที่มอบหมายแล้ว</h3>{existing.map(a=><div key={a.id}><span>{name(a.teacher_user_id)}</span>{confirmRemove===a.id?<span className="assignment-remove-confirm">ยืนยันยกเลิก?<button disabled={busy||!ready} onClick={()=>act(()=>db!.from(dialogHome?'homeroom_assignments':'teaching_assignments').delete().eq('school_id',schoolId).eq('id',a.id).select('id'),'ยกเลิกการมอบหมายแล้ว')}>ยืนยัน</button><button disabled={busy} onClick={()=>setConfirmRemove('')}>ย้อนกลับ</button></span>:<button className="text-red-700" disabled={!canWrite||busy||!ready} onClick={()=>setConfirmRemove(a.id)} aria-label={'ยกเลิกมอบหมาย '+name(a.teacher_user_id)}>ยกเลิกมอบหมาย</button>}</div>)}</div>}
   <form className="mt-5 space-y-4" onSubmit={e=>{e.preventDefault();if(!validTeacher)return;if(dialogHome)void act(()=>db!.from('homeroom_assignments').insert({school_id:schoolId,classroom_id:dialogHome.id,teacher_user_id:validTeacher}).select('id'),'มอบหมายครูประจำชั้นแล้ว',true);else if(dialogRow?.subject)void act(()=>db!.rpc('assign_teacher_to_subject',{p_school_id:schoolId,p_teacher_user_id:validTeacher,p_classroom_id:dialogRow.room.id,p_subject_id:dialogRow.subject!.id,p_term_id:validTerm}),'มอบหมายครูผู้สอนแล้ว',true);}}>
    <label className="block">{existing.length?'เพิ่มครูร่วม':'ครูผู้สอน'}<select aria-label="เลือกครูผู้สอน" className="mt-2 w-full rounded-xl border" required value={validTeacher} onChange={e=>setTeacherId(e.target.value)} disabled={busy||!ready}><option value="">เลือกครู</option>{choices.map(t=><option key={t.user_id} value={t.user_id}>{t.display_name}</option>)}</select></label>
    {!teachers.length&&<p className="text-sm text-amber-800">ยังไม่มีครูผู้สอนที่เปิดใช้งานในโรงเรียน</p>}
    {dialogRow&&(!dialogRow.subject||dialogRow.subject.grade_level!==dialogRow.room.level_code)&&<p className="text-sm text-amber-800">ตรวจสอบระดับชั้นของรายวิชาในเมนูหลักสูตรก่อนมอบหมาย</p>}
    <div className="flex justify-end gap-2"><button type="button" className="ui-secondary" disabled={busy} onClick={()=>setDialog(null)}>ปิด</button><button type="submit" className="ui-primary" disabled={!canWrite||busy||!ready||!validTeacher||!!(dialogRow&&(!dialogRow.subject||dialogRow.subject.grade_level!==dialogRow.room.level_code))}>{busy?'กำลังบันทึก...':'บันทึกการมอบหมาย'}</button></div>
   </form>
  </AcademicDialog>}
 </main>;
}
