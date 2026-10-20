'use client';
import Script from 'next/script';
import {useEffect,useState} from 'react';
type Liff={init:(opts:{liffId:string})=>Promise<void>;isLoggedIn:()=>boolean;login:()=>void;getIDToken:()=>string|null};
declare global {interface Window{liff?:Liff}}
type Child={id:string;name:string;student_no:string};
type Grade={subject:string;subject_code:string;grade:string;total:number|null};
type Result={students:Child[];grades:Grade[];published?:boolean;years:{id:string;year_be:number}[]};
const liffId=process.env.NEXT_PUBLIC_LINE_LIFF_ID;
// Next.js Link automatically prepends the configured basePath on GitHub Pages.
export default function LineParentPage({onAddChild}:{onAddChild?:()=>void}={}){
 const [sdk,setSdk]=useState(false),[ready,setReady]=useState(false),[data,setData]=useState<Result|null>(null),[student,setStudent]=useState(''),[year,setYear]=useState(''),[term,setTerm]=useState(2),[loading,setLoading]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const api=process.env.NEXT_PUBLIC_SUPABASE_URL;
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
 async function load(includeGrade:boolean){if(!ready||!api)return;setLoading(true);setError('');setNotice('');try{
  const id_token=window.liff?.getIDToken();if(!id_token)throw Error('กรุณาเข้าสู่ระบบ LINE อีกครั้ง');
  const body:Record<string,unknown>={id_token};
  if(includeGrade){if(!student||!year)throw Error('กรุณาเลือกบุตรและกรอกปีการศึกษา พ.ศ. ให้ถูกต้อง');body.student_id=student;body.year_id=year;body.term_no=term;}
  const r=await fetch(api+'/functions/v1/line-parent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw Error('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่');
  const x=await r.json() as Result;setData(x);
  if(includeGrade&&!x.published)setNotice('โรงเรียนยังไม่เปิดประกาศผลการเรียนสำหรับปีและภาคเรียนนี้');
 }catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{if(ready)void load(false);},[ready]);
 return <main className="wichakan-page mx-auto max-w-xl px-4 py-8">
 <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" onLoad={()=>setSdk(true)} onReady={()=>setSdk(true)} onError={()=>setError("โหลด LINE SDK ไม่สำเร็จ")}/>
 <header className="mb-5"><p className="text-xs font-semibold text-blue-700">WICHAKAN · PARENT PORTAL</p><h1 className="text-2xl font-semibold">บริการข้อมูลบุตรหลาน</h1><p className="mt-1 text-sm text-slate-500">โรงเรียนบ้านภูพระโนนผักหวาน</p></header>
 {!ready&&!error&&<p className="text-sm">กำลังเชื่อมต่อ LINE...</p>}
 {error&&<p role="alert" className="teacher-error">{error}</p>}
 {ready&&<><section className="ui-panel mb-4"><h2 className="font-semibold mb-3">บุตรหลานที่ได้รับอนุมัติ</h2>
  {data?.students.length===0?<p className="text-sm">ยังไม่มีบุตรหลานที่ได้รับอนุมัติจากโรงเรียน</p>:data?.students.map(s=><label key={s.id} className="mb-2 flex gap-3 items-center border-b py-2"><input type="radio" name="student" checked={student===s.id} onChange={()=>{setStudent(s.id);setData(d=>d?{...d,grades:[],published:undefined}:d);}}/><span>{s.name}<span className="block text-xs text-slate-500">เลขประจำตัวนักเรียน {s.student_no}</span></span></label>)}
  {onAddChild?<button type="button" className="ui-secondary mt-3" onClick={onAddChild}>+ เพิ่มบุตรหลาน</button>:<a href={registerHref} className="ui-secondary mt-3 inline-block">+ เพิ่มบุตรหลาน</a>}
 </section>
 {data?.students.length? <section className="ui-panel"><h2 className="font-semibold mb-3">ตรวจสอบผลการเรียน</h2><p className="mb-2 text-xs text-slate-500">แสดงผลเฉพาะรายการที่โรงเรียนประกาศแล้ว</p><label className="block mb-3">ปีการศึกษา<select className="block w-full border p-2 mt-1" value={year} onChange={e=>setYear(e.target.value)}><option value="">เลือกปีการศึกษา</option>{data.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label><label className="block mb-3">ภาคเรียน<select className="block w-full border p-2 mt-1" value={term} onChange={e=>setTerm(Number(e.target.value))}><option value={1}>ภาคเรียนที่ 1</option><option value={2}>ภาคเรียนที่ 2</option></select></label><button className="ui-primary" disabled={loading||!student||!year} onClick={()=>void load(true)}>{loading?'กำลังโหลด...':'ดูผลการเรียน'}</button>
  {notice&&<p className="mt-3 text-sm" role="status">{notice}</p>}
  {data?.published&&<div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">รายวิชา</th><th className="p-2">คะแนน</th><th className="p-2">เกรด</th></tr></thead><tbody>{data.grades.map((g,i)=><tr key={g.subject_code+'-'+i}><td className="p-2">{g.subject}</td><td className="p-2 text-center">{g.total??'—'}</td><td className="p-2 text-center">{g.grade}</td></tr>)}</tbody></table>{data.grades.length===0&&<p className="text-sm">ยังไม่มีคะแนนที่ครบถ้วนสำหรับแสดงผล</p>}</div>}
 </section>:null}</>}
 </main>;
}
