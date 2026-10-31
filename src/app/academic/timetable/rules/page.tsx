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
 const [term,setTerm]=useState(''),[periodCount,setPeriodCount]=useState(8),[kind,setKind]=useState('teacher_unavailable'),[day,setDay]=useState(1),[period,setPeriod]=useState(4),[teacher,setTeacher]=useState(''),[subject,setSubject]=useState(''),[label,setLabel]=useState('พักกลางวัน'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const loadRules=async(t:string)=>{if(!db||!t)return;const [r,s]=await Promise.all([db.from('timetable_rules').select('id,term_id,kind,weekday_no,period_no,teacher_user_id,subject_id,label').eq('term_id',t).order('weekday_no'),db.from('timetable_term_settings').select('periods_per_day').eq('term_id',t).maybeSingle()]);if(r.error)throw r.error;if(s.error)throw s.error;setRules(r.data??[]);setPeriodCount(s.data?.periods_per_day??8);};
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
 async function savePeriodCount(){if(!db||!term||!canWrite||busy)return;setBusy(true);setError('');setMessage('');try{const r=await db.rpc('set_timetable_period_count',{p_term_id:term,p_count:periodCount});if(r.error)throw r.error;await loadRules(term);setMessage('บันทึกจำนวนคาบต่อวันแล้ว');}catch(e){setError(e instanceof Error?e.message:'บันทึกจำนวนคาบไม่ได้');}finally{setBusy(false);}}
 async function save(){if(kind==='subject_only_day'){await addWeekdayPreset();return;}if(!db||!canWrite||!term||busy)return;setBusy(true);setError('');setMessage('');try{
  const r=await db.rpc('manage_timetable_rule',{p_term_id:term,p_kind:kind==='subject_only_day'?'subject_day_block':kind,p_weekday:day,p_period:kind==='subject_only_day'?null:period,p_teacher:kind==='teacher_unavailable'?(teacher||teachers[0]?.user_id):null,p_subject:kind==='subject_only_day'?(subject||subjects[0]?.id):null,p_label:label,p_rule_id:null,p_delete:false});
  if(r.error)throw r.error;await loadRules(term);setMessage('บันทึกเงื่อนไขเรียบร้อยแล้ว');
 }catch(e){setError(e instanceof Error?e.message:'ไม่สามารถบันทึก');}finally{setBusy(false);}}
 async function remove(id:string){if(!db||!canWrite||busy)return;setBusy(true);setError('');setMessage('');try{
  const r=await db.rpc('manage_timetable_rule',{p_term_id:term,p_kind:'school_break',p_weekday:1,p_period:null,p_teacher:null,p_subject:null,p_label:'',p_rule_id:id,p_delete:true});
  if(r.error)throw r.error;await loadRules(term);setMessage('ลบเงื่อนไขแล้ว');
 }catch(e){setError(e instanceof Error?e.message:'ไม่สามารถลบ');}finally{setBusy(false);}}
 async function addWeekdayPreset(){if(!db||!term||!canWrite||busy)return;const item=kind==='subject_only_day'?subject||subjects[0]?.id:null;if(kind==='subject_only_day'&&!item)return;setBusy(true);setError('');setMessage('');let added=0;try{
  for(const d of [1,2,3,4,5]){if(kind==='subject_only_day'&&d===day)continue;
   if(rules.some(r=>r.kind===(kind==='subject_only_day'?'subject_day_block':kind)&&r.weekday_no===d&&r.period_no===(kind==='school_break'?period:null)&&r.subject_id===(kind==='subject_only_day'?item:null)))continue;
   const result=await db.rpc('manage_timetable_rule',{p_term_id:term,p_kind:kind,p_weekday:d,p_period:kind==='school_break'?period:null,p_teacher:null,p_subject:kind==='subject_only_day'?item:null,p_label:kind==='school_break'?label:'เฉพาะวัน'+days[day-1],p_rule_id:null,p_delete:false});
   if(result.error)throw result.error;added++;
  }
  setMessage('เพิ่มเงื่อนไข '+added+' วันแล้ว');
 }catch(e){setError('เพิ่มแล้ว '+added+' วัน ก่อนพบปัญหา: '+(e instanceof Error?e.message:'บันทึกไม่ได้'));}finally{await loadRules(term);setBusy(false);}}
 const desc=(r:Rule)=>r.kind==='school_break'?'พัก/กิจกรรมโรงเรียน':r.kind==='teacher_unavailable'?'ครูไม่ว่าง: '+(profiles.find(x=>x.user_id===r.teacher_user_id)?.display_name??'ครู'):'ไม่จัดรายวิชานี้ในวัน: '+(subjects.find(s=>s.id===r.subject_id)?.name_th??'รายวิชา');
 return <main className="wichakan-page mx-auto max-w-5xl px-5 py-6"><PageHeader title="เงื่อนไขตารางสอน"/><div className="mb-4"><Link href="/academic/timetable" className="text-sm text-blue-700">← กลับไปจัดตารางสอน</Link></div>
 <section className="ui-panel mb-4 flex flex-wrap items-end gap-3 p-4"><label className="text-sm font-medium">จำนวนคาบเรียนต่อวัน<select className="mt-1 block rounded-lg border p-2" value={periodCount} onChange={e=>setPeriodCount(Number(e.target.value))}>{Array.from({length:20},(_,i)=><option value={i+1} key={i}>{i+1} คาบ</option>)}</select></label><button type="button" className="ui-primary" disabled={!canWrite||busy||!term} onClick={()=>void savePeriodCount()}>บันทึกจำนวนคาบ</button><p className="text-xs text-slate-500">ใช้กับภาคเรียนที่เลือก · ลดจำนวนคาบได้เมื่อไม่มีตารางเกิน</p></section>
 {error&&<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
 <div className="grid gap-4 lg:grid-cols-[360px_1fr]"><section className="ui-panel p-4"><h2 className="mb-3 font-semibold">เพิ่มเงื่อนไข</h2>
 <label className="mb-3 block text-sm">ปี / ภาคเรียน<select className="mt-1 w-full rounded-lg border p-2" value={term} onChange={e=>setTerm(e.target.value)}>{terms.map(t=><option key={t.id} value={t.id}>{years.find(y=>y.id===t.academic_year_id)?.year_be} / {t.term_no}</option>)}</select></label>
 <label className="mb-3 block text-sm">ชนิดของเงื่อนไข<select className="mt-1 w-full rounded-lg border p-2" value={kind} onChange={e=>setKind(e.target.value)}><option value="teacher_unavailable">ครูไม่ว่างคาบนี้</option><option value="subject_only_day">วิชาเรียนเฉพาะวันนี้</option><option value="school_break">พักกลางวัน / กิจกรรมรวม</option></select></label>
 <div className="mb-3 grid grid-cols-2 gap-3"><label className="text-sm">วัน<select className="mt-1 w-full rounded-lg border p-2" value={day} onChange={e=>setDay(Number(e.target.value))}>{days.map((d,i)=><option key={d} value={i+1}>{d}</option>)}</select></label>{kind!=='subject_only_day'&&<label className="text-sm">คาบ<select className="mt-1 w-full rounded-lg border p-2" value={period} onChange={e=>setPeriod(Number(e.target.value))}>{Array.from({length:periodCount},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>}</div>
 {kind==='teacher_unavailable'&&<label className="mb-3 block text-sm">ครู<select className="mt-1 w-full rounded-lg border p-2" value={teacher||teachers[0]?.user_id||''} onChange={e=>setTeacher(e.target.value)}>{teachers.map(p=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>}
 {kind==='subject_only_day'&&<label className="mb-3 block text-sm">รายวิชา<select className="mt-1 w-full rounded-lg border p-2" value={subject||subjects[0]?.id||''} onChange={e=>setSubject(e.target.value)}>{subjects.map(s=><option key={s.id} value={s.id}>{s.subject_code} {s.name_th}</option>)}</select></label>}
 <label className="mb-3 block text-sm">หมายเหตุ<input className="mt-1 w-full rounded-lg border p-2" maxLength={120} value={label} onChange={e=>setLabel(e.target.value)}/></label>
 {(kind==='school_break'||kind==='subject_day_block')&&<button type="button" className="ui-secondary mb-2 w-full" disabled={!canWrite||busy||!term} onClick={()=>void addWeekdayPreset()}>{kind==='school_break'?'ตั้งคาบนี้เป็นพักทุกวันจันทร์–ศุกร์':'อนุญาตวิชานี้เฉพาะวัน'+days[day-1]}</button>}<button className="ui-primary w-full" disabled={!canWrite||busy||!term} onClick={()=>void save()}>{busy?'กำลังบันทึก':'เพิ่มเงื่อนไข'}</button><p className="mt-3 text-xs text-slate-500">จำกัดรายวิชาให้สอนเฉพาะวันที่เลือก</p></section>
 <section className="ui-panel p-4"><h2 className="mb-3 font-semibold">เงื่อนไขที่บันทึก ({rules.length})</h2><div className="space-y-2">{rules.map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">{desc(r)}</p><p className="text-xs text-slate-500">{days[r.weekday_no-1]}{r.period_no?' · คาบ '+r.period_no:''}{r.label?' · '+r.label:''}</p></div>{canWrite&&<button type="button" className="text-sm text-red-700" disabled={busy} onClick={()=>void remove(r.id)}>ลบ</button>}</div>)}{rules.length===0&&<p className="text-sm text-slate-500">ยังไม่มีเงื่อนไขสำหรับภาคเรียนนี้</p>}</div></section></div></main>;
}