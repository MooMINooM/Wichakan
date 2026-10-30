'use client';
import {useCallback,useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';

type Year={id:string;year_be:number};
type Publication={academic_year_id:string;term_no:number;published_at:string|null};
type Readiness={ready:boolean;expected:number;completed:number;missing:number;incomplete:number;duplicate:number;invalid:number;reason?:string};
const key=(id:string,term:number)=>id+':'+term;
export default function LineResultsPage(){
 const [years,setYears]=useState<Year[]>([]),[publications,setPublications]=useState<Publication[]>([]),
 [status,setStatus]=useState<Record<string,Readiness>>({}),[loading,setLoading]=useState(true),
 [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const reload=useCallback(async()=>{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล Supabase');
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)throw Error('กรุณาเข้าสู่ระบบ Admin');
  const {data:membership,error:memberError}=await db.from('school_memberships')
   .select('school_id').eq('user_id',user.id).eq('active',true).eq('role','school_admin').limit(1).maybeSingle();
  if(memberError||!membership)throw Error('บัญชีนี้ไม่มีสิทธิ์ประกาศผลการเรียน');
  const [y,p]=await Promise.all([
   db.from('academic_years').select('id,year_be').eq('school_id',membership.school_id).order('year_be',{ascending:false}),
   db.from('line_grade_publications').select('academic_year_id,term_no,published_at').eq('school_id',membership.school_id)
  ]);
  if(y.error||p.error)throw Error(y.error?.message||p.error?.message);
  const list=(y.data??[]) as Year[];
  const summaries=await Promise.all(list.flatMap(y=>[1,2].map(async term=>{
   const result=await db.rpc('line_grade_publication_readiness',{p_year:y.id,p_term:term});
   if(result.error)throw Error(result.error.message);
   return {id:key(y.id,term),readiness:result.data as Readiness};
  })));
  setYears(list);setPublications(p.data??[]);setStatus(Object.fromEntries(summaries.map(s=>[s.id,s.readiness])));
 },[]);
 useEffect(()=>{
  let mounted=true;setLoading(true);
  void reload().catch(e=>{if(mounted)setError((e as Error).message);})
   .finally(()=>{if(mounted)setLoading(false);});
  return()=>{mounted=false;};
 },[reload]);
 async function setPublished(year:string,term:number,publish:boolean){
  const info=status[key(year,term)];
  const prompt=publish?
   'ยืนยันประกาศผลการเรียนผ่าน LINE?'+
   (info&&!info.ready?'\\n\\nคะแนนครบแล้ว '+info.completed+'/'+info.expected+' รายการ — รายวิชาที่ยังไม่ครบจะแสดง “รอผล” และไม่เผยแพร่คะแนนที่ไม่สมบูรณ์':'')+
   '\\n\\nการบันทึกคะแนนเพิ่มเติมจะปรากฏแก่ผู้ปกครองที่ได้รับสิทธิ์เมื่อกดดูผลใหม่' :
   'ยืนยันระงับการเผยแพร่ผลการเรียนภาคเรียนนี้ทาง LINE?';
  if(!window.confirm(prompt))return;
  const db=getSupabaseBrowserClient();if(!db)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {error:rpcError}=await db.rpc('set_line_grade_publication',{p_year:year,p_term:term,p_publish:publish});
   if(rpcError)throw Error(rpcError.message);
   await reload();
   setNotice(publish?'เปิดประกาศผลผ่าน LINE แล้ว รายวิชาที่ยังไม่ครบจะแสดง “รอผล”':'ระงับประกาศผลผ่าน LINE สำเร็จแล้ว');
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function refresh(){setLoading(true);setError('');setNotice('');try{await reload();setNotice('ตรวจสอบความพร้อมล่าสุดแล้ว');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 return <main className="wichakan-page">
  <PageHeader title="ตรวจสอบและประกาศผลการเรียนผ่าน LINE"/>
  <p className="mb-4 text-sm">Admin สามารถประกาศผลการเรียนบางส่วนได้ แม้ครูยังบันทึกคะแนนไม่ครบ โดยผู้ปกครองเห็นคะแนนเฉพาะรายวิชาที่มีผลถูกต้องครบแล้ว ส่วนที่เหลือแสดง “รอผล” เมื่อประกาศแล้ว LINE OA จะแสดง GPA รายปีของประถม (เฉพาะผลรายปีที่ครบหลังภาค 2) หรือ GPA รายภาคเรียนของมัธยม พร้อม GPAX สะสมถึงช่วงที่มีผลสมบูรณ์ โดยยังไม่เปิดค่าเฉลี่ยที่ผลไม่ครบ คะแนน ป.1–ป.6 ภาคเรียนที่ 1 เต็ม 50 และมัธยมคิดเกรดแยกภาคเรียนเต็ม 100</p>
  {error&&<p role="alert" className="teacher-error mb-3">{error}</p>}
  {notice&&<p role="status" className="teacher-success mb-3">{notice}</p>}
  <section className="ui-panel">
   <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
    <h2 className="font-semibold">ความครบถ้วนของคะแนนและการประกาศผล</h2>
    <button type="button" className="ui-secondary" disabled={loading||busy} onClick={()=>void refresh()}>{loading?'กำลังตรวจสอบ...':'ตรวจสอบความพร้อมใหม่'}</button>
   </div>
   {loading&&<p role="status" className="text-sm">กำลังตรวจสอบคะแนนและรายวิชา...</p>}
   {!loading&&years.length===0&&<p className="text-sm">ยังไม่มีปีการศึกษา</p>}
   <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr><th className="text-left p-2">ปี / ภาคเรียน</th><th className="text-left p-2">ตรวจสอบคะแนน</th><th className="p-2">สถานะประกาศ</th><th className="p-2">จัดการ</th></tr></thead>
    <tbody>{years.flatMap(y=>[1,2].map(term=>{
     const info=status[key(y.id,term)],published=!!publications.find(p=>p.academic_year_id===y.id&&p.term_no===term&&p.published_at);
     return <tr key={key(y.id,term)} className="border-t">
      <td className="p-2 font-medium">{y.year_be} · ภาคเรียนที่ {term}</td>
      <td className="p-2">{!info?'—':info.reason==='term_missing'?'ยังไม่ได้สร้างภาคเรียน':
       <div>
        <span className={info.ready?'text-green-700 font-semibold':'font-semibold'}>{info.ready?'คะแนนครบทั้งหมด':'คะแนนยังไม่ครบ'}</span>
        <span className="block text-xs text-slate-600">ครบ {info.completed}/{info.expected} รายการรายวิชา-นักเรียน</span>
        {!info.ready&&<span className="block text-xs text-slate-600">ไม่มีคะแนน {info.missing} · ไม่ครบ {info.incomplete} · ซ้ำ {info.duplicate} · ไม่ถูกต้อง {info.invalid}</span>}
       </div>}</td>
      <td className="text-center p-2">{published?'ประกาศแล้ว':'ยังไม่ประกาศ'}</td>
      <td className="text-center p-2"><button type="button" disabled={busy||loading} className={published?'ui-secondary':'ui-primary'} onClick={()=>void setPublished(y.id,term,!published)}>{published?'ระงับประกาศ':'ประกาศผล'}</button></td>
     </tr>;
    }))}</tbody>
   </table></div>
   <p className="mt-4 text-xs text-slate-600">สามารถเปิดประกาศได้แม้คะแนนไม่ครบ รายวิชาที่ไม่มีคะแนนหรือผลไม่ถูกต้องจะถูกซ่อนคะแนนและแสดง “รอผล” การแก้ไขคะแนนหลังประกาศจะแสดงผลเมื่อผู้ปกครองโหลดใหม่ โปรดตรวจสอบข้อมูลก่อนเผยแพร่</p>
  </section>
 </main>;
}
