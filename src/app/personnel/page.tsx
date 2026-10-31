'use client';
import PageHeader from '@/components/page-header';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import AcademicDialog from '@/components/academic-dialog';
import {AcademicIcon} from '@/components/academic-visuals';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';

type Role='teacher'|'academic'|'registrar'|'director';
type Member={user_id:string;role:string;active:boolean};
type Profile={user_id:string;display_name:string;learning_area:string|null};
type Year={id:string;year_be:number;is_active:boolean};
const roles:Role[]=['teacher','academic','registrar','director'];
const roleName:Record<string,string>={teacher:'ครูผู้สอน',academic:'ฝ่ายวิชาการ',registrar:'ฝ่ายทะเบียน',director:'ผู้อำนวยการ',school_admin:'ผู้ดูแลระบบ'};
const areas=['ภาษาไทย','คณิตศาสตร์','วิทยาศาสตร์และเทคโนโลยี','สังคมศึกษา ศาสนา และวัฒนธรรม','สุขศึกษาและพลศึกษา','ศิลปะ','การงานอาชีพ','ภาษาต่างประเทศ','ปฐมวัย','กิจกรรมพัฒนาผู้เรียน'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function readAll<T>(query:(a:number,b:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>){const all:T[]=[];for(let a=0;;a+=500){const result=await query(a,a+499);if(result.error)throw new Error(result.error.message);all.push(...(result.data??[]));if((result.data?.length??0)<500)return all;}}

export default function PersonnelPage(){
 const db=getSupabaseBrowserClient(),router=useRouter();
 const [schoolId,setSchoolId]=useState(''),[schoolName,setSchoolName]=useState('');
 const [members,setMembers]=useState<Member[]>([]),[profiles,setProfiles]=useState<Profile[]>([]);
 const [years,setYears]=useState<Year[]>([]),[yearId,setYearId]=useState('');
 const [teaching,setTeaching]=useState<{teacher_user_id:string;course_offering_id:string}[]>([]),[offerings,setOfferings]=useState<{id:string;classroom_id:string}[]>([]),[rooms,setRooms]=useState<{id:string;academic_year_id:string}[]>([]);
 const [query,setQuery]=useState(''),[roleFilter,setRoleFilter]=useState(''),[statusFilter,setStatusFilter]=useState('');
 const [page,setPage]=useState(1),[size,setSize]=useState(10),[loading,setLoading]=useState(true),[summaryError,setSummaryError]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 const [editId,setEditId]=useState(''),[uid,setUid]=useState(''),[displayName,setDisplayName]=useState(''),[email,setEmail]=useState(''),[area,setArea]=useState(''),[role,setRole]=useState<Role>('teacher'),[active,setActive]=useState(true);
 const [formError,setFormError]=useState(''),[accountLoading,setAccountLoading]=useState(false),[accountLoaded,setAccountLoaded]=useState(false);
 const [dialog,setDialog]=useState<{mode:'actions'|'password';userId:string}|null>(null);
 const [password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[dialogError,setDialogError]=useState('');
 const requestId=useRef(0),uidInput=useRef<HTMLInputElement>(null);
 const name=(id:string)=>profiles.find(p=>p.user_id===id)?.display_name??'บัญชี '+id.slice(0,8);
 const profile=(id:string)=>profiles.find(p=>p.user_id===id);
 async function accountAction(action:string,userId:string,values:Record<string,string|null>={}){
  if(!db)throw new Error('ยังไม่ได้เชื่อมต่อระบบ');
  const result=await db.functions.invoke('manage-staff',{body:{action,school_id:schoolId,user_id:userId,...values}});
  if(result.error){let message='จัดการบัญชีไม่สำเร็จ กรุณาลองใหม่';const context=(result.error as {context?:Response}).context;if(context&&typeof context.json==='function')try{const data=await context.json();if(typeof data.error==='string')message=data.error;}catch{}throw new Error(message);}
  if(!result.data||result.data.error)throw new Error(result.data?.error??'ไม่ได้รับผลลัพธ์จากระบบจัดการบัญชี');
  return result.data as {email:string;display_name:string;learning_area:string|null;success?:boolean};
 }
 useEffect(()=>{let alive=true;(async()=>{try{
  if(!db)throw new Error('ยังไม่ได้เชื่อมต่อระบบ');
  const {data:{user},error:authError}=await db.auth.getUser();if(!alive)return;if(authError)throw authError;if(!user){router.replace('/login');return;}
  const result=await db.from('school_memberships').select('school_id,role,schools(name_th)').eq('user_id',user.id).eq('active',true);
  if(result.error)throw result.error;if(!alive)return;const admin=result.data?.find(m=>m.role==='school_admin');if(!admin){router.replace('/workspace');return;}
  setSchoolId(admin.school_id);setSchoolName((admin.schools as unknown as {name_th:string}|null)?.name_th??'');
 }catch(e){if(alive){setError(e instanceof Error?e.message:(e as {message?:string})?.message??'โหลดข้อมูลไม่สำเร็จ');setLoading(false);}}})();return()=>{alive=false;};},[db,router]);
 useEffect(()=>{let alive=true;(async()=>{
  if(!db||!schoolId)return;setLoading(true);setError('');setSummaryError('');
  try{
   const m=await readAll<Member>((a,b)=>db.from('school_memberships').select('user_id,role,active').eq('school_id',schoolId).order('id').range(a,b));
   const ids=[...new Set(m.map(x=>x.user_id))];const p:Profile[]=[];
   for(let i=0;i<ids.length;i+=100){const result=await db.from('profiles').select('user_id,display_name,learning_area').in('user_id',ids.slice(i,i+100));if(result.error)throw result.error;p.push(...(result.data??[]));}
   if(!alive)return;setMembers(m);setProfiles(p);
   try{
    const [y,t,o,r]=await Promise.all([
     readAll<Year>((a,b)=>db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('year_be',{ascending:false}).range(a,b)),
     readAll<{teacher_user_id:string;course_offering_id:string}>((a,b)=>db.from('teaching_assignments').select('teacher_user_id,course_offering_id').eq('school_id',schoolId).order('id').range(a,b)),
     readAll<{id:string;classroom_id:string}>((a,b)=>db.from('course_offerings').select('id,classroom_id').eq('school_id',schoolId).order('id').range(a,b)),
     readAll<{id:string;academic_year_id:string}>((a,b)=>db.from('classrooms').select('id,academic_year_id').eq('school_id',schoolId).order('id').range(a,b))
    ]);if(!alive)return;setYears(y);setYearId(old=>resolveYear(y,schoolId,old));setTeaching(t);setOfferings(o);setRooms(r);
   }catch{if(alive)setSummaryError('ยังโหลดข้อมูลมอบหมายงานสอนไม่สำเร็จ');}
  }catch(e){if(alive)setError(e instanceof Error?e.message:(e as {message?:string})?.message??'โหลดบุคลากรไม่สำเร็จ');}finally{if(alive)setLoading(false);}
 })();return()=>{alive=false;};},[db,schoolId,refresh]);
 useEffect(()=>{if(!schoolId)return;const sync=(e:Event)=>{const d=(e as CustomEvent<{schoolId:string;yearId:string}>).detail;if(d?.schoolId===schoolId)setYearId(d.yearId);};window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);},[schoolId]);
 const people=[...new Set(members.map(m=>m.user_id))].map(userId=>({userId,memberships:members.filter(m=>m.user_id===userId)}));
 const filtered=people.filter(p=>(!roleFilter||p.memberships.some(m=>m.role===roleFilter))&&(!statusFilter||p.memberships.some(m=>m.active)===(statusFilter==='active'))&&(name(p.userId)+' '+p.userId+' '+(profile(p.userId)?.learning_area??'')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const totalPages=Math.max(1,Math.ceil(filtered.length/size)),currentPage=Math.min(page,totalPages),displayed=filtered.slice((currentPage-1)*size,currentPage*size);
 const teachers=people.filter(p=>p.memberships.some(m=>m.role==='teacher'&&m.active));
 const yearRooms=new Set(rooms.filter(r=>r.academic_year_id===yearId).map(r=>r.id));
 const yearOfferings=new Set(offerings.filter(o=>yearRooms.has(o.classroom_id)).map(o=>o.id));
 const teachingIds=new Set(teaching.filter(t=>yearOfferings.has(t.course_offering_id)).map(t=>t.teacher_user_id));
 const assigned=teachers.filter(p=>teachingIds.has(p.userId)).length;
 function resetForm(){if(busy)return;requestId.current++;setEditId('');setUid('');setDisplayName('');setEmail('');setArea('');setRole('teacher');setActive(true);setFormError('');setAccountLoading(false);setAccountLoaded(false);}
 function addPerson(){resetForm();setNotice('');document.getElementById('personnel-form')?.scrollIntoView({behavior:'smooth',block:'nearest'});uidInput.current?.focus();}
 async function editPerson(id:string){
  if(busy)return;const ticket=++requestId.current;const current=members.find(m=>m.user_id===id&&roles.includes(m.role as Role));
  setEditId(id);setUid(id);setDisplayName(name(id));setArea(profile(id)?.learning_area??'');setRole((current?.role as Role)??'teacher');setActive(current?.active??true);setEmail('');setFormError('');setNotice('');setAccountLoaded(false);setAccountLoading(true);
  document.getElementById('personnel-form')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  try{const account=await accountAction('get-account',id);if(ticket!==requestId.current)return;setDisplayName(account.display_name);setEmail(account.email);setArea(account.learning_area??'');setAccountLoaded(true);}catch(e){if(ticket===requestId.current)setFormError(e instanceof Error?e.message:'โหลดข้อมูลบัญชีไม่สำเร็จ');}finally{if(ticket===requestId.current)setAccountLoading(false);}
 }
 async function rpc(action:()=>PromiseLike<{error:{message:string}|null}>){const result=await action();if(result.error)throw new Error(result.error.message);}
 async function savePerson(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!db||busy||accountLoading||!schoolId||(editId&&!accountLoaded))return;setBusy(true);setFormError('');setNotice('');let profileSaved=false,roleSaved=false;
  try{
   if(editId){
    await accountAction('update-profile',editId,{display_name:displayName.trim(),email:email.trim(),learning_area:area||null});profileSaved=true;
    const old=members.find(m=>m.user_id===editId&&m.role===role);if(old&&old.active!==active)await rpc(()=>db.rpc('set_school_staff_role_active',{p_school_id:schoolId,p_user_id:editId,p_role:role,p_active:active}));
   }else{
    await rpc(()=>db.rpc('grant_school_staff_role',{p_school_id:schoolId,p_user_id:uid.trim(),p_display_name:displayName.trim(),p_role:role}));roleSaved=true;
    await accountAction('update-learning-area',uid.trim(),{learning_area:area||null});
    if(!active)await rpc(()=>db.rpc('set_school_staff_role_active',{p_school_id:schoolId,p_user_id:uid.trim(),p_role:role,p_active:false}));
   }
   setNotice(editId?'บันทึกข้อมูลบุคลากรแล้ว':'เพิ่มสิทธิ์บุคลากรแล้ว');setEditId('');setUid('');setDisplayName('');setEmail('');setArea('');setRole('teacher');setActive(true);setAccountLoaded(false);setRefresh(x=>x+1);
  }catch(e){setFormError((profileSaved?'ข้อมูลบุคลากรบันทึกแล้ว แต่เปลี่ยนสถานะไม่สำเร็จ: ':roleSaved?'เพิ่มสิทธิ์แล้ว แต่บันทึกข้อมูลที่เหลือไม่สำเร็จ: ':'')+(e instanceof Error?e.message:'บันทึกไม่สำเร็จ'));if(profileSaved||roleSaved)setRefresh(x=>x+1);}finally{setBusy(false);}
 }
 function closeDialog(){if(busy)return;setDialog(null);setPassword('');setConfirmPassword('');setShowPassword(false);setDialogError('');}
 function openPassword(id:string){setDialog({mode:'password',userId:id});setPassword('');setConfirmPassword('');setShowPassword(false);setDialogError('');}
 async function resetPassword(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(!dialog||busy)return;if(password!==confirmPassword||!password.trim()||password.length<8||new TextEncoder().encode(password).length>72){setDialogError('รหัสผ่านต้องตรงกัน อย่างน้อย 8 ตัวอักษร และไม่เกิน 72 ไบต์');return;}setBusy(true);setDialogError('');try{await accountAction('reset-password',dialog.userId,{password});setDialog(null);setPassword('');setConfirmPassword('');setShowPassword(false);setNotice('ตั้งรหัสผ่านใหม่ให้ '+name(dialog.userId)+' แล้ว');}catch(e){setDialogError(e instanceof Error?e.message:'เปลี่ยนรหัสผ่านไม่สำเร็จ');}finally{setBusy(false);}}
 async function toggleRole(m:Member){if(!db||busy)return;setBusy(true);setDialogError('');try{await rpc(()=>db.rpc('set_school_staff_role_active',{p_school_id:schoolId,p_user_id:m.user_id,p_role:m.role,p_active:!m.active}));setNotice(m.active?'ระงับสิทธิ์แล้ว':'เปิดสิทธิ์แล้ว');setDialog(null);setRefresh(x=>x+1);}catch(e){setDialogError(e instanceof Error?e.message:'เปลี่ยนสถานะไม่สำเร็จ');}finally{setBusy(false);}}
 const editableRoles=editId?members.filter(m=>m.user_id===editId&&roles.includes(m.role as Role)).map(m=>m.role as Role):roles;
 const fieldClass='personnel-input';
 return <main className="wichakan-page academic-dashboard personnel-dashboard mx-auto px-4 pb-6 pt-4 sm:px-6">
  <PageHeader title="จัดการบุคลากร" context={schoolName}/>
  {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={()=>setRefresh(x=>x+1)}>ลองอีกครั้ง</button></p>}
  {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  <div className="personnel-toolbar"><label className="personnel-search"><AcademicIcon name="search"/><input aria-label="ค้นหาบุคลากร" placeholder="ค้นหาชื่อ–สกุล หรือรหัสบัญชี..." value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><select aria-label="กรองบทบาท" value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setPage(1);}}><option value="">ทุกบทบาท</option>{['school_admin',...roles].map(r=><option key={r} value={r}>{roleName[r]}</option>)}</select><select aria-label="กรองสถานะ" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}}><option value="">ทุกสถานะ</option><option value="active">เปิดใช้งาน</option><option value="inactive">ระงับสิทธิ์</option></select><button className="academic-primary" type="button" onClick={addPerson} disabled={busy||!schoolId}>+ เพิ่มบุคลากร</button></div>
  <div className="personnel-layout">
   <section className="academic-panel personnel-roster" aria-labelledby="personnel-list-title"><div className="academic-panel-heading"><h2 id="personnel-list-title"><AcademicIcon name="users"/>รายชื่อบุคลากร</h2><span>ทั้งหมด {people.length} คน</span></div>
    <div className="personnel-table-scroll"><table className="personnel-table"><thead><tr><th>รหัสบัญชี</th><th>ชื่อ–สกุล</th><th>ตำแหน่ง / บทบาท</th><th>กลุ่มสาระการเรียนรู้</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{!loading&&displayed.map(p=>{const protectedAccount=p.memberships.some(m=>m.role==='school_admin');const enabled=p.memberships.some(m=>m.active);return <tr key={p.userId} className={editId===p.userId?'selected':''}><td><span title={p.userId} className="personnel-id">{p.userId.slice(0,8)}</span></td><td><div className="personnel-name"><span className="personnel-avatar"><AcademicIcon name="users"/></span><span>{name(p.userId)}</span></div></td><td><div className="personnel-role-list">{p.memberships.map(m=><span key={m.role} className={'personnel-role '+m.role}>{roleName[m.role]??m.role}</span>)}</div></td><td>{profile(p.userId)?.learning_area||<span className="text-slate-400">ไม่ระบุ</span>}</td><td><span className={'personnel-status '+(enabled?'active':'inactive')}>{enabled?'เปิดใช้งาน':'ระงับสิทธิ์'}</span></td><td><div className="personnel-row-actions"><button type="button" className="personnel-password-button" disabled={busy||protectedAccount} aria-label={'ตั้งรหัสผ่านใหม่ให้ '+name(p.userId)} onClick={()=>openPassword(p.userId)}>ตั้งรหัสผ่านใหม่</button><button type="button" disabled={busy||protectedAccount} aria-label={'แก้ไขข้อมูล '+name(p.userId)} title="แก้ไขข้อมูล" onClick={()=>void editPerson(p.userId)}><AcademicIcon name="edit"/></button><button type="button" disabled={busy||protectedAccount} aria-label={'เมนูจัดการ '+name(p.userId)} title="เมนูจัดการ" onClick={()=>{setDialog({mode:'actions',userId:p.userId});setDialogError('');}}>⋮</button></div></td></tr>;})}</tbody></table></div>
    {loading&&<p role="status" className="personnel-empty">กำลังโหลดข้อมูลบุคลากร...</p>}{!loading&&!filtered.length&&<p className="personnel-empty">ไม่พบบุคลากรตามเงื่อนไขที่เลือก</p>}
    <footer className="personnel-pagination"><span>แสดง {filtered.length?(currentPage-1)*size+1:0}–{Math.min(currentPage*size,filtered.length)} จาก {filtered.length} รายการ</span><label>แสดง <select aria-label="จำนวนรายการต่อหน้า" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}>{[10,20,50].map(n=><option key={n}>{n}</option>)}</select> รายการ</label><nav aria-label="หน้ารายชื่อบุคลากร"><button disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)} aria-label="หน้าก่อนหน้า">‹</button>{Array.from({length:Math.min(totalPages,5)},(_,i)=>Math.max(1,Math.min(currentPage-2,totalPages-4))+i).map(n=><button key={n} aria-current={n===currentPage?'page':undefined} onClick={()=>setPage(n)}>{n}</button>)}<button disabled={currentPage>=totalPages} onClick={()=>setPage(currentPage+1)} aria-label="หน้าถัดไป">›</button></nav></footer>
   </section>
   <aside className="personnel-aside">
    <section className="academic-panel personnel-summary"><h2><AcademicIcon name="chart"/>สรุปข้อมูลบุคลากร</h2><p className="personnel-subtitle">ปีการศึกษา {years.find(y=>y.id===yearId)?.year_be??'—'}</p><label className="mb-3 flex items-center gap-2 text-xs text-blue-900 md:hidden">ปีการศึกษา<select aria-label="ปีการศึกษาสรุปบุคลากร" value={yearId} disabled={!years.length} onChange={e=>{setYearId(e.target.value);setYearSelection(schoolId,e.target.value);}}>{!years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label><div className="personnel-metrics">{([{label:'บุคลากรทั้งหมด',value:people.length,icon:'users',color:'blue'},{label:'ครูผู้สอนที่เปิดสิทธิ์',value:teachers.length,icon:'school',color:'blue'},{label:'ครูที่มีงานสอนแล้ว',value:assigned,icon:'book',color:'green'},{label:'ครูที่ยังไม่มีงานสอน',value:teachers.length-assigned,icon:'calendar',color:'orange'}] as const).map((item,i)=><div key={item.label} className={'academic-stat '+item.color}><i><AcademicIcon name={item.icon}/></i><div><p>{item.label}</p><strong>{loading||error||(i>1&&summaryError)?'—':item.value} <small>คน</small></strong>{i>1&&<span title="สัดส่วนของครูผู้สอนที่เปิดสิทธิ์">{loading||error||summaryError?'รอข้อมูล':(teachers.length?Math.round(item.value/teachers.length*1000)/10:0)+'%'}</span>}</div></div>)}</div>{summaryError&&<p className="mt-3 text-xs text-amber-700">{summaryError}<button className="ml-2 underline" onClick={()=>setRefresh(x=>x+1)}>ลองใหม่</button></p>}</section>
    <section id="personnel-form" className="academic-panel personnel-form"><h2><AcademicIcon name="users"/>ข้อมูลบุคลากร</h2>{editId&&<p className="personnel-subtitle">{name(editId)}</p>}
     {accountLoading&&<p role="status" className="mt-3 text-sm text-slate-500">กำลังโหลดข้อมูลบัญชี...</p>}{formError&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}</p>}{editId&&!accountLoaded&&!accountLoading&&<button className="mt-3 text-sm text-blue-700 underline" onClick={()=>void editPerson(editId)}>โหลดข้อมูลอีกครั้ง</button>}
     <form onSubmit={savePerson}>
      <label><span>รหัสบัญชี <b>*</b></span><input aria-label="รหัสบัญชี" ref={uidInput} className={fieldClass} required readOnly={!!editId} disabled={busy} value={uid} onChange={e=>setUid(e.target.value)} placeholder="User UID ของบัญชี" pattern="[0-9a-fA-F-]{36}" title="User UID ของบัญชีที่สร้างไว้แล้ว"/></label>
      {!editId&&<p className="personnel-help">ใช้ User UID ของบัญชีที่มีอยู่แล้ว</p>}
      <label><span>ชื่อ–สกุล <b>*</b></span><input aria-label="ชื่อ–สกุล" className={fieldClass} required minLength={2} maxLength={150} disabled={busy||accountLoading||(!!editId&&!accountLoaded)} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="ชื่อ นามสกุล" autoComplete="name"/></label>
      <label><span>{editId?'บทบาทที่จัดการ':'ตำแหน่ง / บทบาท'} <b>*</b></span><select aria-label="บทบาทที่จัดการ" className={fieldClass} disabled={busy||accountLoading} value={role} onChange={e=>{const next=e.target.value as Role;setRole(next);if(editId)setActive(members.find(m=>m.user_id===editId&&m.role===next)?.active??true);}}>{editableRoles.map(r=><option key={r} value={r}>{roleName[r]}</option>)}</select></label>
      <label><span>กลุ่มสาระการเรียนรู้</span><select aria-label="กลุ่มสาระการเรียนรู้" className={fieldClass} disabled={busy||accountLoading} value={area} onChange={e=>setArea(e.target.value)}><option value="">ไม่ระบุ</option>{[...new Set([...areas,...(area&&!areas.includes(area)?[area]:[])])].map(a=><option key={a}>{a}</option>)}</select></label>
      {editId&&<label><span>อีเมลเข้าสู่ระบบ <b>*</b></span><input aria-label="อีเมลเข้าสู่ระบบ" className={fieldClass} type="email" required maxLength={254} autoComplete="off" disabled={busy||!accountLoaded} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
      <label><span>สถานะ <b>*</b></span><select aria-label="สถานะบัญชี" className={fieldClass} disabled={busy||accountLoading} value={active?'active':'inactive'} onChange={e=>setActive(e.target.value==='active')}><option value="active">เปิดใช้งาน</option><option value="inactive">ระงับสิทธิ์</option></select></label>
      <div className="personnel-form-buttons"><button type="button" disabled={busy} onClick={resetForm}>ยกเลิก</button><button type="submit" disabled={busy||loading||accountLoading||!schoolId||!uuid.test(uid.trim())||(!!editId&&!accountLoaded)}>{busy?'กำลังบันทึก...':'บันทึกข้อมูล'}</button></div>
     </form>
    </section>
   </aside>
  </div>
  {dialog&&<AcademicDialog title={dialog.mode==='actions'?'จัดการบัญชีบุคลากร':'ตั้งรหัสผ่านใหม่'} onClose={closeDialog}><p className="mb-4 text-sm font-semibold text-blue-900">{name(dialog.userId)}</p>{dialogError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{dialogError}</p>}{dialog.mode==='actions'?<div className="space-y-3"><button type="button" className="w-full rounded-xl bg-blue-50 p-3 text-left text-sm font-semibold text-blue-700" onClick={()=>{const id=dialog.userId;closeDialog();void editPerson(id);}}>แก้ไขข้อมูล</button><button type="button" className="w-full rounded-xl bg-amber-50 p-3 text-left text-sm font-semibold text-amber-800" onClick={()=>openPassword(dialog.userId)}>ตั้งรหัสผ่านใหม่</button>{members.filter(m=>m.user_id===dialog.userId&&roles.includes(m.role as Role)).map(m=><button type="button" key={m.role} disabled={busy} className="w-full rounded-xl border p-3 text-left text-sm disabled:opacity-40" onClick={()=>void toggleRole(m)}>{m.active?'ระงับสิทธิ์':'เปิดสิทธิ์'} · {roleName[m.role]}</button>)}</div>:<form onSubmit={resetPassword} className="space-y-4"><p className="text-sm text-slate-600">กำหนดรหัสผ่านใหม่ให้บัญชีนี้</p><label className="block text-sm">รหัสผ่านใหม่<input className="personnel-input mt-2" type={showPassword?'text':'password'} required autoComplete="new-password" minLength={8} maxLength={72} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="block text-sm">ยืนยันรหัสผ่านใหม่<input className="personnel-input mt-2" type={showPassword?'text':'password'} required autoComplete="new-password" minLength={8} maxLength={72} disabled={busy} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/>แสดงรหัสผ่าน</label><p className="text-xs text-slate-500">อย่างน้อย 8 ตัวอักษร และไม่เกิน 72 ไบต์</p><div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={closeDialog} className="rounded-xl border px-4 py-2 text-sm">ยกเลิก</button><button type="submit" disabled={busy} className="ui-primary rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy?'กำลังบันทึก...':'ตั้งรหัสผ่านใหม่'}</button></div></form>}</AcademicDialog>}
 </main>;
}
