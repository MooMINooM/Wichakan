'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Term={id:string;academic_year_id:string;term_no:number};
type Year={id:string;year_be:number};
type Room={id:string;room_code:string;level_code:string};
type Offering={id:string;term_id:string;classroom_id:string;subject_id:string};
type Subject={id:string;subject_code:string;name_th:string};
type Assignment={course_offering_id:string;teacher_user_id:string};
type Profile={user_id:string;display_name:string};
type Slot={id:string;term_id:string;course_offering_id:string;weekday_no:number;period_no:number;locked:boolean};
const days=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
export default function TimetablePage(){
 const [school,setSchool]=useState(''),[canWrite,setCanWrite]=useState(false),[years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]),[rooms,setRooms]=useState<Room[]>([]),[offerings,setOfferings]=useState<Offering[]>([]),[subjects,setSubjects]=useState<Subject[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[slots,setSlots]=useState<Slot[]>([]);
 const [termId,setTermId]=useState(''),[roomId,setRoomId]=useState(''),[day,setDay]=useState(1),[period,setPeriod]=useState(1),[offeringId,setOfferingId]=useState(''),[selectedSlot,setSelectedSlot]=useState(''),[locked,setLocked]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const db=getSupabaseBrowserClient();
 async function reloadSlots(id:string){if(!db||!id)return;const q=await db.from('timetable_slots').select('id,term_id,course_offering_id,weekday_no,period_no,locked').eq('term_id',id);if(q.error)throw q.error;setSlots(q.data??[]);}
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
   db.from('subjects').select('id,subject_code,name_th').eq('school_id',schoolId),
   db.from('teaching_assignments').select('course_offering_id,teacher_user_id').eq('school_id',schoolId),
   db.from('teacher_profiles').select('user_id,display_name').eq('school_id',schoolId)
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
 const chosen=slots.find(s=>s.id===selectedSlot);
 const getSubject=(id:string)=>{const o=offerings.find(o=>o.id===id),s=subjects.find(s=>s.id===o?.subject_id);return s? s.subject_code+' '+s.name_th:'ไม่พบรายวิชา';};
 const teacherNames=(id:string)=>assignments.filter(a=>a.course_offering_id===id).map(a=>profiles.find(p=>p.user_id===a.teacher_user_id)?.display_name??'ครูผู้สอน').join(', ');
 const conflicts=useMemo(()=>{const result:string[]=[];const other=slots.filter(x=>x.term_id===termId&&x.weekday_no===day&&x.period_no===period&&x.id!==selectedSlot);const o=available.find(o=>o.id===offeringId);if(o){if(other.some(x=>available.find(y=>y.id===x.course_offering_id)?.classroom_id===o.classroom_id))result.push('ห้องเรียนมีรายวิชาในคาบนี้แล้ว');const myTeachers=new Set(assignments.filter(a=>a.course_offering_id===offeringId).map(a=>a.teacher_user_id));if(other.some(x=>assignments.some(a=>a.course_offering_id===x.course_offering_id&&myTeachers.has(a.teacher_user_id))))result.push('ครูผู้สอนมีคาบสอนซ้อน');}return result;},[slots,termId,day,period,selectedSlot,offeringId,available,assignments]);
 function pick(d:number,p:number){const hit=current.find(s=>s.weekday_no===d&&s.period_no===p);setDay(d);setPeriod(p);setSelectedSlot(hit?.id??'');setOfferingId(hit?.course_offering_id??roomOffers[0]?.id??'');setLocked(hit?.locked??false);setNotice('');}
 async function save(){if(!db||!canWrite||!termId||!offeringId||conflicts.length||busy)return;setBusy(true);setError('');setNotice('');try{const q=await db.rpc('save_timetable_slot',{p_term_id:termId,p_offering_id:offeringId,p_weekday:day,p_period:period,p_locked:locked,p_slot_id:selectedSlot||null});if(q.error)throw q.error;await reloadSlots(termId);setSelectedSlot(q.data??'');setNotice('บันทึกคาบสอนแล้ว');}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่ได้');}finally{setBusy(false);}}
 async function remove(){if(!db||!canWrite||!selectedSlot||busy)return;setBusy(true);setError('');try{const q=await db.rpc('delete_timetable_slot',{p_slot_id:selectedSlot});if(q.error)throw q.error;await reloadSlots(termId);setSelectedSlot('');setNotice('ลบคาบสอนแล้ว');}catch(e){setError(e instanceof Error?e.message:'ลบไม่ได้');}finally{setBusy(false);}}
 return <main className="wichakan-page mx-auto max-w-[1500px] px-5 py-6">
 <PageHeader title="จัดตารางสอน"/>
 <p className="mb-4 text-sm text-slate-500">จัดด้วยตนเอง ตรวจคาบชน และล็อกคาบ · ระบบจัดอัตโนมัติอยู่ในแผนระยะถัดไป</p>
 <div className="mb-4 flex flex-wrap gap-3"><Link href="/academic/teachers" className="ui-secondary">มอบหมายครูผู้สอน</Link><Link href="/academic" className="ui-secondary">ตั้งค่าปีและภาคเรียน</Link></div>
 {error&&<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
 {loading?<p>กำลังโหลดตารางสอน...</p>:<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]"><section className="ui-panel p-4">
 <div className="mb-4 flex flex-wrap gap-3"><label className="text-sm">ภาคเรียน<select className="ml-2 rounded-lg border p-2" value={termId} onChange={e=>{setTermId(e.target.value);setSelectedSlot('');}}>{terms.map(t=><option key={t.id} value={t.id}>{years.find(y=>y.id===t.academic_year_id)?.year_be} / {t.term_no}</option>)}</select></label><label className="text-sm">ห้องเรียน<select className="ml-2 rounded-lg border p-2" value={room?.id??''} onChange={e=>{setRoomId(e.target.value);setSelectedSlot('');}}>{usedRooms.map(r=><option key={r.id} value={r.id}>{r.level_code}/{r.room_code}</option>)}</select></label></div>
 <div className="overflow-auto"><table className="min-w-[850px] w-full border-collapse text-xs"><thead><tr><th className="border bg-slate-100 p-2">คาบ</th>{days.slice(0,5).map((d,i)=><th key={d} className="border bg-slate-100 p-2">{d}</th>)}</tr></thead><tbody>{Array.from({length:10},(_,i)=><tr key={i}><th className="border bg-slate-50 p-2">{i+1}</th>{days.slice(0,5).map((d,j)=>{const slot=current.find(s=>s.weekday_no===j+1&&s.period_no===i+1);return <td key={d} className="border p-1"><button type="button" onClick={()=>pick(j+1,i+1)} className={'min-h-16 w-full rounded-lg p-2 text-left '+(selectedSlot===slot?.id&&slot?'bg-blue-100 ring-2 ring-blue-400':slot?'bg-slate-100':'border border-dashed text-slate-400')}>{slot?<><span className="block font-medium text-slate-800">{getSubject(slot.course_offering_id)}</span><span className="block text-[10px]">{slot.locked?'🔒 ':''}{teacherNames(slot.course_offering_id)}</span></>:'＋ เพิ่มคาบ'}</button></td>})}</tr>)}</tbody></table></div></section>
 <section className="ui-panel h-fit p-4"><h2 className="mb-3 font-semibold">ตั้งค่าคาบสอน</h2><p className="mb-3 text-sm text-slate-500">{days[day-1]} · คาบ {period}</p><label className="block text-sm">รายวิชา<select className="mt-1 w-full rounded-lg border p-2" value={offeringId||roomOffers[0]?.id||''} onChange={e=>setOfferingId(e.target.value)} disabled={!canWrite}>{roomOffers.map(o=><option key={o.id} value={o.id}>{getSubject(o.id)}</option>)}</select></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)} disabled={!canWrite}/>ล็อกคาบ ไม่ให้ย้ายหรือลบโดยไม่ปลดล็อก</label>
 {conflicts.length>0&&<div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{conflicts.map(x=><p key={x}>• {x}</p>)}<p className="mt-2 text-xs">ลองเลือกคาบว่างอื่น หรือปรับตารางของครูและห้องที่ชนกัน</p></div>}
 <button className="ui-primary mt-4 w-full" disabled={!canWrite||!termId||!offeringId||busy||conflicts.length>0} onClick={()=>void save()}>{busy?'กำลังบันทึก':'บันทึกคาบสอน'}</button>
 {chosen&&<button className="ui-secondary mt-2 w-full" disabled={!canWrite||busy||locked} onClick={()=>void remove()}>ลบคาบ</button>}
 {!canWrite&&<p className="mt-3 text-xs text-slate-500">สิทธิ์ของคุณอ่านตารางสอนได้ แต่แก้ไขไม่ได้</p>}
 <p className="mt-4 text-xs text-slate-500">ตารางนี้ยังเป็นฉบับจัดเตรียม ไม่ได้เผยแพร่หรือสร้างบันทึกการเข้าเรียนอัตโนมัติ</p>
 </section></div>}</main>;
}