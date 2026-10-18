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
type Slot={id:string;term_id:string;course_offering_id:string;weekday_no:number;period_no:number;locked:boolean};
const days=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
export default function TimetablePage(){
 const [school,setSchool]=useState(''),[canWrite,setCanWrite]=useState(false),[years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]),[rooms,setRooms]=useState<Room[]>([]),[offerings,setOfferings]=useState<Offering[]>([]),[subjects,setSubjects]=useState<Subject[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[slots,setSlots]=useState<Slot[]>([]),[rules,setRules]=useState<Rule[]>([]),[proposal,setProposal]=useState<Lesson[]>([]),[unplaced,setUnplaced]=useState<{id:string;remaining:number}[]>([]);
 const [termId,setTermId]=useState(''),[roomId,setRoomId]=useState(''),[hasSelection,setHasSelection]=useState(false),[day,setDay]=useState(1),[period,setPeriod]=useState(1),[offeringId,setOfferingId]=useState(''),[selectedSlot,setSelectedSlot]=useState(''),[locked,setLocked]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const db=getSupabaseBrowserClient();
 async function reloadSlots(id:string){if(!db||!id)return;const [q,r]=await Promise.all([db.from('timetable_slots').select('id,term_id,course_offering_id,weekday_no,period_no,locked').eq('term_id',id),db.from('timetable_rules').select('id,kind,weekday_no,period_no,teacher_user_id,subject_id,label').eq('term_id',id)]);if(q.error)throw q.error;if(r.error)throw r.error;setSlots(q.data??[]);setRules(r.data??[]);setProposal([]);setUnplaced([]);}
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
 const available=offerings.filter(o=>o.term_id===termId);
 const usedRooms=rooms.filter(r=>available.some(o=>o.classroom_id===r.id));
 const room=usedRooms.find(r=>r.id===roomId)??usedRooms[0];
 const roomOffers=available.filter(o=>o.classroom_id===room?.id);
 const current=slots.filter(s=>roomOffers.some(o=>o.id===s.course_offering_id));
 const weeklyTarget=(subject:Subject|undefined)=>{
  if(!subject||!Number.isFinite(subject.learning_hours)||subject.learning_hours<=0)return null;
  const basis=subject.hour_basis==='term'||subject.grade_level?.startsWith('ม.')?20:40;
  const result=subject.learning_hours/basis;
  return Number.isInteger(result)&&result>0?result:null;
 };
 const weekly=roomOffers.map(o=>{
  const sub=subjects.find(s=>s.id===o.subject_id);
  return {offering:o,subject:sub,target:weeklyTarget(sub),assigned:slots.filter(s=>s.term_id===termId&&s.course_offering_id===o.id).length};
 });
 const completed=weekly.filter(x=>x.target!==null&&x.assigned===x.target).length;
 const remaining=weekly.reduce((total,x)=>total+Math.max(0,(x.target??0)-x.assigned),0);
 const selectedOffering=roomOffers.find(o=>o.id===offeringId)??roomOffers[0];
 const targetInfo=weekly.find(x=>x.offering.id===selectedOffering?.id);
 const adjustedCount=(targetInfo?.assigned??0)-(chosenSlotBelongsToSelected()?1:0);
 function chosenSlotBelongsToSelected(){return !!selectedSlot&&slots.some(s=>s.id===selectedSlot&&s.course_offering_id===selectedOffering?.id);}
 const overTarget=!!targetInfo?.target&&adjustedCount>=targetInfo.target;

 const chosen=slots.find(s=>s.id===selectedSlot&&roomOffers.some(o=>o.id===s.course_offering_id));
 const getSubject=(id:string)=>{const o=offerings.find(o=>o.id===id),s=subjects.find(s=>s.id===o?.subject_id);return s? s.subject_code+' '+s.name_th:'ไม่พบรายวิชา';};
 const teacherNames=(id:string)=>assignments.filter(a=>a.course_offering_id===id).map(a=>profiles.find(p=>p.user_id===a.teacher_user_id)?.display_name??'ครูผู้สอน').join(', ');
 const conflicts=useMemo(()=>{const result:string[]=[];const other=slots.filter(x=>x.term_id===termId&&x.weekday_no===day&&x.period_no===period&&x.id!==selectedSlot);const o=available.find(o=>o.id===(roomOffers.some(o=>o.id===offeringId)?offeringId:roomOffers[0]?.id));if(o){if(rules.some(r=>r.kind==='school_break'&&r.weekday_no===day&&r.period_no===period))result.push('คาบพักหรือกิจกรรมรวมของโรงเรียน');if(rules.some(r=>r.kind==='subject_day_block'&&r.weekday_no===day&&r.subject_id===o.subject_id))result.push('วิชานี้ไม่อนุญาตให้สอนในวันนี้');if(rules.some(r=>r.kind==='teacher_unavailable'&&r.weekday_no===day&&r.period_no===period&&assignments.some(a=>a.course_offering_id===o.id&&a.teacher_user_id===r.teacher_user_id)))result.push('ครูผู้สอนไม่ว่างในคาบนี้');if(other.some(x=>available.find(y=>y.id===x.course_offering_id)?.classroom_id===o.classroom_id))result.push('ห้องเรียนมีรายวิชาในคาบนี้แล้ว');const myTeachers=new Set(assignments.filter(a=>a.course_offering_id===o.id).map(a=>a.teacher_user_id));if(other.some(x=>assignments.some(a=>a.course_offering_id===x.course_offering_id&&myTeachers.has(a.teacher_user_id))))result.push('ครูผู้สอนมีคาบสอนซ้อน');}return result;},[slots,rules,termId,day,period,selectedSlot,offeringId,available,assignments]);
 function propose(){const candidates=available.map(o=>{const subject=subjects.find(s=>s.id===o.subject_id);const target=weeklyTarget(subject);return target===null?null:{id:o.id,classroom_id:o.classroom_id,subject_id:o.subject_id,target};}).filter((x):x is NonNullable<typeof x>=>x!==null);const result=autoFill(candidates,slots.filter(s=>s.term_id===termId),assignments,rules);setProposal(result.suggested);setUnplaced(result.unplaced);setNotice(result.suggested.length?'ได้ข้อเสนอจัดคาบเพิ่มเติมแล้ว ตรวจสอบก่อนบันทึก':'ไม่มีช่องว่างที่จัดเพิ่มได้ตามเงื่อนไข');}
 async function applyProposal(){if(!db||!canWrite||busy||!proposal.length)return;setBusy(true);setError('');setNotice('');try{
 const r=await db.rpc('save_timetable_proposal',{p_term_id:termId,p_expected_ids:slots.filter(s=>s.term_id===termId).map(s=>s.id),p_lessons:proposal});
 if(r.error)throw r.error;
 setNotice('บันทึกข้อเสนอทั้งหมด '+r.data+' คาบสำเร็จ');
 }catch(e){setError('ไม่มีการบันทึกข้อเสนอ เนื่องจาก: '+(e instanceof Error?e.message:'กรุณาสร้างข้อเสนอใหม่'));}
 finally{await reloadSlots(termId);setBusy(false);}}

 function pick(d:number,p:number){setHasSelection(true);const hit=current.find(s=>s.weekday_no===d&&s.period_no===p);setDay(d);setPeriod(p);setSelectedSlot(hit?.id??'');setOfferingId(hit?.course_offering_id??roomOffers[0]?.id??'');setLocked(hit?.locked??false);setNotice('');}
 async function save(){const target=roomOffers.some(o=>o.id===offeringId)?offeringId:roomOffers[0]?.id;if(!db||!canWrite||!termId||!target||conflicts.length||overTarget||!hasSelection||busy)return;setBusy(true);setError('');setNotice('');try{const q=await db.rpc('save_timetable_slot',{p_term_id:termId,p_offering_id:target,p_weekday:day,p_period:period,p_locked:locked,p_slot_id:selectedSlot||null});if(q.error)throw q.error;await reloadSlots(termId);setSelectedSlot(q.data??'');setNotice('บันทึกคาบสอนแล้ว');}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่ได้');}finally{setBusy(false);}}
 async function remove(){if(!db||!canWrite||!selectedSlot||busy)return;setBusy(true);setError('');try{const q=await db.rpc('delete_timetable_slot',{p_slot_id:selectedSlot});if(q.error)throw q.error;await reloadSlots(termId);setSelectedSlot('');setNotice('ลบคาบสอนแล้ว');}catch(e){setError(e instanceof Error?e.message:'ลบไม่ได้');}finally{setBusy(false);}}
 return <main className="wichakan-page mx-auto max-w-[1500px] px-5 py-6">
 <PageHeader title="จัดตารางสอน"/>
 <p className="mb-4 text-sm text-slate-500">จัดด้วยตนเอง ตรวจคาบชน และล็อกคาบ · ระบบจัดอัตโนมัติอยู่ในแผนระยะถัดไป</p>
 <div className="mb-4 flex flex-wrap gap-3"><Link className="ui-primary" href="/academic/timetable/rules">ตั้งค่าเงื่อนไขและคาบพัก</Link><Link href="/academic/teachers" className="ui-secondary">มอบหมายครูผู้สอน</Link><Link href="/academic" className="ui-secondary">ตั้งค่าปีและภาคเรียน</Link></div>
 {error&&<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
 {loading?<p>กำลังโหลดตารางสอน...</p>:<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]"><section className="ui-panel p-4">
 <div className="mb-4 flex flex-wrap gap-3"><label className="text-sm">ภาคเรียน<select className="ml-2 rounded-lg border p-2" value={termId} onChange={e=>{setTermId(e.target.value);setSelectedSlot('');setOfferingId('');setRoomId('');setHasSelection(false);}}>{terms.map(t=><option key={t.id} value={t.id}>{years.find(y=>y.id===t.academic_year_id)?.year_be} / {t.term_no}</option>)}</select></label><label className="text-sm">ห้องเรียน<select className="ml-2 rounded-lg border p-2" value={room?.id??''} onChange={e=>{setRoomId(e.target.value);setSelectedSlot('');setOfferingId('');setHasSelection(false);}}>{usedRooms.map(r=><option key={r.id} value={r.id}>{r.level_code}/{r.room_code}</option>)}</select></label></div>
 <div className="mb-3 flex flex-wrap gap-2"><button type="button" className="ui-secondary" disabled={!canWrite||busy||!available.length} onClick={propose}>เสนอจัดคาบที่ยังขาด</button>{proposal.length>0&&<button type="button" className="ui-primary" disabled={busy} onClick={()=>void applyProposal()}>ยืนยันบันทึก {proposal.length} คาบ</button>}{proposal.length>0&&<button type="button" className="ui-secondary" disabled={busy} onClick={()=>{setProposal([]);setUnplaced([]);}}>ยกเลิกข้อเสนอ</button>}</div>
 {unplaced.length>0&&<div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>ยังจัดไม่ครบ {unplaced.reduce((n,x)=>n+x.remaining,0)} คาบ</strong><div className="mt-1">{unplaced.map(x=><p key={x.id}>{getSubject(x.id)} · ขาด {x.remaining} คาบ — ลองตรวจวันห้ามสอน ครูไม่ว่าง คาบพัก หรือคาบที่ล็อก</p>)}</div></div>}
 <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-950"><strong>{hasSelection?('เลือก: '+days[day-1]+' คาบ '+period):'คลิกช่องในตารางเพื่อเลือกคาบ'}</strong><span>จัดครบ {completed}/{weekly.length} วิชา · เหลือ {remaining} คาบ/สัปดาห์</span></div>
 <div className="overflow-auto"><table className="min-w-[850px] w-full border-collapse text-xs"><thead><tr><th className="border bg-slate-100 p-2">คาบ</th>{days.slice(0,5).map((d,i)=><th key={d} className="border bg-slate-100 p-2">{d}</th>)}</tr></thead><tbody>{Array.from({length:10},(_,i)=><tr key={i}><th className="border bg-slate-50 p-2">{i+1}</th>{days.slice(0,5).map((d,j)=>{const slot=current.find(s=>s.weekday_no===j+1&&s.period_no===i+1);const schoolBreak=rules.find(r=>r.kind==='school_break'&&r.weekday_no===j+1&&r.period_no===i+1);const proposed=proposal.find(x=>x.weekday_no===j+1&&x.period_no===i+1&&roomOffers.some(o=>o.id===x.course_offering_id));return <td key={d} className="border p-1"><button type="button" onClick={()=>pick(j+1,i+1)} disabled={!!schoolBreak} aria-pressed={hasSelection&&day===j+1&&period===i+1} className={'min-h-16 w-full rounded-lg p-2 text-left '+(hasSelection&&day===j+1&&period===i+1?'bg-blue-100 ring-2 ring-blue-600 ring-offset-1 text-blue-900':slot?'bg-slate-100':proposed?'bg-green-50 text-green-800 ring-1 ring-green-300':schoolBreak?'bg-amber-50 text-amber-800':'border border-dashed text-slate-400')}>{slot?<><span className="block font-medium text-slate-800">{getSubject(slot.course_offering_id)}</span><span className="block text-[10px]">{slot.locked?'🔒 ':''}{teacherNames(slot.course_offering_id)}</span></>:proposed?<><span className="font-semibold">เสนอ: {getSubject(proposed.course_offering_id)}</span><span className="block text-[10px]">ยังไม่บันทึก</span></>:schoolBreak?(schoolBreak.label||'พัก / กิจกรรมรวม'):'＋ เพิ่มคาบ'}</button></td>})}</tr>)}</tbody></table></div></section>
 <section className="ui-panel h-fit p-4"><h2 className="mb-3 font-semibold">ตั้งค่าคาบสอน</h2><p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-900">{hasSelection?('กำลังเลือก: '+days[day-1]+' คาบที่ '+period):'กรุณาคลิกคาบบนตารางก่อน'}</p><label className="block text-sm">รายวิชา<select className="mt-1 w-full rounded-lg border p-2" value={roomOffers.some(o=>o.id===offeringId)?offeringId:roomOffers[0]?.id??''} onChange={e=>setOfferingId(e.target.value)} disabled={!canWrite}>{roomOffers.map(o=><option key={o.id} value={o.id}>{getSubject(o.id)}</option>)}</select></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)} disabled={!canWrite}/>ล็อกคาบ ไม่ให้ย้ายหรือลบโดยไม่ปลดล็อก</label>
 {targetInfo&&<p className={'mt-3 rounded-lg p-2 text-sm '+(targetInfo.target===null?'bg-amber-50 text-amber-800':targetInfo.assigned>=targetInfo.target?'bg-green-50 text-green-800':'bg-slate-50 text-slate-700')}>จัดแล้ว {targetInfo.assigned} / {targetInfo.target??'ต้องตรวจชั่วโมง'} คาบต่อสัปดาห์</p>}
 {overTarget&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">รายวิชานี้จัดครบตามจำนวนคาบแล้ว หากต้องการย้าย ให้เลือกคาบเดิมของรายวิชานั้น หรือถอดคาบก่อน</p>}
 {conflicts.length>0&&<div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{conflicts.map(x=><p key={x}>• {x}</p>)}<p className="mt-2 text-xs">ลองเลือกคาบว่างอื่น หรือปรับตารางของครูและห้องที่ชนกัน</p></div>}
 <button className="ui-primary mt-4 w-full" disabled={!canWrite||!termId||!roomOffers.length||!hasSelection||overTarget||busy||conflicts.length>0} onClick={()=>void save()}>{busy?'กำลังบันทึก':'บันทึกคาบสอน'}</button>
 {chosen&&<button className="ui-secondary mt-2 w-full" disabled={!canWrite||busy||locked} onClick={()=>void remove()}>ลบคาบ</button>}
 <div className="mt-5 border-t pt-4"><h3 className="mb-2 text-sm font-bold">จำนวนคาบรายวิชา / สัปดาห์</h3><div className="max-h-80 space-y-2 overflow-auto">{weekly.map(x=><div key={x.offering.id} className="rounded-lg border p-2 text-xs"><div className="flex justify-between gap-2"><span>{x.subject?.subject_code??'—'} {x.subject?.name_th??'ไม่พบวิชา'}</span><strong className={x.target!==null&&x.assigned===x.target?'text-green-700':x.target!==null&&x.assigned>x.target?'text-red-700':'text-amber-700'}>{x.assigned}/{x.target??'—'}</strong></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:Math.min(100,x.target?x.assigned/x.target*100:0)+'%'}}/></div></div>)}</div><p className="mt-2 text-xs text-slate-500">ประถม: ชั่วโมงรายปี ÷ 40 สัปดาห์ · มัธยม: ชั่วโมงรายภาคเรียน ÷ 20 สัปดาห์</p></div>
 {!canWrite&&<p className="mt-3 text-xs text-slate-500">สิทธิ์ของคุณอ่านตารางสอนได้ แต่แก้ไขไม่ได้</p>}
 <p className="mt-4 text-xs text-slate-500">โหมดอัตโนมัติเติมเฉพาะช่องว่าง ไม่ย้ายคาบที่จัดเองหรือคาบล็อก · การยืนยันบันทึกทั้งชุดสำเร็จหรือยกเลิกทั้งหมด · ตารางนี้ยังเป็นฉบับจัดเตรียม ไม่ได้เผยแพร่หรือสร้างบันทึกการเข้าเรียนอัตโนมัติ</p>
 </section></div>}</main>;
}