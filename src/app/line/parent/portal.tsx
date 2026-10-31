'use client';
import Script from 'next/script';
import {useEffect,useRef,useState} from 'react';
type Liff={init:(opts:{liffId:string})=>Promise<void>;isLoggedIn:()=>boolean;login:()=>void;getIDToken:()=>string|null};
declare global {interface Window{liff?:Liff}}
type Child={id:string;name:string;student_no:string};
type Grade={subject:string;subject_code:string;grade:string;total:number|null;state?:'ready'|'pending'};
type GpaSummary={
 gpa:number|null;gpax:number|null;period_type:'year'|'semester'|'none';
 selected_year_be:number;selected_term_no:number;
 as_of_year_be:number|null;as_of_level_code:string|null;as_of_term_no:number|null;
 completed_periods:number;is_selected_complete:boolean
};
const formatGrade=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(2):'—';
type Result={students:Child[];grades:Grade[];gpa_summary?:GpaSummary;published?:boolean;completed_count?:number;pending_count?:number;years:{id:string;year_be:number}[]};
const liffId=process.env.NEXT_PUBLIC_LINE_LIFF_ID;
// Native anchor fallback is used only when the portal is opened as a separate route.
const registerHref=(process.env.NEXT_PUBLIC_BASE_PATH??'')+'/line/register/';
export default function LineParentPortal({onAddChild}:{onAddChild?:()=>void}={}){
 const [sdk,setSdk]=useState(false),[ready,setReady]=useState(false),[data,setData]=useState<Result|null>(null),[student,setStudent]=useState(''),[year,setYear]=useState(''),[term,setTerm]=useState(2),[loading,setLoading]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const api=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const requestSequence=useRef(0);
 function clearShownGrades(){requestSequence.current++;setNotice('');setError('');setData(previous=>previous?{...previous,grades:[],gpa_summary:undefined,published:undefined}:previous);setLoading(false);}
 // The registration page has already loaded LIFF; a reused Next Script can skip onLoad.
 useEffect(()=>{if(window.liff)setSdk(true);},[]);
 useEffect(()=>{
  if(!sdk)return;
  if(!liffId){setError('ไม่ได้กำหนด LIFF ID');return;}
  if(!window.liff){setError('โหลด LINE SDK ไม่สำเร็จ กรุณาลองเปิดลิงก์ใหม่');return;}
  let mounted=true;
  window.liff.init({liffId}).then(()=>{
   if(!mounted)return;
   if(!window.liff?.isLoggedIn())window.liff?.login();
   else setReady(true);
  }).catch(()=>{if(mounted)setError('เชื่อมต่อ LINE ไม่สำเร็จ กรุณาเปิดลิงก์ใหม่ในแอป LINE');});
  return()=>{mounted=false;};
 },[sdk]);
 async function load(includeGrade:boolean){
  if(!ready)return;
  if(!api){setError('โรงเรียนยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล');return;}
  const current=++requestSequence.current;
  setLoading(true);setError('');setNotice('');
  try{
   const id_token=window.liff?.getIDToken();if(!id_token)throw Error('กรุณาเข้าสู่ระบบ LINE อีกครั้ง');
   const body:Record<string,unknown>={id_token};
   if(includeGrade){
    if(!student||!year)throw Error('กรุณาเลือกบุตรหลานและปีการศึกษา');
    body.student_id=student;body.year_id=year;body.term_no=term;
   }
   const r=await fetch(api+'/functions/v1/line-parent',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'
   });
   if(!r.ok)throw Error(r.status===401?'กรุณาปิดหน้าแล้วเปิดผ่าน LINE อีกครั้ง':'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่');
   const x=await r.json() as Result;
   if(current!==requestSequence.current)return;
   setData(x);
   if(!includeGrade)setStudent(previous=>x.students.some(s=>s.id===previous)?previous:(x.students[0]?.id??''));
   if(includeGrade&&!x.published)setNotice('โรงเรียนยังไม่เปิดประกาศผลการเรียนสำหรับปีและภาคเรียนนี้');
  }catch(e){if(current===requestSequence.current)setError((e as Error).message);}
  finally{if(current===requestSequence.current)setLoading(false);}
 }
 useEffect(()=>{if(ready)void load(false);},[ready]);
 return <main className="wichakan-page mx-auto max-w-xl px-4 py-8">
 <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" onLoad={()=>setSdk(true)} onReady={()=>setSdk(true)} onError={()=>setError("โหลด LINE SDK ไม่สำเร็จ")}/>
 <header className="mb-5"><p className="text-xs font-semibold text-blue-700">WICHAKAN · PARENT PORTAL</p><h1 className="text-2xl font-semibold">บริการข้อมูลบุตรหลาน</h1><p className="mt-1 text-sm text-slate-500">โรงเรียนบ้านภูพระโนนผักหวาน</p></header>
 {!ready&&!error&&<p className="text-sm">กำลังเชื่อมต่อ LINE...</p>}
 {error&&<p role="alert" className="teacher-error">{error} <button type="button" className="underline ml-2" onClick={()=>void load(false)}>ลองใหม่</button></p>}
 {ready&&!data&&!error&&<p role="status" className="text-sm">กำลังโหลดรายชื่อบุตรหลาน...</p>}
 {ready&&<><section className="ui-panel mb-4"><h2 className="font-semibold mb-3">บุตรหลานที่ได้รับอนุมัติ</h2>
  {data?.students.length===0?<p className="text-sm">ยังไม่มีบุตรหลานที่ได้รับอนุมัติจากโรงเรียน</p>:data?.students.map(s=><label key={s.id} className="mb-2 flex gap-3 items-center border-b py-2"><input type="radio" name="student" checked={student===s.id} onChange={()=>{setStudent(s.id);clearShownGrades();}}/><span>{s.name}<span className="block text-xs text-slate-500">เลขประจำตัวนักเรียน {s.student_no}</span></span></label>)}
  <button type="button" className="ui-secondary mt-3 mr-2" disabled={loading} onClick={()=>void load(false)}>↻ โหลดข้อมูลล่าสุด</button>
  {onAddChild?<button type="button" className="ui-secondary mt-3" onClick={onAddChild}>+ เพิ่มบุตรหลาน</button>:<a href={registerHref} className="ui-secondary mt-3 inline-block">+ เพิ่มบุตรหลาน</a>}
 </section>
 {data?.students.length? <section className="ui-panel"><h2 className="font-semibold mb-3">ตรวจสอบผลการเรียน</h2><p className="mb-2 text-xs text-slate-500">แสดงผลเฉพาะรายการที่โรงเรียนประกาศแล้ว</p><label className="block mb-3">ปีการศึกษา<select className="block w-full border p-2 mt-1" value={year} onChange={e=>{setYear(e.target.value);clearShownGrades();}}><option value="">เลือกปีการศึกษา</option>{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label><label className="block mb-3">ภาคเรียน<select className="block w-full border p-2 mt-1" value={term} onChange={e=>{setTerm(Number(e.target.value));clearShownGrades();}}><option value={1}>ภาคเรียนที่ 1</option><option value={2}>ภาคเรียนที่ 2</option></select></label><button className="ui-primary" disabled={loading||!student||!year} onClick={()=>void load(true)}>{loading?'กำลังโหลด...':'ดูผลการเรียน'}</button>
  {notice&&<p className="mt-3 text-sm" role="status">{notice}</p>}
  <p className="mt-3 text-xs text-slate-500">ประถมภาค 1: คะแนนระหว่างปีเต็ม 50 · มัธยม: คะแนนรายภาคเต็ม 100</p>
  {data?.published&&<div className="mt-4">
   <p role="status" className="mb-3 text-sm font-medium">โรงเรียนเปิดประกาศผลแล้ว · มีผลการเรียน {data.completed_count??0} รายวิชา · รอผล {data.pending_count??0} รายวิชา</p>
   {data.gpa_summary&&<section aria-label="สรุป GPA และ GPAX" className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 className="mb-3 text-sm font-semibold text-slate-800">สรุปผลการเรียนเฉลี่ย</h3>
    <div className="grid grid-cols-2 gap-3">
     <div className="rounded-lg bg-white p-3">
      <p className="text-xs text-slate-600">GPA {data.gpa_summary.period_type==='year'?'รายปี':'ภาคเรียนที่ '+term}</p>
      <strong className="mt-1 block text-2xl font-semibold tabular-nums">{formatGrade(data.gpa_summary.gpa)}</strong>
      <p className="mt-1 text-xs text-slate-500">{data.gpa_summary.is_selected_complete?'ผลการเรียนครบแล้ว':data.gpa_summary.period_type==='year'&&term===1?'รอผลรายปีหลังภาคเรียนที่ 2':'ผลการเรียนยังไม่ครบ'}</p>
     </div>
     <div className="rounded-lg bg-white p-3">
      <p className="text-xs text-slate-600">GPAX สะสม</p>
      <strong className="mt-1 block text-2xl font-semibold tabular-nums">{formatGrade(data.gpa_summary.gpax)}</strong>
      <p className="mt-1 text-xs text-slate-500">{data.gpa_summary.gpax!==null&&data.gpa_summary.as_of_year_be?
       'สะสมถึง '+(data.gpa_summary.as_of_level_code??'')+
       (data.gpa_summary.period_type==='year'?' ปีการศึกษา ':' ภาคเรียนที่ '+data.gpa_summary.as_of_term_no+' ปีการศึกษา ')+
       data.gpa_summary.as_of_year_be:
       'ยังไม่มีผลครบสำหรับคำนวณ'}</p>
     </div>
    </div>
    <p className="mt-3 text-xs text-slate-500">GPA และ GPAX ใช้เฉพาะปีหรือภาคเรียนที่มีผลครบ</p>
   </section>}
   <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr><th className="p-2 text-left">รายวิชา</th><th className="p-2 text-center">คะแนน</th><th className="p-2 text-center">ผลการเรียน</th></tr></thead>
    <tbody>{data.grades.map((g,i)=><tr className="border-t" key={g.subject_code+'-'+i}>
     <td className="p-2">{g.subject}</td>
     <td className="p-2 text-center">{g.state==='pending'?'—':g.total??'—'}</td>
     <td className="p-2 text-center">{g.state==='pending'?'รอผล':g.grade}</td>
    </tr>)}</tbody>
   </table></div>
   {data.grades.length===0&&<p className="text-sm">ยังไม่มีรายวิชาที่เปิดสอนสำหรับภาคเรียนนี้</p>}
   {(data.pending_count??0)>0&&<p className="mt-2 text-xs text-slate-500">“รอผล” หมายถึงผลการเรียนยังไม่ครบ</p>}
  </div>}
 </section>:null}</>}
 </main>;
}
