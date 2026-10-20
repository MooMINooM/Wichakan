'use client';
import {useCallback,useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number};
type Publication={academic_year_id:string;term_no:number;published_at:string|null};
export default function LineResultsPage(){
 const [school,setSchool]=useState(''),[years,setYears]=useState<Year[]>([]),[publications,setPublications]=useState<Publication[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const reload=useCallback(async()=>{const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบ Supabase');
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบ');
  const {data:m,error:me}=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('active',true).eq('role','school_admin').limit(1).maybeSingle();
  if(me||!m)throw Error('ต้องเป็น Admin ของโรงเรียน');setSchool(m.school_id);
  const [y,p]=await Promise.all([db.from('academic_years').select('id,year_be').eq('school_id',m.school_id).order('year_be',{ascending:false}),db.from('line_grade_publications').select('academic_year_id,term_no,published_at').eq('school_id',m.school_id)]);
  if(y.error||p.error)throw Error(y.error?.message||p.error?.message);setYears(y.data??[]);setPublications(p.data??[]);
 },[]);
 useEffect(()=>{void reload().catch(e=>setError((e as Error).message));},[reload]);
 async function setPublished(year:string,term:number,publish:boolean){
  if(!window.confirm(publish?'ยืนยันประกาศผลการเรียนจริงผ่าน LINE สำหรับปีและภาคเรียนนี้? ตรวจสอบความครบถ้วนและความถูกต้องของคะแนนแล้วใช่หรือไม่':'ปิดการแสดงผลการเรียนของปีและภาคเรียนนี้ให้ผู้ปกครอง?'))return;
  const db=getSupabaseBrowserClient();if(!db)return;setBusy(true);setError('');setNotice('');
  try{const {error}=await db.rpc('set_line_grade_publication',{p_year:year,p_term:term,p_publish:publish});if(error)throw error;await reload();setNotice(publish?'ประกาศผลแล้ว':'ระงับการประกาศผลแล้ว');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <main className="wichakan-page"><PageHeader title="ประกาศผลการเรียนผ่าน LINE"/>
 <p className="mb-4 text-sm">ผลการเรียนจะยังไม่ปรากฏใน LINE Parent Portal จนกว่า Admin จะเปิดประกาศผลแต่ละปีและภาคเรียน การประกาศผลไม่แก้ไขคะแนนครู และสามารถระงับได้</p>
 {error&&<p className="teacher-error" role="alert">{error}</p>}{notice&&<p className="teacher-success" role="status">{notice}</p>}
 <section className="ui-panel"><h2 className="mb-3 font-semibold">ปีการศึกษาและภาคเรียน</h2><div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">ปีการศึกษา</th><th className="p-2">ภาคเรียน</th><th className="p-2">สถานะ</th><th className="p-2">จัดการ</th></tr></thead><tbody>
 {years.flatMap(y=>[1,2].map(term=>{const published=!!publications.find(p=>p.academic_year_id===y.id&&p.term_no===term&&p.published_at);return <tr key={y.id+'-'+term}><td className="p-2">{y.year_be}</td><td className="p-2 text-center">{term}</td><td className="p-2 text-center">{published?'ประกาศแล้ว':'ยังไม่ประกาศ'}</td><td className="p-2 text-center"><button disabled={busy||!school} className={published?'ui-secondary':'ui-primary'} onClick={()=>void setPublished(y.id,term,!published)}>{published?'ระงับประกาศ':'ประกาศผล'}</button></td></tr>;}))}
 </tbody></table></div><p className="mt-4 text-xs">ข้อควรระวัง: ก่อนเผยแพร่ ควรตรวจสอบว่าครูบันทึกคะแนนครบและอนุมัติผลการเรียนตามขั้นตอนของโรงเรียนแล้ว</p></section>
 </main>;
}