'use client';
import {useCallback,useEffect,useState} from 'react';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Item={id:string;kind:string;title:string;activity_year_be:number;activity_date:string|null;description:string;drive_url:string|null;target_codes:string[];owner_user_id:string;verification_status:string};
type Topic={code:string;title:string;standard_no:number};
const kinds=[['achievement','ผลงานและรางวัล'],['training','ประวัติอบรม'],['innovation','นวัตกรรม'],['learning_media','สื่อการเรียนรู้'],['learning_activity','กิจกรรมการเรียนรู้'],['plc','PLC'],['assessment_instrument','เครื่องมือวัดและประเมิน'],['project','โครงการ'],['facility','อาคาร/สภาพแวดล้อม'],['safety','ความปลอดภัย'],['other','อื่น ๆ']] as const;
export default function SarEvidencePage(){
 const [school,setSchool]=useState(''),[user,setUser]=useState(''),[isAdmin,setAdmin]=useState(false);
 const [years,setYears]=useState<Year[]>([]),[year,setYear]=useState('');
 const [items,setItems]=useState<Item[]>([]),[topics,setTopics]=useState<Topic[]>([]),[owners,setOwners]=useState<{user_id:string;name:string}[]>([]);
 const [editing,setEditing]=useState<string|null>(null),[kind,setKind]=useState('achievement'),[title,setTitle]=useState(''),[activityYear,setActivityYear]=useState('2569'),[date,setDate]=useState(''),[description,setDescription]=useState(''),[url,setUrl]=useState(''),[owner,setOwner]=useState(''),[topicCodes,setTopicCodes]=useState<string[]>([]);
 const [loading,setLoading]=useState(true),[fetching,setFetching]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{
  const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบ Supabase');
  const {data:{user:account}}=await db.auth.getUser();if(!account)throw Error('กรุณาเข้าสู่ระบบ');
  const m=await db.from('school_memberships').select('school_id,role').eq('user_id',account.id).eq('active',true).in('role',['school_admin','teacher']);
  if(m.error||!m.data?.length)throw Error('บัญชีนี้ไม่มีสิทธิ์ใช้งานคลังหลักฐาน');
  const chosen=m.data.find(x=>x.role==='school_admin')??m.data[0];const admin=chosen.role==='school_admin';
  const [y,t,ms]=await Promise.all([
   db.from('academic_years').select('id,year_be,is_active').eq('school_id',chosen.school_id).order('year_be',{ascending:false}),
   db.from('sar_target_topics').select('code,title,standard_no').order('sort_order'),
   db.from('school_memberships').select('user_id').eq('school_id',chosen.school_id).eq('active',true).in('role',['teacher','school_admin'])
  ]);
  if(y.error||t.error||ms.error)throw Error(y.error?.message||t.error?.message||ms.error?.message);
  const people=[...new Set((ms.data??[]).map(x=>x.user_id))];const profiles:{user_id:string;display_name:string|null}[]=[];
  for(let i=0;i<people.length;i+=100){const p=await db.from('profiles').select('user_id,display_name').in('user_id',people.slice(i,i+100));if(p.error)throw p.error;profiles.push(...(p.data??[]));}
  if(!active)return;
  const list=y.data as Year[];
  setSchool(chosen.school_id);setUser(account.id);setAdmin(admin);setOwner(account.id);
  setYears(list);setTopics(t.data as Topic[]);setOwners(people.map(id=>({user_id:id,name:profiles.find(p=>p.user_id===id)?.display_name??('บัญชี '+id.slice(0,8))})));
  setYear(list.find(v=>v.is_active)?.id??list[0]?.id??'');
  setActivityYear(String(list.find(v=>v.is_active)?.year_be??list[0]?.year_be??2569));
 }catch(e){if(active)setError((e as Error).message)}finally{if(active)setLoading(false)}})();return()=>{active=false}},[]);
 const reload=useCallback(async()=>{if(!school||!year)return;const db=getSupabaseBrowserClient();if(!db)return;setFetching(true);
  try{const {data,error:e}=await db.from('sar_evidence').select('id,kind,title,activity_year_be,activity_date,description,drive_url,target_codes,owner_user_id,verification_status').eq('school_id',school).eq('academic_year_id',year).order('created_at',{ascending:false});
   if(e)throw Error(e.message);setItems((data??[]) as Item[]);
  }catch(e){setError((e as Error).message)}finally{setFetching(false)}
 },[school,year]);
 useEffect(()=>{void reload()},[reload]);
 function reset(){setEditing(null);setKind('achievement');setTitle('');setDescription('');setUrl('');setDate('');setTopicCodes([]);setOwner(user);setActivityYear(String(years.find(y=>y.id===year)?.year_be??2569))}
 function edit(v:Item){setEditing(v.id);setKind(v.kind);setTitle(v.title);setDescription(v.description);setUrl(v.drive_url??'');setDate(v.activity_date??'');setTopicCodes(v.target_codes);setOwner(v.owner_user_id);setActivityYear(String(v.activity_year_be));window.scrollTo({top:0,behavior:'smooth'})}
 async function save(){if(!school||!year||!user||busy)return;
  if(!title.trim()){setError('กรุณาระบุชื่อกิจกรรม');return}
  if(url.trim()&&!/^https:\/\/drive\.google\.com\//.test(url.trim())){setError('ลิงก์ต้องเป็น Google Drive (https://drive.google.com/)');return}
  setBusy(true);setError('');setMessage('');try{
   const db=getSupabaseBrowserClient();if(!db)throw Error('ไม่พบฐานข้อมูล');
   const {error:e}=await db.rpc('sar_save_evidence',{p_id:editing,p_year:year,p_owner:owner,p_kind:kind,
    p_title:title.trim(),p_activity_year:Number(activityYear),p_activity_date:date||null,p_description:description,
    p_drive_url:url.trim(),p_topics:topicCodes});
   if(e)throw Error(e.message);reset();await reload();setMessage('บันทึกข้อมูลหลักฐานเรียบร้อย');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function remove(id:string){if(!window.confirm('ยืนยันลบข้อมูลรายการนี้ออกจากทะเบียน SAR? (ไม่ลบไฟล์ใน Google Drive)'))return;
  const db=getSupabaseBrowserClient();if(!db)return;setBusy(true);setError('');try{const {error:e}=await db.rpc('sar_delete_evidence',{p_id:id});if(e)throw Error(e.message);await reload();setMessage('ลบรายการแล้ว')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const ownerName=(id:string)=>owners.find(o=>o.user_id===id)?.name??'—';
 return <main className="wichakan-page mx-auto max-w-6xl px-4 pb-10">
  <PageHeader title="คลังผลงาน อบรม และหลักฐาน SAR" context="บันทึกหลักฐานรายบุคคล แยกประเภทและปีการศึกษา เชื่อมกับประเด็นพิจารณา"/>
  <p className="mb-4 text-sm text-slate-600">หน้านี้บันทึกข้อมูลและลิงก์ไฟล์ที่มีอยู่บน Google Drive ของโรงเรียน ยังไม่ได้อัปโหลดไฟล์หรือสร้างโฟลเดอร์ใน Drive โดยอัตโนมัติ</p>
  {error&&<p className="teacher-error mb-3" role="alert">{error}</p>}{message&&<p role="status" className="teacher-success mb-3">{message}</p>}
  {loading?<p>กำลังโหลดข้อมูล...</p>:!school?<p>ไม่พบสิทธิ์เข้าถึง</p>:<>
   <label className="mb-5 block text-sm font-semibold">ปีการศึกษา
    <select className="mt-2 block rounded-lg border border-slate-300 bg-white p-2" disabled={busy} value={year} onChange={e=>{setYear(e.target.value);reset()}}>
     {years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}
    </select>
   </label>
   <section className="mb-8 border-y border-slate-200 py-5">
    <h2 className="mb-4 text-lg font-semibold">{editing?'แก้ไขหลักฐาน':'เพิ่มหลักฐาน / กิจกรรม'}</h2>
    <div className="grid gap-4 sm:grid-cols-2">
     <label className="text-sm">ประเภท
      <select className="mt-1 block w-full rounded-lg border p-2" value={kind} onChange={e=>setKind(e.target.value)} disabled={busy}>{kinds.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
     </label>
     <label className="text-sm">ผู้รับผิดชอบ
      <select className="mt-1 block w-full rounded-lg border p-2" value={owner} onChange={e=>setOwner(e.target.value)} disabled={!isAdmin||busy}>{owners.filter(p=>isAdmin||p.user_id===user).map(p=><option key={p.user_id} value={p.user_id}>{p.name}</option>)}</select>
     </label>
     <label className="text-sm sm:col-span-2">ชื่อกิจกรรม / ผลงาน
      <input className="mt-1 block w-full rounded-lg border p-2" maxLength={250} value={title} onChange={e=>setTitle(e.target.value)} placeholder="เช่น อบรมการจัดการเรียนรู้เชิงรุก" disabled={busy}/>
     </label>
     <label className="text-sm">ปี พ.ศ. ที่ดำเนินกิจกรรม
      <input className="mt-1 block w-full rounded-lg border p-2" type="number" min={2500} max={2800} value={activityYear} onChange={e=>setActivityYear(e.target.value)} disabled={busy}/>
     </label>
     <label className="text-sm">วันที่ (ถ้ามี)
      <input className="mt-1 block w-full rounded-lg border p-2" type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/>
     </label>
     <label className="text-sm sm:col-span-2">ลิงก์ไฟล์หลักฐานบน Google Drive
      <input className="mt-1 block w-full rounded-lg border p-2" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/..." disabled={busy}/>
     </label>
     <label className="text-sm sm:col-span-2">รายละเอียด
      <textarea rows={3} className="mt-1 block w-full rounded-lg border p-2" maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} disabled={busy}/>
     </label>
     <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">เชื่อมกับหัวข้อ SAR (เลือกได้หลายรายการ)</legend>
      <div className="grid max-h-44 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">{topics.filter(x=>x.code!=='overall').map(t=><label key={t.code} className="flex items-start gap-2 text-xs">
       <input type="checkbox" checked={topicCodes.includes(t.code)} onChange={e=>setTopicCodes(v=>e.target.checked?[...v,t.code]:v.filter(c=>c!==t.code))} disabled={busy}/>
       <span><strong>{t.code}</strong> {t.title}</span></label>)}</div>
     </fieldset>
    </div>
    <div className="mt-4 flex gap-2"><button className="ui-primary" type="button" disabled={busy||!title.trim()} onClick={()=>void save()}>{busy?'กำลังบันทึก...':editing?'บันทึกการแก้ไข':'บันทึกหลักฐาน'}</button>
    {editing&&<button className="ui-secondary" type="button" onClick={reset} disabled={busy}>ยกเลิกแก้ไข</button>}</div>
   </section>
   <section><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">รายการหลักฐาน ({items.length})</h2><button type="button" className="ui-secondary" disabled={busy||fetching} onClick={()=>void reload()}>รีเฟรช</button></div>
    <div className="overflow-x-auto border-y border-slate-200"><table className="w-full min-w-[760px] text-sm">
     <thead><tr className="bg-slate-50"><th className="p-3 text-left">ประเภท / กิจกรรม</th><th className="p-3 text-left">ผู้รับผิดชอบ</th><th className="p-3">ปี</th><th className="p-3">สถานะ</th><th className="p-3 text-center">หลักฐาน</th><th className="p-3 text-right">จัดการ</th></tr></thead>
     <tbody>{items.map(v=><tr key={v.id} className="border-t border-slate-100"><td className="p-3"><span className="block text-xs text-slate-500">{kinds.find(k=>k[0]===v.kind)?.[1]??v.kind}</span><span className="font-semibold">{v.title}</span><span className="mt-1 block text-xs text-slate-500">{v.target_codes.join(', ')||'ยังไม่ผูกหัวข้อ'}</span></td>
      <td className="p-3">{ownerName(v.owner_user_id)}</td><td className="p-3 text-center">{v.activity_year_be}</td><td className="p-3 text-center">{v.verification_status==='verified'?'ตรวจแล้ว':v.verification_status==='rejected'?'ต้องแก้ไข':'ฉบับร่าง'}</td>
      <td className="p-3 text-center">{v.drive_url?<a className="text-blue-700 underline" href={v.drive_url} target="_blank" rel="noopener noreferrer">เปิด Drive</a>:'ยังไม่มีลิงก์'}</td>
      <td className="p-3 text-right"><button className="mr-3 text-blue-700 underline" disabled={busy} onClick={()=>edit(v)}>แก้ไข</button><button className="text-red-700 underline" disabled={busy} onClick={()=>void remove(v.id)}>ลบ</button></td>
     </tr>)}</tbody></table>{!items.length&&<p className="p-4 text-sm text-slate-500">ยังไม่มีข้อมูลหลักฐานปีนี้</p>}</div>
   </section>
  </>}
 </main>;
}
