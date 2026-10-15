'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Offering={id:string;classroom_id:string;subject_id:string;term_id:string};
type Room={id:string;level_code:string;room_code:string;academic_year_id:string};
type Subject={id:string;subject_code:string;name_th:string};
type Year={id:string;year_be:number};
type Term={id:string;academic_year_id:string;term_no:number};
type Student={id:string;student_no:string;first_name_th:string;last_name_th:string};
type RecordScore={student_id:string;term1_coursework:number|null;term1_midterm:number|null;term1_final:number|null;term2_coursework:number|null;term2_midterm:number|null;term2_final:number|null;special_result:string|null;is_complete:boolean};
type Setting={subject_id:string;academic_year_id:string;term1_coursework:number;term1_midterm:number;term1_final:number;term2_coursework:number;term2_midterm:number;term2_final:number};
const fields=['term1_coursework','term1_midterm','term1_final','term2_coursework','term2_midterm','term2_final'] as const;
const headings=['เก็บ 1','กลางภาค 1','ปลายภาค 1','เก็บ 2','กลางภาค 2','ปลายภาค 2'];
type Draft={values:string[];special:string;dirty:boolean;complete:boolean};
const grade=(p:number)=>p>=80?'4':p>=75?'3.5':p>=70?'3':p>=65?'2.5':p>=60?'2':p>=55?'1.5':p>=50?'1':'0';
export default function TeacherScoresPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [offerings,setOfferings]=useState<Offering[]>([]),[rooms,setRooms]=useState<Room[]>([]),[subjects,setSubjects]=useState<Subject[]>([]),[years,setYears]=useState<Year[]>([]),[terms,setTerms]=useState<Term[]>([]),[settings,setSettings]=useState<Setting[]>([]);
 const [selected,setSelected]=useState(''),[students,setStudents]=useState<Student[]>([]),[drafts,setDrafts]=useState<Record<string,Draft>>({});
 const [loading,setLoading]=useState(true),[busyId,setBusyId]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let live=true;(async()=>{if(!db){setError('ยังไม่เชื่อม Supabase');setLoading(false);return;}
 const {data:{user}}=await db.auth.getUser();if(!user){router.replace('/login');return;}
 const roles=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','teacher').eq('active',true);
 if(!live)return;if(roles.error||!roles.data?.length){setError('ไม่พบบทบาทครูผู้สอน');setLoading(false);return;}
 const school=roles.data[0].school_id;
 const [a,r,s,y,t,c]=await Promise.all([
 db.from('teaching_assignments').select('course_offering_id').eq('school_id',school).eq('teacher_user_id',user.id),
 db.from('classrooms').select('id,level_code,room_code,academic_year_id').eq('school_id',school),
 db.from('subjects').select('id,subject_code,name_th').eq('school_id',school),
 db.from('academic_years').select('id,year_be').eq('school_id',school).order('year_be',{ascending:false}),
 db.from('terms').select('id,academic_year_id,term_no').eq('school_id',school),
 db.from('subject_score_settings').select('*').eq('school_id',school)
 ]);
 if(!live)return;const issue=[a.error,r.error,s.error,y.error,t.error,c.error].find(Boolean);
 if(issue){setError(issue.message);setLoading(false);return;}
 const ids=(a.data??[]).map(x=>x.course_offering_id);
 const o=ids.length?await db.from('course_offerings').select('id,classroom_id,subject_id,term_id').in('id',ids).eq('school_id',school):{data:[] as Offering[],error:null};
 if(!live)return;if(o.error){setError(o.error.message);setLoading(false);return;}
 setOfferings(o.data??[]);setRooms(r.data??[]);setSubjects(s.data??[]);setYears(y.data??[]);setTerms(t.data??[]);setSettings(c.data??[]);
 setSelected(o.data?.[0]?.id??'');setLoading(false);
 })();return()=>{live=false;};},[db,router]);
 useEffect(()=>{let live=true;(async()=>{
 setStudents([]);setDrafts({});setError('');setNotice('');
 if(!db||!selected)return;const o=offerings.find(x=>x.id===selected);if(!o)return;
 const room=rooms.find(r=>r.id===o.classroom_id);if(!room)return;
 const en=await db.from('enrollments').select('student_id').eq('classroom_id',room.id).eq('academic_year_id',room.academic_year_id).in('status',['active','completed']);
 if(!live)return;if(en.error){setError(en.error.message);return;}
 const ids=(en.data??[]).map(e=>e.student_id);
 if(!ids.length)return;
 const [s,records]=await Promise.all([
 db.from('students').select('id,student_no,first_name_th,last_name_th').in('id',ids).order('student_no'),
 db.from('student_course_scores').select('student_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final,special_result,is_complete').eq('course_offering_id',selected)
 ]);
 if(!live)return;if(s.error||records.error){setError(s.error?.message??records.error?.message??'อ่านคะแนนไม่สำเร็จ');return;}
 setStudents(s.data??[]);
 const mapped:Record<string,Draft>={};
 for(const st of s.data??[]){const v=(records.data??[]).find(x=>x.student_id===st.id) as RecordScore|undefined;mapped[st.id]={values:fields.map(f=>v?.[f]==null?'':String(v[f])),special:v?.special_result??'',dirty:false,complete:v?.is_complete??false};}
 setDrafts(mapped);
 })();return()=>{live=false;};},[db,selected,offerings,rooms]);
 const o=offerings.find(o=>o.id===selected),room=rooms.find(r=>r.id===o?.classroom_id),term=terms.find(t=>t.id===o?.term_id),year=years.find(y=>y.id===term?.academic_year_id);
 const setting=settings.find(s=>s.subject_id===o?.subject_id&&s.academic_year_id===term?.academic_year_id);
 const caps=setting?fields.map(f=>setting[f]):[];
 const roomName=room?(room.room_code.startsWith(room.level_code+'/')?room.room_code:room.level_code+'/'+room.room_code):'—';
 function update(id:string,change:(d:Draft)=>Draft){setDrafts(old=>({...old,[id]:change(old[id])}));setNotice('');}
 async function saveRow(id:string){
 const d=drafts[id];if(!db||!o||!setting||!d||busyId)return;
 const nums=d.values.map(v=>v.trim()===''?null:Number(v));
 if(nums.some((v,i)=>v!==null&&(!Number.isInteger(v)||v<0||v>caps[i]))){setError('กรุณาตรวจคะแนนให้เป็นจำนวนเต็ม ไม่ติดลบและไม่เกินคะแนนเต็ม');return;}
 setBusyId(id);setError('');setNotice('');
 const {error:e}=await db.rpc('save_student_course_score',{p_offering_id:o.id,p_student_id:id,p_scores:nums,p_special:d.special||null});
 if(e)setError(e.message);else{const complete=!!d.special||nums.every(n=>n!==null);update(id,old=>({...old,dirty:false,complete}));setNotice('บันทึกคะแนนสำเร็จ');}
 setBusyId('');
 }
 const filled=students.filter(s=>drafts[s.id]?.complete&&!drafts[s.id]?.dirty).length;
 return <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
 <Link href="/teacher" className="text-sm font-semibold text-blue-700">← งานสอนของฉัน</Link>
 <header className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 p-5"><h1 className="text-2xl font-extrabold text-blue-950">บันทึกคะแนนรายวิชา</h1><p className="mt-1 text-sm text-slate-600">คะแนนเก็บ กลางภาค และปลายภาคของทั้งสองภาคเรียน ระบบคำนวณคะแนนรวมและเกรดโดยอัตโนมัติ</p></header>
 {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
 {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
 {loading?<p className="mt-5 text-sm">กำลังโหลดงานสอน...</p>:<section className="mt-4 rounded-2xl border bg-white p-4">
 <label className="block text-sm font-semibold">เลือกวิชาและห้องเรียน<select className="mt-2 w-full rounded-xl border p-3" value={selected} onChange={e=>{if(Object.values(drafts).some(d=>d.dirty)&&!window.confirm('มีคะแนนที่ยังไม่บันทึก ยืนยันเปลี่ยนวิชา?'))return;setSelected(e.target.value);}}><option value="">เลือกรายวิชา</option>{offerings.map(x=>{const rr=rooms.find(r=>r.id===x.classroom_id),tt=terms.find(t=>t.id===x.term_id),yy=years.find(y=>y.id===tt?.academic_year_id),sub=subjects.find(s=>s.id===x.subject_id);return <option key={x.id} value={x.id}>{sub?.subject_code} {sub?.name_th} · {rr?.level_code}/{rr?.room_code} · ปี {yy?.year_be} ภาคเรียน {tt?.term_no}</option>;})}</select></label>
 {o&&<p className="mt-3 text-sm text-slate-500">ห้อง {roomName} · ปี {year?.year_be??'—'} · ภาคเรียนที่เปิดสอน {term?.term_no??'—'} · บันทึกครบ {filled}/{students.length} คน</p>}
 </section>}
 {o&&!setting&&<p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Admin ยังไม่ได้ตั้งค่าโครงสร้างคะแนนรายวิชานี้ กรุณาติดต่อผู้ดูแลระบบ</p>}
 {o&&setting&&<section className="mt-4 rounded-2xl border bg-white p-3 shadow-sm">
 <p className="mb-3 text-xs text-slate-500">ช่องว่างหมายถึงยังไม่ได้กรอก (ไม่ใช่ 0) · ผลพิเศษ ร/มส ใช้แทนเกรดตัวเลข · บันทึกทีละแถวเพื่อป้องกันข้อมูลหาย</p>
 <div className="max-h-[65vh] overflow-auto">
 <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-left text-xs">
 <thead className="sticky top-0 z-20 bg-blue-50 text-blue-950"><tr><th rowSpan={2} className="sticky left-0 z-30 border bg-blue-50 p-2">รหัส / นักเรียน</th><th colSpan={4} className="border p-2 text-center">ภาคเรียนที่ 1 ({caps.slice(0,3).reduce((a,b)=>a+b,0)})</th><th colSpan={4} className="border p-2 text-center">ภาคเรียนที่ 2 ({caps.slice(3).reduce((a,b)=>a+b,0)})</th><th rowSpan={2} className="border p-2 text-center">รวม /100</th><th rowSpan={2} className="border p-2 text-center">เกรด</th><th rowSpan={2} className="border p-2 text-center">หมายเหตุ</th><th rowSpan={2} className="border p-2 text-center">บันทึก</th></tr><tr>{headings.slice(0,3).map((h,i)=><th key={h} className="border p-2 text-center">{h}<br/>เต็ม {caps[i]}</th>)}<th className="border p-2">รวม 1</th>{headings.slice(3).map((h,i)=><th key={h} className="border p-2 text-center">{h}<br/>เต็ม {caps[i+3]}</th>)}<th className="border p-2">รวม 2</th></tr></thead>
 <tbody>{students.map(st=>{const d=drafts[st.id];if(!d)return null;const n=d.values.map(x=>x.trim()===''?null:Number(x));const valid=n.every((x,i)=>x===null||(Number.isInteger(x)&&x>=0&&x<=caps[i]));const complete=n.every(x=>x!==null);const term1=n.slice(0,3).every(x=>x!==null)?n.slice(0,3).reduce<number>((a,b)=>a+(b??0),0):null;const term2=n.slice(3).every(x=>x!==null)?n.slice(3).reduce<number>((a,b)=>a+(b??0),0):null;const total=term1!==null&&term2!==null?term1+term2:null;return <tr key={st.id} className="hover:bg-blue-50/30">
 <td className="sticky left-0 z-10 min-w-[195px] border-b bg-white p-2"><strong>{st.student_no}</strong><div className="mt-1">{st.first_name_th} {st.last_name_th}</div></td>
 {n.slice(0,3).map((v,i)=><td key={i} className="border-b p-1"><input aria-label={headings[i]+' '+st.student_no} type="number" min="0" max={caps[i]} value={d.values[i]} onChange={e=>update(st.id,old=>({...old,values:old.values.map((s,j)=>j===i?e.target.value:s),dirty:true}))} className="w-16 rounded-lg border px-2 py-2"/></td>)}<td className="border-b bg-blue-50/40 p-2 font-bold">{term1??'—'}</td>
 {n.slice(3).map((v,i)=><td key={i} className="border-b p-1"><input aria-label={headings[i+3]+' '+st.student_no} type="number" min="0" max={caps[i+3]} value={d.values[i+3]} onChange={e=>update(st.id,old=>({...old,values:old.values.map((s,j)=>j===i+3?e.target.value:s),dirty:true}))} className="w-16 rounded-lg border px-2 py-2"/></td>)}<td className="border-b bg-blue-50/40 p-2 font-bold">{term2??'—'}</td>
 <td className="border-b p-2 font-bold text-blue-800">{total??'—'}</td><td className="border-b p-2 font-bold">{d.special|| (total===null?'—':grade(total))}</td>
 <td className="border-b p-1"><select aria-label={'หมายเหตุ '+st.student_no} value={d.special} onChange={e=>update(st.id,old=>({...old,special:e.target.value,dirty:true}))} className="rounded-lg border p-2"><option value="">ปกติ</option><option value="ร">ร</option><option value="มส">มส</option></select></td>
 <td className="border-b p-1"><button disabled={!valid||!!busyId||!d.dirty} onClick={()=>saveRow(st.id)} className="rounded-lg bg-blue-700 px-3 py-2 text-white disabled:opacity-40">{busyId===st.id?'บันทึก...':d.dirty?'บันทึก':'บันทึกแล้ว'}</button></td></tr>;})}</tbody>
 </table></div>
 {!students.length&&<p className="p-6 text-center text-sm text-slate-500">ไม่มีนักเรียนในห้องที่เลือก</p>}
 </section>}
 </main>;
}