'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Term={id:string;academic_year_id:string;term_no:number};
type Year={id:string;year_be:number};
type Member={user_id:string};
type Profile={user_id:string;display_name:string};
type Subject={id:string;subject_code:string;name_th:string};
type Rule={id:string;term_id:string;kind:string;weekday_no:number;period_no:number|null;teacher_user_id:string|null;subject_id:string|null;label:string};
const days=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
export default function TimetableRulesPage(){
 const db=getSupabaseBrowserClient();
 const [school,setSchool]=useState(''),[canWrite,setCanWrite]=useState(false),[years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]),[members,setMembers]=useState<Member[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[subjects,setSubjects]=useState<Subject[]>([]),[rules,setRules]=useState<Rule[]>([]);
 const [term,setTerm]=useState(''),[kind,setKind]=useState('teacher_unavailable'),[day,setDay]=useState(1),[period,setPeriod]=useState(4),[teacher,setTeacher]=useState(''),[subject,setSubject]=useState(''),[label,setLabel]=useState('พักกลางวัน'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const loadRules=async(t:string)=>{if(!db||!t)return;const r=await db.from('timetable_rules').select('id,term_id,kind,weekday_no,period_no,teacher_user_id,subject_id,label').eq('term_id',t).order('weekday_no');if(r.error)throw r.error;setRules(r.data??[]);};
 useEffect(()=>{let active=true;(async()=>{if(!db)return;try{
  const u=await db.auth.getUser();if(!u.data.user)throw Error('กรุณาเข้าสู่ระบบ');
  const m=await db.from('school_memberships').select('school_id,role').eq('user_id',u.data.user.id).eq('active',true);
  if(m.error)throw m.error;const selected=m.data?.find(x=>['school_admin','academic'].includes(x.role))??m.data?.[0];if(!selected)throw Error('ไม่มีสิทธิ์เข้าถึงโรงเรียน');
  const id=selected.school_id;
  const [y,t,s,staff,p]=await Promise.all([db.from('academic_years').select('id,year_be').eq('school_id',id).order('year_be',{ascending:false}),db.from('terms').select('id,academic_year_id,term_no').eq('school_id',id),db.from('subjects').select('id,subject_code,name_th').eq('school_id',id),db.from('school_memberships').select('user_id').eq('school_id',id).eq('active',true),db.from('profiles').select('user_id,display_name')]);
  const issue=[y,t,s,staff,p].find(x=>x.error)?.error;if(issue)throw issue;if(!active)return;
  setSchool(id);setCanWrite(['school_admin','academic'].includes(selected.role));setYears(y.data??[]);setTerms(t.data??[]);setSubjects(s.data??[]);setMembers(staff.data??[]);setProfiles(p.data??[]);setTerm(t.data?.find(x=>x.academic_year_id===y.data?.[0]?.id)?.id??'');
 }catch(e){if(active)setError(e instanceof Error?e.message:'ไม่สามารถอ่านเงื่อนไข');}})();return()=>{active=false;};},[db]);
 useEffect(()=>{let active=true;(async()=>{try{await loadRules(term);}catch(e){if(active)setError(e instanceof Error?e.message:'อ่านเงื่อนไขไม่ได้');}})();return()=>{active=false;};},[term,db]);
 const teachers=profiles.filter(p=>members.some(m=>m.user_id===p.user_id));
 async function save(){if(!db||!canWrite||!term||busy)return;setBusy(true);setError('');setMessage('');try{
  const r=await db.rpc('manage_timetable_rule',{p_term_id:term,p_kind:kind,p_weekday:day,p_period:kind==='subject_day_block'?null:period,p_teacher:kind==='teacher_unavailable'?(teacher||teachers[0]?.user_id):null,p_subject:kind==='subject_day_block'?(subject||subjects[0]?.id):null,p_label:label,p_rule_id:null,p_delete:false});
  if(r.error)throw r.error;await loadRules(term);setMessage('บันทึกเงื่อนไขเรียบร้อยแล้ว');
 }catch(e){setError(e instanceof Error?e.message:'ไม่สามารถบันทึก');}finally{setBusy(false);}}
 async function remove(id:string){if(!db||!canWrite||busy)return;setBusy(true);setError('');setMessage('');try{
  const r=await db.rpc('manage_timetable_rule',{p_term_id:term,p_kind:'school_break',p_weekday:1,p_period:null,p_teacher:null,p_subject:null,p_label:'',p_rule_id:id,p_delete:true});
  if(r.error)throw r.error;await loadRules(term);setMessage('ลบเงื่อนไขแล้ว');
 }catch(e){setError(e instanceof Error?e.message:'ไม่สามารถลบ');}finally{setBusy(false);}}
 const desc=(r:Rule)=>r.kind==='school_break'?'พัก/กิจกรรมโรงเรียน':r.kind==='teacher_unavailable'?'ครูไม่ว่าง: '+(profiles.find(x=>x.user_id===r.teacher_user_id)?.display_name??'ครู'):'ห้ามสอนวิชา: '+(subjects.find(s=>s.id===r.subject_id)?.name_th??'รายวิชา');
 return <main className="wichakan-page mx-auto max-w-5xl px-5 py-6"><PageHeader title="เงื่อนไขตารางสอน"/><div className="mb-4"><Link href="/academic/timetable" className="text-sm text-blue-700">← กลับไปจัดตารางสอน</Link></div>
 {error&&<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
 <div className="grid gap-4 lg:grid-cols-[360px_1fr]"><section className="ui-panel p-4"><h2 className="mb-3 font-semibold">เพิ่มเงื่อนไข</h2>
 <label className="mb-3 block text-sm">ปี / ภาคเรียน<select className="mt-1 w-full rounded-lg border p-2" value={term} onChange={e=>setTerm(e.target.value)}>{terms.map(t=><option key={t.id} value={t.id}>{years.find(y=>y.id===t.academic_year_id)?.year_be} / {t.term_no}</option>)}</select></label>
 <label className="mb-3 block text-sm">ชนิดของเงื่อนไข<select className="mt-1 w-full rounded-lg border p-2" value={kind} onChange={e=>setKind(e.target.value)}><option value="teacher_unavailable">ครูไม่ว่างคาบนี้</option><option value="subject_day_block">วิชาไม่สอนวันนี้</option><option value="school_break">พักกลางวัน / กิจกรรมรวม</option></select></label>
 <div className="mb-3 grid grid-cols-2 gap-3"><label className="text-sm">วัน<select className="mt-1 w-full rounded-lg border p-2" value={day} onChange={e=>setDay(Number(e.target.value))}>{days.map((d,i)=><option key={d} value={i+1}>{d}</option>)}</select></label>{kind!=='subject_day_block'&&<label className="text-sm">คาบ<select className="mt-1 w-full rounded-lg border p-2" value={period} onChange={e=>setPeriod(Number(e.target.value))}>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>}</div>
 {kind==='teacher_unavailable'&&<label className="mb-3 block text-sm">ครู<select className="mt-1 w-full rounded-lg border p-2" value={teacher||teachers[0]?.user_id||''} onChange={e=>setTeacher(e.target.value)}>{teachers.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>}
 {kind==='subject_day_block'&&<label className="mb-3 block text-sm">รายวิชา<select className="mt-1 w-full rounded-lg border p-2" value={subject||subjects[0]?.id||''} onChange={e=>setSubject(e.target.value)}>{subjects.map(s=><option key={s.id} value={s.id}>{s.subject_code} {s.name_th}</option>)}</select></label>}
 <label className="mb-3 block text-sm">หมายเหตุ<input className="mt-1 w-full rounded-lg border p-2" maxLength={120} value={label} onChange={e=>setLabel(e.target.value)}/></label>
 <button className="ui-primary w-full" disabled={!canWrite||busy||!term} onClick={()=>void save()}>{busy?'กำลังบันทึก':'เพิ่มเงื่อนไข'}</button><p className="mt-3 text-xs text-slate-500">คาบพักต้องกำหนดแยกในแต่ละวัน ส่วนการจำกัดวิชาแบบอนุญาตเฉพาะวันพุธ ให้ห้ามวันจันทร์ อังคาร พฤหัสบดี และศุกร์</p></section>
 <section className="ui-panel p-4"><h2 className="mb-3 font-semibold">เงื่อนไขที่บันทึก ({rules.length})</h2><div className="space-y-2">{rules.map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">{desc(r)}</p><p className="text-xs text-slate-500">{days[r.weekday_no-1]}{r.period_no?' · คาบ '+r.period_no:''}{r.label?' · '+r.label:''}</p></div>{canWrite&&<button type="button" className="text-sm text-red-700" disabled={busy} onClick={()=>void remove(r.id)}>ลบ</button>}</div>)}{rules.length===0&&<p className="text-sm text-slate-500">ยังไม่มีเงื่อนไขสำหรับภาคเรียนนี้</p>}</div></section></div></main>;
}