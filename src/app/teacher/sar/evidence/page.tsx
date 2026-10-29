'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
type Year={id:string;year_be:number;is_active:boolean};
type Topic={code:string;title:string;standard_no:number;sort_order:number};
type RecordItem={id:string;kind:string;title:string;activity_year_be:number;activity_date:string|null;description:string;target_codes:string[];storage_path:string|null;drive_url:string|null;verification_status:string;created_at:string};
const kinds:{key:string;label:string}[]=[
 {key:'achievement',label:'ผลงานและรางวัล'},{key:'training',label:'ประวัติการอบรมและพัฒนา'},
 {key:'innovation',label:'นวัตกรรมและโครงงาน'},{key:'learning_media',label:'สื่อการสอน'},
 {key:'learning_activity',label:'กิจกรรมการจัดการเรียนรู้'},{key:'plc',label:'PLC / แลกเปลี่ยนเรียนรู้'},
 {key:'assessment_instrument',label:'เครื่องมือวัดผล'},{key:'project',label:'โครงการโรงเรียน'},
 {key:'facility',label:'อาคารและสิ่งแวดล้อม'},{key:'safety',label:'ความปลอดภัย'},{key:'other',label:'หลักฐานอื่น'}
];
const statusLabel:Record<string,string>={draft:'รอการรับรอง',verified:'รับรองแล้ว',rejected:'ต้องแก้ไข'};
const bucket='wichakan-sar';
export default function SarEvidencePage(){
 const db=getSupabaseBrowserClient();
 const [uid,setUid]=useState(''),[school,setSchool]=useState(''),[years,setYears]=useState<Year[]>([]),[year,setYear]=useState(''),[topics,setTopics]=useState<Topic[]>([]);
 const [records,setRecords]=useState<RecordItem[]>([]),[kind,setKind]=useState('achievement'),[name,setName]=useState(''),[activityYear,setActivityYear]=useState('2569'),
 [date,setDate]=useState(''),[description,setDescription]=useState(''),[codes,setCodes]=useState<string[]>([]),[drive,setDrive]=useState(''),
 [file,setFile]=useState<File|null>(null),[editing,setEditing]=useState<string|null>(null),[loading,setLoading]=useState(true),
 [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const style='w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
 useEffect(()=>{let live=true;(async()=>{try{
  if(!db)throw Error('ยังไม่ได้ตั้งค่าฐานข้อมูล');
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('กรุณาเข้าสู่ระบบ');
  const m=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('active',true).in('role',['teacher','school_admin']).limit(1).maybeSingle();
  if(m.error||!m.data)throw Error('ไม่มีสิทธิ์บันทึกหลักฐาน');
  const sid=m.data.school_id as string;
  const [y,t]=await Promise.all([db.from('academic_years').select('id,year_be,is_active').eq('school_id',sid).order('year_be',{ascending:false}),
  db.from('sar_target_topics').select('code,title,standard_no,sort_order').order('sort_order')]);
  if(y.error||t.error)throw Error(y.error?.message||t.error?.message);
  if(!live)return;
  const list=y.data as Year[];const current=list.find(y=>y.is_active)??list[0];
  setUid(user.id);setSchool(sid);setYears(list);setYear(current?.id??'');setActivityYear(String(current?.year_be??2569));setTopics(t.data as Topic[]);
 }catch(e){if(live)setError(e instanceof Error?e.message:'โหลดข้อมูลไม่สำเร็จ');}finally{if(live)setLoading(false);}})();return()=>{live=false};},[db]);
 async function reload(){
  if(!db||!school||!year||!uid)return;
  const r=await db.from('sar_evidence').select('id,kind,title,activity_year_be,activity_date,description,target_codes,storage_path,drive_url,verification_status,created_at')
   .eq('school_id',school).eq('academic_year_id',year).eq('owner_user_id',uid).order('created_at',{ascending:false});
  if(r.error)throw r.error;setRecords(r.data as RecordItem[]);
 }
 useEffect(()=>{if(!year||!school||!uid)return;let live=true;setError('');void reload().catch(e=>{if(live)setError((e as Error).message)});return()=>{live=false};},[year,school,uid]);
 function reset(){setEditing(null);setKind('achievement');setName('');setDate('');setDescription('');setCodes([]);setDrive('');setFile(null);}
 function edit(record:RecordItem){
  setEditing(record.id);setKind(record.kind);setName(record.title);setActivityYear(String(record.activity_year_be));
  setDate(record.activity_date??'');setDescription(record.description);setCodes(record.target_codes??[]);
  setDrive(record.drive_url??'');setFile(null);window.scrollTo({top:0,behavior:'smooth'});
 }
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!db||!year||!school||!uid||busy)return;
  if(!name.trim()){setError('กรุณาระบุชื่อผลงานหรือกิจกรรม');return;}
  if(file&&(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>10*1024*1024)){
   setError('ไฟล์ต้องเป็น JPG, PNG, WebP หรือ PDF และขนาดไม่เกิน 10 MB');return;
  }
  const id=editing??crypto.randomUUID();
  const previous=records.find(r=>r.id===editing);
  let path=previous?.storage_path??null;
  setBusy(true);setError('');setNotice('');
  try{
   if(file){
    const ext=file.type==='application/pdf'?'pdf':file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
    const safe=name.trim().normalize('NFC').replace(/[\\/<>:"|?*]+/g,'_').slice(0,65).replace(/\s+/g,'_');
    const fileName=`${activityYear}_${safe}_${crypto.randomUUID().slice(0,8)}.${ext}`;
    path=[school,uid,id,kind,fileName].join('/');
    const uploaded=await db.storage.from(bucket).upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
    if(uploaded.error)throw Error('อัปโหลดไฟล์ไม่สำเร็จ: '+uploaded.error.message);
   }
   const r=await db.rpc('sar_save_evidence',{p_year:year,p_id:id,p_kind:kind,p_title:name.trim(),p_activity_year:Number(activityYear),
    p_activity_date:date||null,p_description:description,p_targets:codes,p_storage_path:path,p_drive_url:drive.trim()||null});
   if(r.error)throw Error(r.error.message);
   await reload();reset();setNotice('บันทึกหลักฐานแล้ว และส่งเข้ารายการรอตรวจสอบของ Admin');
  }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ');}
  finally{setBusy(false)}
 }
 async function viewFile(path:string){
  if(!db)return;const r=await db.storage.from(bucket).createSignedUrl(path,60);
  if(r.error||!r.data?.signedUrl){setError(r.error?.message??'เปิดไฟล์ไม่สำเร็จ');return;}
  window.open(r.data.signedUrl,'_blank','noopener,noreferrer');
 }
 const selectedYear=years.find(x=>x.id===year)?.year_be;
 return <main className="wichakan-page mx-auto max-w-5xl px-4 pb-12">
  <PageHeader title="คลังผลงาน อบรม และหลักฐาน SAR" context="บันทึกผลงานรายบุคคล แยกประเภทและปีการศึกษา พร้อมไฟล์ส่วนตัว"/>
  {error&&<p role="alert" className="teacher-error mb-3">{error}</p>}{notice&&<p role="status" className="teacher-success mb-3">{notice}</p>}
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
   <label className="text-sm font-medium">ปีการศึกษา <select className={style+' ml-2 inline-block w-auto'} value={year} onChange={e=>{setYear(e.target.value);reset();setActivityYear(String(years.find(y=>y.id===e.target.value)?.year_be??2569));}}>{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <Link href="/teacher/sar" className="text-sm text-blue-700 underline">กลับหน้า SAR ของครู</Link>
  </div>
  <form onSubmit={e=>void save(e)} className="mb-8 border-y border-slate-200 py-5">
   <h2 className="mb-4 text-lg font-semibold">{editing?'แก้ไขรายการของฉัน':'เพิ่มหลักฐาน / ผลงาน / การอบรม'}</h2>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">ประเภทหลักฐาน<select className={style+' mt-1'} value={kind} onChange={e=>setKind(e.target.value)} disabled={busy}>{kinds.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
    <label className="text-sm">ปีที่ดำเนินกิจกรรม (พ.ศ.)<input type="number" min={2500} max={2800} className={style+' mt-1'} required value={activityYear} onChange={e=>setActivityYear(e.target.value)}/></label>
    <label className="text-sm sm:col-span-2">ชื่อผลงาน / กิจกรรม / การอบรม<input required maxLength={250} className={style+' mt-1'} value={name} onChange={e=>setName(e.target.value)} placeholder="เช่น อบรมการจัดการเรียนรู้เชิงรุก"/></label>
    <label className="text-sm">วันที่เข้าร่วม (หากทราบ)<input type="date" className={style+' mt-1'} value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label className="text-sm">ภาพหรือ PDF หลักฐาน (สูงสุด 10 MB)<input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className={style+' mt-1'} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
    <label className="text-sm sm:col-span-2">ลิงก์ Google Drive (หากเก็บไว้แล้ว)<input type="url" className={style+' mt-1'} value={drive} placeholder="https://drive.google.com/..." onChange={e=>setDrive(e.target.value)}/></label>
    <label className="text-sm sm:col-span-2">รายละเอียด / ผลการดำเนินงาน<textarea className={style+' mt-1'} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
   </div>
   <fieldset className="mt-4"><legend className="mb-2 text-sm font-semibold">เชื่อมกับประเด็น SAR (เลือกได้หลายข้อ)</legend>
    <div className="max-h-44 overflow-y-auto border-y border-slate-100 py-2">{topics.filter(t=>t.standard_no>0&&t.code.includes('.')).map(t=><label className="flex items-start gap-2 py-1 text-xs" key={t.code}>
     <input type="checkbox" className="mt-0.5" checked={codes.includes(t.code)} onChange={e=>setCodes(a=>e.target.checked?[...a,t.code]:a.filter(x=>x!==t.code))}/><span><b>{t.code}</b> {t.title}</span>
    </label>)}</div>
   </fieldset>
   <p className="mt-3 text-xs text-slate-500">ไฟล์ที่อัปโหลดจะอยู่ในที่เก็บส่วนตัวของ Wichakan แยกตามผู้ใช้ ประเภทงาน และปีในชื่อไฟล์ หากใช้ Google Drive ให้แนบลิงก์ไฟล์ที่มีอยู่ก่อน ขณะนี้ยังไม่ได้เชื่อมสิทธิ์อัปโหลดเข้า Google Drive โดยตรง</p>
   <div className="mt-4 flex flex-wrap gap-3"><button className="ui-primary" type="submit" disabled={busy||loading||!name.trim()}>{busy?'กำลังบันทึก...':editing?'บันทึกการแก้ไข':'เพิ่มรายการ'}</button>
    {editing&&<button className="ui-secondary" type="button" disabled={busy} onClick={reset}>ยกเลิกแก้ไข</button>}</div>
  </form>
  <section><h2 className="mb-3 text-lg font-semibold">รายการของฉัน ปีการศึกษา {selectedYear}</h2>
   <div className="divide-y divide-slate-200">{records.map(r=><article key={r.id} className="py-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><span className="text-xs text-slate-500">{kinds.find(k=>k.key===r.kind)?.label??r.kind} · พ.ศ. {r.activity_year_be}</span>
      <h3 className="font-semibold">{r.title}</h3><span className="text-xs text-slate-600">{statusLabel[r.verification_status]??r.verification_status}</span></div>
     {r.verification_status==='draft'&&<button className="text-sm text-blue-700 underline" onClick={()=>edit(r)}>แก้ไข</button>}
    </div>
    {r.description&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{r.description}</p>}
    <div className="mt-2 flex flex-wrap gap-4 text-sm">
     {r.storage_path&&<button className="text-blue-700 underline" onClick={()=>void viewFile(r.storage_path!)}>ดูหลักฐาน</button>}
     {r.drive_url&&<a href={r.drive_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">เปิด Google Drive</a>}
     {r.target_codes?.length>0&&<span className="text-xs text-slate-500">ประเด็น: {r.target_codes.join(', ')}</span>}
    </div>
   </article>)}{!records.length&&<p className="py-5 text-sm text-slate-500">ยังไม่มีรายการที่บันทึกสำหรับปีการศึกษานี้</p>}</div>
  </section>
 </main>;
}
