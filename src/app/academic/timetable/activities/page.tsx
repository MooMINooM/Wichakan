'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {activityRecorders,type ActivityHomeroom} from '@/lib/activity-assessments';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Term={id:string;academic_year_id:string;term_no:number};
type Year={id:string;year_be:number};
type Room={id:string;academic_year_id:string;level_code:string;room_code:string};
type Profile={user_id:string;display_name:string};
type Activity={id:string;term_id:string;classroom_id:string;activity_type:string;weekday_no:number;period_no:number;teacher_user_id:string|null};
const names:Record<string,string>={sss:'สสส.',guidance:'แนะแนว',ethics:'อบรมคุณธรรม',club:'ชุมนุม',scout:'ลูกเสือ–เนตรนารี'};
const days=['','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
export default function ActivitySetupPage(){
 const db=getSupabaseBrowserClient();
 const [school,setSchool]=useState(''),[years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]),[rooms,setRooms]=useState<Room[]>([]),[teachers,setTeachers]=useState<Profile[]>([]),[activities,setActivities]=useState<Activity[]>([]);
 const [homerooms,setHomerooms]=useState<ActivityHomeroom[]>([]),[ownerDraft,setOwnerDraft]=useState('');
 const [term,setTerm]=useState(''),[room,setRoom]=useState(''),[kind,setKind]=useState('sss'),[day,setDay]=useState(1),[period,setPeriod]=useState(1),[teacher,setTeacher]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function loadActivities(id:string){if(!db||!id)return;const r=await db.from('school_activity_schedules').select('id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id').eq('term_id',id).order('weekday_no');if(r.error)throw r.error;setActivities(r.data??[]);}
 useEffect(()=>{let alive=true;(async()=>{try{if(!db)throw Error('ฐานข้อมูลไม่พร้อม');const u=await db.auth.getUser();if(!u.data.user)throw Error('กรุณาเข้าสู่ระบบ');
  const membership=await db.from('school_memberships').select('school_id,role').eq('user_id',u.data.user.id).eq('active',true);if(membership.error)throw membership.error;
  const m=membership.data?.find(x=>x.role==='school_admin'||x.role==='academic');if(!m)throw Error('ต้องใช้สิทธิ์ฝ่ายวิชาการหรือผู้ดูแลระบบ');
  const id=m.school_id;const [y,t,r,members,p,h]=await Promise.all([db.from('academic_years').select('id,year_be').eq('school_id',id).order('year_be',{ascending:false}),db.from('terms').select('id,academic_year_id,term_no').eq('school_id',id),db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',id),db.from('school_memberships').select('user_id,role').eq('school_id',id).eq('active',true),db.from('profiles').select('user_id,display_name'),db.from('homeroom_assignments').select('id,classroom_id,teacher_user_id,is_activity_recorder,created_at').eq('school_id',id)]);
  const issue=[y,t,r,members,p,h].find(x=>x.error)?.error;if(issue)throw issue;if(!alive)return;setSchool(id);setYears(y.data??[]);setTerms(t.data??[]);setRooms(r.data??[]);setTeachers((p.data??[]).filter(a=>members.data?.some(x=>x.user_id===a.user_id&&x.role==='teacher')));setHomerooms(h.data??[]);setTerm(t.data?.find(x=>x.academic_year_id===y.data?.[0]?.id)?.id??'');setTeacher((p.data??[]).find(a=>members.data?.some(x=>x.user_id===a.user_id&&x.role==='teacher'))?.user_id??'');
 }catch(e){if(alive)setError(e instanceof Error?e.message:'ไม่สามารถโหลดข้อมูล');}finally{if(alive)setLoading(false);}})();return()=>{alive=false};},[db]);
 useEffect(()=>{let active=true;(async()=>{try{await loadActivities(term);}catch(e){if(active)setError(e instanceof Error?e.message:'อ่านตารางกิจกรรมไม่ได้');}})();return()=>{active=false};},[term,db]);
 const termYear=terms.find(x=>x.id===term)?.academic_year_id;
 const termRooms=rooms.filter(x=>x.academic_year_id===termYear);
 const selectedRoom=termRooms.some(r=>r.id===room)?room:termRooms[0]?.id??'';
 const roomHomerooms=homerooms.filter(h=>h.classroom_id===selectedRoom);
 const assignedOwner=activityRecorders(roomHomerooms).get(selectedRoom)??'';
 const owner=roomHomerooms.some(h=>h.teacher_user_id===ownerDraft)?ownerDraft:assignedOwner;
 const teacherName=(id:string)=>teachers.find(t=>t.user_id===id)?.display_name??'ไม่พบชื่อครู';
 async function save(){if(!db||!term||!selectedRoom||busy)return;setBusy(true);setError('');setNotice('');try{
  const r=await db.rpc('save_activity_schedule',{p_term:term,p_room:selectedRoom,p_kind:kind,p_day:day,p_period:period,p_teacher:['club','scout'].includes(kind)?null:teacher});
  if(r.error)throw r.error;await loadActivities(term);setNotice('บันทึกกิจกรรมเรียบร้อยแล้ว');
 }catch(e){setError(e instanceof Error?e.message:'บันทึกกิจกรรมไม่ได้');}finally{setBusy(false);}}
 async function saveOwner(){if(!db||!selectedRoom||!owner||busy)return;setBusy(true);setError('');setNotice('');try{
  const r=await db.rpc('assign_activity_homeroom_recorder',{p_room:selectedRoom,p_teacher:owner});if(r.error)throw r.error;
  const h=await db.from('homeroom_assignments').select('id,classroom_id,teacher_user_id,is_activity_recorder,created_at').eq('school_id',school);if(h.error)throw h.error;
  setHomerooms(h.data??[]);setOwnerDraft('');setNotice('กำหนดครูผู้บันทึกชุมนุมและลูกเสือเรียบร้อยแล้ว');
 }catch(e){setError(e instanceof Error?e.message:'กำหนดผู้บันทึกไม่ได้');}finally{setBusy(false);}}
 return <main className="wichakan-page mx-auto max-w-5xl px-5 py-6"><PageHeader title="ตารางกิจกรรมพัฒนาผู้เรียน"/><p className="mb-4 text-sm text-slate-500">สสส. แนะแนว และอบรมคุณธรรมบันทึกโดยครูผู้สอนที่กำหนดในตารางสอน ส่วนชุมนุมและลูกเสือบันทึกโดยครูประจำชั้นที่เลือกไว้เพียงคนเดียวต่อห้อง</p>
 <div className="mb-4"><Link href="/academic/timetable" className="text-sm text-blue-700">← กลับหน้าจัดตารางสอน</Link></div>
 {error&&<p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}{notice&&<p className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
 {loading?<p>กำลังโหลด...</p>:<div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]"><section className="ui-panel h-fit p-4"><h2 className="mb-3 font-semibold">กำหนดกิจกรรมรายห้อง</h2>
 <label className="mb-3 block text-sm">ปี / ภาคเรียน<select className="mt-1 w-full rounded-lg border p-2" value={term} onChange={e=>{setTerm(e.target.value);setRoom('');setOwnerDraft('');}}>{terms.map(t=><option value={t.id} key={t.id}>{years.find(y=>y.id===t.academic_year_id)?.year_be} / {t.term_no}</option>)}</select></label>
 <label className="mb-3 block text-sm">ห้องเรียน<select className="mt-1 w-full rounded-lg border p-2" value={selectedRoom} onChange={e=>{setRoom(e.target.value);setOwnerDraft('');}}>{termRooms.map(r=><option value={r.id} key={r.id}>{r.level_code}/{r.room_code}</option>)}</select></label>
 <label className="mb-3 block text-sm">กิจกรรม<select className="mt-1 w-full rounded-lg border p-2" value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(names).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
 <div className="mb-3 grid grid-cols-2 gap-3"><label className="text-sm">วัน<select className="mt-1 w-full rounded-lg border p-2" value={day} onChange={e=>setDay(Number(e.target.value))}>{days.slice(1,6).map((d,i)=><option key={d} value={i+1}>{d}</option>)}</select></label><label className="text-sm">ช่องคาบ<select className="mt-1 w-full rounded-lg border p-2" value={period} onChange={e=>setPeriod(Number(e.target.value))}>{Array.from({length:8},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label></div>
 {['sss','guidance','ethics'].includes(kind)?<label className="mb-3 block text-sm">ครูผู้สอนกิจกรรม<select className="mt-1 w-full rounded-lg border p-2" value={teacher} onChange={e=>setTeacher(e.target.value)}>{teachers.map(p=><option value={p.user_id} key={p.user_id}>{p.display_name}</option>)}</select></label>:<p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">เลือกครูประจำชั้นผู้รับผิดชอบบันทึกจากส่วนด้านล่าง</p>}
 <div className="mb-4 border-t pt-4"><h3 className="mb-2 font-semibold text-sm">ผู้บันทึกชุมนุม / ลูกเสือ ประจำห้อง</h3><label className="block text-sm">ครูประจำชั้นผู้รับผิดชอบ<select aria-label="ผู้รับผิดชอบชุมนุมและลูกเสือ" className="mt-1 w-full rounded-lg border p-2" disabled={busy||!roomHomerooms.length} value={owner} onChange={e=>setOwnerDraft(e.target.value)}>{!roomHomerooms.length&&<option value="">ยังไม่ได้มอบหมายครูประจำชั้น</option>}{roomHomerooms.map(h=><option key={h.id} value={h.teacher_user_id}>{teacherName(h.teacher_user_id)}</option>)}</select></label><p className="my-2 text-xs text-slate-500">ครูที่เลือกจะเห็นและบันทึกกิจกรรมสองรายการนี้เฉพาะห้องที่รับผิดชอบ</p><button type="button" className="ui-secondary w-full" disabled={busy||!owner||owner===assignedOwner} onClick={()=>void saveOwner()}>บันทึกผู้รับผิดชอบ</button></div>
 <button type="button" className="ui-primary w-full" disabled={busy||!school||!selectedRoom} onClick={()=>void save()}>{busy?'กำลังบันทึก...':'บันทึกกิจกรรม'}</button></section>
 <section className="ui-panel p-4"><h2 className="mb-3 font-semibold">กิจกรรมที่กำหนดแล้ว ({activities.length})</h2><div className="space-y-2">{activities.map(a=>{const r=rooms.find(x=>x.id===a.classroom_id);const p=teachers.find(x=>x.user_id===a.teacher_user_id);return <div key={a.id} className="rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{names[a.activity_type]} · {r?.level_code}/{r?.room_code}</strong><span className="text-sm text-slate-600">{days[a.weekday_no]} คาบ {a.period_no}</span></div><p className="mt-1 text-xs text-slate-500">{a.teacher_user_id?p?.display_name??'ครูผู้สอน':assignedOwner&&a.classroom_id===selectedRoom?teacherName(assignedOwner):activityRecorders(homerooms).get(a.classroom_id)?teacherName(activityRecorders(homerooms).get(a.classroom_id)!):'ยังไม่ได้มอบหมายครูประจำชั้น'}</p></div>;})}{activities.length===0&&<p className="text-sm text-slate-500">ยังไม่มีกิจกรรมที่กำหนด</p>}</div></section></div>}</main>;
}