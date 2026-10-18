'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {autoFill,type Lesson} from '@/lib/timetable-auto';
type Term={id:string;academic_year_id:string;term_no:number};
type Year={id:string;year_be:number};
type Room={id:string;room_code:string;level_code:string};
type Offering={id:string;term_id:string;classroom_id:string;subject_id:string};
type Subject={id:string;subject_code:string;name_th:string;grade_level:string|null;learning_hours:number;hour_basis:string};
type Assignment={course_offering_id:string;teacher_user_id:string};
type Profile={user_id:string;display_name:string};
type Rule={id:string;kind:string;weekday_no:number;period_no:number|null;teacher_user_id:string|null;subject_id:string|null;label:string};
type TermSettings={term_id:string;periods_per_day:number};
type Integration={integrated_offering_id:string;host_offering_id:string};
type Preference={course_offering_id:string;double_period:boolean};
type Slot={id:string;term_id:string;course_offering_id:string;weekday_no:number;period_no:number;locked:boolean};
const days=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
export default function TimetablePage(){
 const [school,setSchool]=useState(''),[canWrite,setCanWrite]=useState(false),[years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]),[rooms,setRooms]=useState<Room[]>([]),[offerings,setOfferings]=useState<Offering[]>([]),[subjects,setSubjects]=useState<Subject[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[slots,setSlots]=useState<Slot[]>([]),[rules,setRules]=useState<Rule[]>([]),[preferences,setPreferences]=useState<Preference[]>([]),[integrations,setIntegrations]=useState<Integration[]>([]),[termSettings,setTermSettings]=useState<TermSettings[]>([]),[proposal,setProposal]=useState<Lesson[]>([]),[unplaced,setUnplaced]=useState<{id:string;remaining:number}[]>([]);
 const [panel,setPanel]=useState<'courses'|'integrations'|'review'>('courses'),[courseSearch,setCourseSearch]=useState(''),[termId,setTermId]=useState(''),[roomId,setRoomId]=useState(''),[hasSelection,setHasSelection]=useState(false),[day,setDay]=useState(1),[period,setPeriod]=useState(1),[offeringId,setOfferingId]=useState(''),[selectedSlot,setSelectedSlot]=useState(''),[locked,setLocked]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const db=getSupabaseBrowserClient();
 async function reloadSlots(id:string){if(!db||!id)return;const [q,r,p,z,g]=await Promise.all([db.from('timetable_slots').select('id,term_id,course_offering_id,weekday_no,period_no,locked').eq('term_id',id),db.from('timetable_rules').select('id,kind,weekday_no,period_no,teacher_user_id,subject_id,label').eq('term_id',id),db.from('timetable_course_preferences').select('course_offering_id,double_period').eq('term_id',id),db.from('timetable_term_settings').select('term_id,periods_per_day').eq('term_id',id),db.from('timetable_course_integrations').select('integrated_offering_id,host_offering_id').eq('term_id',id)]);if(q.error)throw q.error;if(r.error)throw r.error;if(p.error)throw p.error;if(z.error)throw z.error;if(g.error)throw g.error;setIntegrations(g.data??[]);setTermSettings(z.data??[]);setSlots(q.data??[]);setRules(r.data??[]);setPreferences(p.data??[]);setProposal([]);setUnplaced([]);}
 useEffect(()=>{let alive=true;(async()=>{try{
  if(!db)throw Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล');
  const u=await db.auth.getUser();if(!u.data.user)throw Error('กรุณาเข้าสู่ระบบ');
  const membership=await db.from('school_memberships').select('school_id,role').eq('user_id',u.data.user.id).eq('active',true);
  if(membership.error)throw membership.error;
  const member=membership.data?.find(m=>m.role==='school_admin'||m.role==='academic')??membership.data?.[0];
  if(!member)throw Error('ไม่มีสิทธิ์เข้าถึงข้อมูลโรงเรียน');
  const schoolId=member.school_id;
  const [y,t,r,o,s,a,p]=await Promise.all([
   db.from('academic_years').select('id,year_be').eq('school_id',schoolId).order('year_be',{ascending:false}),
   db.from('terms').select('id,academic_year_id,term_no').eq('school_id',schoolId),
   db.from('classrooms').select('id,level_code,room_code').eq('school_id',schoolId),
   db.from('course_offerings').select('id,term_id,classroom_id,subject_id').eq('school_id',schoolId),
   db.from('subjects').select('id,subject_code,name_th,grade_level,learning_hours,hour_basis').eq('school_id',schoolId),
   db.from('teaching_assignments').select('course_offering_id,teacher_user_id').eq('school_id',schoolId),
   db.from('profiles').select('user_id,display_name')
  ]);
  const issue=[y,t,r,o,s,a,p].find(x=>x.error)?.error;if(issue)throw issue;
  if(!alive)return;setSchool(schoolId);setCanWrite(member.role==='school_admin'||member.role==='academic');setYears(y.data??[]);setTerms(t.data??[]);setRooms(r.data??[]);setOfferings(o.data??[]);setSubjects(s.data??[]);setAssignments(a.data??[]);setProfiles(p.data??[]);setTermId(t.data?.find(x=>x.academic_year_id===y.data?.[0]?.id)?.id??t.data?.[0]?.id??'');
 }catch(e){if(alive)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่ได้');}finally{if(alive)setLoading(false);}})();return()=>{alive=false};},[db]);
 useEffect(()=>{let live=true;(async()=>{if(!termId||!db)return;try{await reloadSlots(termId);}catch(e){if(live)setError(e instanceof Error?e.message:'อ่านตารางไม่ได้');}})();return()=>{live=false};},[termId,db]);
 const periodsPerDay=termSettings.find(s=>s.term_id===termId)?.periods_per_day??8;
 const available=offerings.filter(o=>o.term_id===termId);
 const usedRooms=rooms.filter(r=>available.some(o=>o.classroom_id===r.id));
 const room=usedRooms.find(r=>r.id===roomId)??usedRooms[0];
 const roomOffers=available.filter(o=>o.classroom_id===room?.id);
 const integratedIds=new Set(integrations.map(i=>i.integrated_offering_id));
 const timetableOffers=roomOffers.filter(o=>!integratedIds.has(o.id));
 const current=slots.filter(s=>roomOffers.some(o=>o.id===s.course_offering_id));
 const weeklyTarget=(subject:Subject|undefined)=>{
  if(!subject||!Number.isFinite(subject.learning_hours)||subject.learning_hours<=0)return null;
  const basis=subject.hour_basis==='term'||subject.grade_level?.startsWith('ม.')?20:40;
  const result=subject.learning_hours/basis;
  return Number.isInteger(result)&&result>0?result:null;
 };
 const weekly=timetableOffers.map(o=>{
  const sub=subjects.find(s=>s.id===o.subject_id);
  return {offering:o,subject:sub,target:weeklyTarget(sub),assigned:slots.filter(s=>s.term_id===termId&&s.course_offering_id===o.id).length};
 });
 const completed=weekly.filter(x=>x.target!==null&&x.assigned===x.target).length;
 const remaining=weekly.reduce((total,x)=>total+Math.max(0,(x.target??0)-x.assigned),0);
 const selectedOffering=timetableOffers.find(o=>o.id===offeringId)??timetableOffers[0];
 const targetInfo=weekly.find(x=>x.offering.id===selectedOffering?.id);
 const adjustedCount=(targetInfo?.assigned??0)-(chosenSlotBelongsToSelected()?1:0);
 function chosenSlotBelongsToSelected(){return !!selectedSlot&&slots.some(s=>s.id===selectedSlot&&s.course_offering_id===selectedOffering?.id);}
 const overTarget=!!targetInfo?.target&&adjustedCount>=targetInfo.target;

 const chosen=slots.find(s=>s.id===selectedSlot&&roomOffers.some(o=>o.id===s.course_offering_id));
 const getSubject=(id:string)=>{const o=offerings.find(o=>o.id===id),s=subjects.find(s=>s.id===o?.subject_id);return s? s.subject_code+' '+s.name_th:'ไม่พบรายวิชา';};
 const teacherNames=(id:string)=>assignments.filter(a=>a.course_offering_id===id).map(a=>profiles.find(p=>p.user_id===a.teacher_user_id)?.display_name??'ครูผู้สอน').join(', ');
 const conflicts=useMemo(()=>{const result:string[]=[];const other=slots.filter(x=>x.term_id===termId&&x.weekday_no===day&&x.period_no===period&&x.id!==selectedSlot);const o=available.find(o=>o.id===(timetableOffers.some(o=>o.id===offeringId)?offeringId:timetableOffers[0]?.id));if(o){if(rules.some(r=>r.kind==='school_break'&&r.weekday_no===day&&r.period_no===period))result.push('คาบพักหรือกิจกรรมรวมของโรงเรียน');if(rules.some(r=>r.kind==='subject_day_block'&&r.weekday_no===day&&r.subject_id===o.subject_id))result.push('วิชานี้ไม่อนุญาตให้สอนในวันนี้');if(rules.some(r=>r.kind==='teacher_unavailable'&&r.weekday_no===day&&r.period_no===period&&assignments.some(a=>a.course_offering_id===o.id&&a.teacher_user_id===r.teacher_user_id)))result.push('ครูผู้สอนไม่ว่างในคาบนี้');if(other.some(x=>available.find(y=>y.id===x.course_offering_id)?.classroom_id===o.classroom_id))result.push('ห้องเรียนมีรายวิชาในคาบนี้แล้ว');const myTeachers=new Set(assignments.filter(a=>a.course_offering_id===o.id).map(a=>a.teacher_user_id));if(other.some(x=>assignments.some(a=>a.course_offering_id===x.course_offering_id&&myTeachers.has(a.teacher_user_id))))result.push('ครูผู้สอนมีคาบสอนซ้อน');}return result;},[slots,rules,termId,day,period,selectedSlot,offeringId,available,assignments]);
 function propose(){const candidates=available.filter(o=>!integratedIds.has(o.id)).map(o=>{const subject=subjects.find(s=>s.id===o.subject_id);const target=weeklyTarget(subject);return target===null?null:{id:o.id,classroom_id:o.classroom_id,subject_id:o.subject_id,target,double_period:preferences.some(p=>p.course_offering_id===o.id&&p.double_period)};}).filter((x):x is NonNullable<typeof x>=>x!==null);const result=autoFill(candidates,slots.filter(s=>s.term_id===termId),assignments,rules,periodsPerDay);setProposal(result.suggested);setUnplaced(result.unplaced);setNotice(result.suggested.length?'ได้ข้อเสนอจัดคาบเพิ่มเติมแล้ว ตรวจสอบก่อนบันทึก':'ไม่มีช่องว่างที่จัดเพิ่มได้ตามเงื่อนไข');}
 async function setIntegration(courseId:string,hostId:string){if(!db||!canWrite||busy)return;setBusy(true);setError('');setNotice('');try{
 const r=await db.rpc('set_course_integration',{p_integrated:courseId,p_host:hostId||null});
 if(r.error)throw r.error;
 await reloadSlots(termId);
 setNotice(hostId?'เชื่อมวิชาบูรณาการแล้ว คะแนนและเวลาเรียนยังบันทึกแยกตามรายวิชา':'กลับเป็นวิชาจัดคาบปกติแล้ว');
 }catch(e){setError(e instanceof Error?e.message:'เชื่อมรายวิชาไม่ได้');}finally{setBusy(false);}}
 async function toggleDouble(courseId:string,checked:boolean){if(!db||!canWrite||busy)return;setBusy(true);setError('');try{
 const r=await db.rpc('set_timetable_double_period',{p_offering_id:courseId,p_double:checked});
 if(r.error)throw r.error;
 setPreferences(previous=>[...previous.filter(x=>x.course_offering_id!==courseId),{course_offering_id:courseId,double_period:checked}]);
 setProposal([]);setUnplaced([]);setNotice('บันทึกความต้องการคาบคู่แล้ว กรุณาสร้างข้อเสนอใหม่');
 }catch(e){setError(e instanceof Error?e.message:'ตั้งค่าคาบคู่ไม่สำเร็จ');}finally{setBusy(false);}}
 async function applyProposal(){if(!db||!canWrite||busy||!proposal.length)return;setBusy(true);setError('');setNotice('');try{
 const r=await db.rpc('save_timetable_proposal',{p_term_id:termId,p_expected_ids:slots.filter(s=>s.term_id===termId).map(s=>s.id),p_lessons:proposal});
 if(r.error)throw r.error;
 setNotice('บันทึกข้อเสนอทั้งหมด '+r.data+' คาบสำเร็จ');
 }catch(e){setError('ไม่มีการบันทึกข้อเสนอ เนื่องจาก: '+(e instanceof Error?e.message:'กรุณาสร้างข้อเสนอใหม่'));}
 finally{await reloadSlots(termId);setBusy(false);}}

 function pick(d:number,p:number){setHasSelection(true);const hit=current.find(s=>s.weekday_no===d&&s.period_no===p);setDay(d);setPeriod(p);setSelectedSlot(hit?.id??'');setOfferingId(hit?.course_offering_id??(timetableOffers.some(o=>o.id===offeringId)?offeringId:timetableOffers[0]?.id??''));setLocked(hit?.locked??false);setNotice('');}
 async function save(){const target=timetableOffers.some(o=>o.id===offeringId)?offeringId:timetableOffers[0]?.id;if(!db||!canWrite||!termId||!target||conflicts.length||overTarget||!hasSelection||busy)return;setBusy(true);setError('');setNotice('');try{const q=await db.rpc('save_timetable_slot',{p_term_id:termId,p_offering_id:target,p_weekday:day,p_period:period,p_locked:locked,p_slot_id:selectedSlot||null});if(q.error)throw q.error;await reloadSlots(termId);setSelectedSlot(q.data??'');setNotice('บันทึกคาบสอนแล้ว');}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่ได้');}finally{setBusy(false);}}
 async function remove(){if(!db||!canWrite||!selectedSlot||busy)return;setBusy(true);setError('');try{const q=await db.rpc('delete_timetable_slot',{p_slot_id:selectedSlot});if(q.error)throw q.error;await reloadSlots(termId);setSelectedSlot('');setNotice('ลบคาบสอนแล้ว');}catch(e){setError(e instanceof Error?e.message:'ลบไม่ได้');}finally{setBusy(false);}}
 return <main className="wichakan-page mx-auto max-w-[1500px] px-5 py-6">
 <PageHeader title="จัดตารางสอน"/>
 <p className="mb-4 text-sm text-slate-500">เลือกวิชาในคลังทางซ้าย → คลิกช่องตาราง → บันทึกทางขวา · วิชาบูรณาการและการตรวจคาบอยู่ในแท็บคลังวิชา</p>
 <div className="mb-4 flex flex-wrap gap-3"><Link className="ui-secondary" href="/academic/timetable/activities">จัดตารางกิจกรรม</Link><Link className="ui-primary" href="/academic/timetable/rules">ตั้งค่าเงื่อนไขและคาบพัก</Link><Link href="/academic/teachers" className="ui-secondary">มอบหมายครูผู้สอน</Link><Link href="/academic" className="ui-secondary">ตั้งค่าปีและภาคเรียน</Link></div>
 {error&&<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
 {loading?<p>กำลังโหลดตารางสอน...</p>:<><div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_260px] 2xl:grid-cols-[300px_minmax(0,1fr)_270px]">
 <aside className="ui-panel order-2 min-w-0 p-3 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4 2xl:col-start-3" aria-label="เครื่องมือจัดตาราง">
 <div className="mb-3"><h2 className="font-semibold text-slate-900">คลังรายวิชา</h2><p className="text-xs text-slate-500">จัดวิชาและตรวจคาบโดยไม่ต้องเลื่อนลง</p></div>
 <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
 {([['courses','วิชา'],['integrations','บูรณาการ'],['review','ตรวจสอบ']] as const).map(([key,title])=><button key={key} type="button" onClick={()=>setPanel(key)} aria-pressed={panel===key} className={'rounded-md px-1 py-2 text-[11px] font-medium '+(panel===key?'bg-white text-blue-800 shadow-sm':'text-slate-600')}>{title}</button>)}</div>
 {panel==='courses'&&<><label className="mb-2 block text-xs text-slate-600">ค้นหารายวิชา<input type="search" value={courseSearch} onChange={e=>setCourseSearch(e.target.value)} placeholder="ชื่อหรือรหัสวิชา" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"/></label><div className="space-y-1.5 lg:max-h-[min(65vh,640px)] lg:overflow-y-auto">{weekly.filter(x=>getSubject(x.offering.id).toLowerCase().includes(courseSearch.trim().toLowerCase())).map(x=>{const selected=selectedOffering?.id===x.offering.id,complete=x.target!==null&&x.assigned===x.target;return <button type="button" key={x.offering.id} onClick={()=>{setOfferingId(x.offering.id);setPanel('courses');}} aria-pressed={selected} className={'w-full rounded-lg border p-2 text-left text-xs '+(selected?'border-blue-400 bg-blue-50':'border-slate-200 bg-white hover:bg-slate-50')}><span className="block font-semibold text-slate-800">{getSubject(x.offering.id)}</span><span className="mt-1 flex items-center justify-between text-slate-500"><span>{complete?'จัดครบแล้ว':'รอจัดคาบ'}</span><strong className={complete?'text-green-700':'text-amber-700'}>{x.assigned}/{x.target??'—'}</strong></span><span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-500" style={{width:Math.min(100,x.target?x.assigned/x.target*100:0)+'%'}}/></span></button>})}</div></>}
 {panel==='integrations'&&<div className="space-y-3 lg:max-h-[min(70vh,650px)] lg:overflow-y-auto"><p className="text-xs text-slate-500">เลือกวิชาหลักที่ใช้คาบร่วมกัน คะแนนและเวลาเรียนยังแยกตามรายวิชา</p>{roomOffers.map(o=>{const link=integrations.find(i=>i.integrated_offering_id===o.id);const hosts=roomOffers.filter(x=>x.id!==o.id&&!integratedIds.has(x.id)&&!integrations.some(i=>i.host_offering_id===o.id));const hasPeriods=slots.some(s=>s.course_offering_id===o.id);return <label className="block text-xs" key={o.id}><span className="mb-1 block font-medium">{getSubject(o.id)}</span><select className="w-full rounded-lg border p-2 text-xs" aria-label={'รูปแบบการเรียน '+getSubject(o.id)} value={link?.host_offering_id??''} disabled={!canWrite||busy||(!link&&hasPeriods)} onChange={e=>void setIntegration(o.id,e.target.value)}><option value="">จัดคาบตามปกติ</option>{hosts.map(h=><option key={h.id} value={h.id}>ร่วมกับ {getSubject(h.id)}</option>)}</select>{!link&&hasPeriods&&<span className="block text-[11px] text-amber-700">มีคาบสอนแล้ว ต้องถอดคาบก่อน</span>}</label>})}</div>}
 {panel==='review'&&<div className="space-y-2 lg:max-h-[min(70vh,650px)] lg:overflow-y-auto"><p className="text-xs text-slate-500">จัดครบ {completed}/{weekly.length} วิชา · เหลือ {remaining} คาบ</p>{weekly.map(x=>{const complete=x.target!==null&&x.assigned===x.target;return <div key={x.offering.id} className="rounded-lg border p-2 text-xs"><p className="mb-1 font-medium">{getSubject(x.offering.id)}</p><div className="flex items-center justify-between"><label className="flex items-center gap-1"><input type="checkbox" aria-label={'จัดคาบคู่ '+getSubject(x.offering.id)} checked={preferences.some(p=>p.course_offering_id===x.offering.id&&p.double_period)} disabled={!canWrite||busy||((x.target??0)<2)} onChange={e=>void toggleDouble(x.offering.id,e.target.checked)}/> คาบคู่</label><strong className={complete?'text-green-700':'text-amber-700'}>{x.assigned}/{x.target??'—'}</strong></div></div>})}</div>}
 </aside>
 <section className="ui-panel order-1 min-w-0 p-3 sm:p-4 lg:col-start-1 lg:row-start-1 2xl:col-start-2">
 <div className="mb-4 flex flex-wrap gap-3"><label className="text-sm">ภาคเรียน<select className="ml-2 rounded-lg border p-2" value={termId} onChange={e=>{setTermId(e.target.value);setSelectedSlot('');setOfferingId('');setRoomId('');setHasSelection(false);}}>{terms.map(t=><option key={t.id} value={t.id}>{years.find(y=>y.id===t.academic_year_id)?.year_be} / {t.term_no}</option>)}</select></label><label className="text-sm">ห้องเรียน<select className="ml-2 rounded-lg border p-2" value={room?.id??''} onChange={e=>{setRoomId(e.target.value);setSelectedSlot('');setOfferingId('');setHasSelection(false);}}>{usedRooms.map(r=><option key={r.id} value={r.id}>{r.level_code}/{r.room_code}</option>)}</select></label></div>
 <p className="mb-2 text-xs text-slate-500">จำนวนคาบเรียนต่อวัน: {periodsPerDay} คาบ · เปลี่ยนได้ที่หน้าเงื่อนไขตารางสอน</p>
 <div className="mb-3 flex flex-wrap gap-2"><button type="button" className="ui-secondary" disabled={!canWrite||busy||!available.length} onClick={propose}>เสนอจัดคาบที่ยังขาด</button>{proposal.length>0&&<button type="button" className="ui-primary" disabled={busy} onClick={()=>void applyProposal()}>ยืนยันบันทึก {proposal.length} คาบ</button>}{proposal.length>0&&<button type="button" className="ui-secondary" disabled={busy} onClick={()=>{setProposal([]);setUnplaced([]);}}>ยกเลิกข้อเสนอ</button>}</div>
 {unplaced.length>0&&<div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>ยังจัดไม่ครบ {unplaced.reduce((n,x)=>n+x.remaining,0)} คาบ</strong><div className="mt-1">{unplaced.map(x=><p key={x.id}>{getSubject(x.id)} · ขาด {x.remaining} คาบ — ลองตรวจวันห้ามสอน ครูไม่ว่าง คาบพัก หรือคาบที่ล็อก</p>)}</div></div>}
 <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-950"><strong>{hasSelection?('เลือก: '+days[day-1]+' คาบ '+period):'คลิกช่องในตารางเพื่อเลือกคาบ'}</strong><span>จัดครบ {completed}/{weekly.length} วิชาที่ต้องจัดคาบ · บูรณาการ {roomOffers.length-timetableOffers.length} วิชา · เหลือ {remaining} คาบ/สัปดาห์</span></div>
 <div className="overflow-auto"><table className="min-w-[850px] w-full border-collapse text-xs"><thead><tr><th className="border bg-slate-100 p-2">คาบ</th>{days.slice(0,5).map((d,i)=><th key={d} className="border bg-slate-100 p-2">{d}</th>)}</tr></thead><tbody>{Array.from({length:periodsPerDay},(_,i)=><tr key={i}><th className="border bg-slate-50 p-2">{i+1}</th>{days.slice(0,5).map((d,j)=>{const slot=current.find(s=>s.weekday_no===j+1&&s.period_no===i+1);const schoolBreak=rules.find(r=>r.kind==='school_break'&&r.weekday_no===j+1&&r.period_no===i+1);const proposed=proposal.find(x=>x.weekday_no===j+1&&x.period_no===i+1&&roomOffers.some(o=>o.id===x.course_offering_id));return <td key={d} className="border p-1"><button type="button" onClick={()=>pick(j+1,i+1)} disabled={!!schoolBreak} aria-pressed={hasSelection&&day===j+1&&period===i+1} className={'min-h-16 w-full rounded-lg p-2 text-left '+(hasSelection&&day===j+1&&period===i+1?'bg-blue-100 ring-2 ring-blue-600 ring-offset-1 text-blue-900':slot?'bg-slate-100':proposed?'bg-green-50 text-green-800 ring-1 ring-green-300':schoolBreak?'bg-amber-50 text-amber-800':'border border-dashed text-slate-400')}>{slot?<><span className="block font-medium text-slate-800">{getSubject(slot.course_offering_id)}</span><span className="block text-[10px]">{slot.locked?'🔒 ':''}{teacherNames(slot.course_offering_id)}</span></>:proposed?<><span className="font-semibold">เสนอ: {getSubject(proposed.course_offering_id)}</span><span className="block text-[10px]">ยังไม่บันทึก</span></>:schoolBreak?(schoolBreak.label||'พัก / กิจกรรมรวม'):'＋ เพิ่มคาบ'}</button></td>})}</tr>)}</tbody></table></div></section>
 <section className="ui-panel order-3 h-fit min-w-0 p-4 lg:col-span-2 lg:row-start-2 2xl:col-span-1 2xl:col-start-1 2xl:row-start-1 2xl:sticky 2xl:top-4"><h2 className="mb-3 font-semibold">รายละเอียดคาบที่เลือก</h2><p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-900">{hasSelection?('กำลังเลือก: '+days[day-1]+' คาบที่ '+period):'กรุณาคลิกคาบบนตารางก่อน'}</p><label className="block text-sm">รายวิชา<select className="mt-1 w-full min-w-0 rounded-lg border p-2" value={timetableOffers.some(o=>o.id===offeringId)?offeringId:timetableOffers[0]?.id??''} onChange={e=>setOfferingId(e.target.value)} disabled={!canWrite}>{timetableOffers.map(o=><option key={o.id} value={o.id}>{getSubject(o.id)}</option>)}</select></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)} disabled={!canWrite}/>ล็อกคาบ ไม่ให้ย้ายหรือลบโดยไม่ปลดล็อก</label>
 {targetInfo&&<p className={'mt-3 rounded-lg p-2 text-sm '+(targetInfo.target===null?'bg-amber-50 text-amber-800':targetInfo.assigned>=targetInfo.target?'bg-green-50 text-green-800':'bg-slate-50 text-slate-700')}>จัดแล้ว {targetInfo.assigned} / {targetInfo.target??'ต้องตรวจชั่วโมง'} คาบต่อสัปดาห์</p>}
 {overTarget&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">รายวิชานี้จัดครบตามจำนวนคาบแล้ว หากต้องการย้าย ให้เลือกคาบเดิมของรายวิชานั้น หรือถอดคาบก่อน</p>}
 {conflicts.length>0&&<div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{conflicts.map(x=><p key={x}>• {x}</p>)}<p className="mt-2 text-xs">ลองเลือกคาบว่างอื่น หรือปรับตารางของครูและห้องที่ชนกัน</p></div>}
 <button className="ui-primary mt-4 w-full" disabled={!canWrite||!termId||!timetableOffers.length||!hasSelection||overTarget||busy||conflicts.length>0} onClick={()=>void save()}>{busy?'กำลังบันทึก':'บันทึกคาบสอน'}</button>
 {chosen&&<button className="ui-secondary mt-2 w-full" disabled={!canWrite||busy||locked} onClick={()=>void remove()}>ลบคาบ</button>}
 {!canWrite&&<p className="mt-3 text-xs text-slate-500">สิทธิ์ของคุณอ่านตารางสอนได้ แต่แก้ไขไม่ได้</p>}
 <p className="mt-4 text-xs text-slate-500">โหมดอัตโนมัติเติมเฉพาะช่องว่าง ไม่ย้ายคาบที่จัดเองหรือคาบล็อก · การยืนยันบันทึกทั้งชุดสำเร็จหรือยกเลิกทั้งหมด · ตารางนี้ยังเป็นฉบับจัดเตรียม ไม่ได้เผยแพร่หรือสร้างบันทึกการเข้าเรียนอัตโนมัติ</p>
 </section></div>

 </>}</main>;
}