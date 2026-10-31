'use client';
import {useEffect,useState} from 'react';
import Script from 'next/script';
import PageHeader from '@/components/page-header';
import ParentPortalPage from '@/app/line/parent/portal';

type Liff={init:(o:{liffId:string})=>Promise<void>;isLoggedIn:()=>boolean;login:()=>void;getIDToken:()=>string|null};
declare global{interface Window{liff?:Liff}}
export default function LineRegisterPage(){
 const [view,setView]=useState<'register'|'portal'>('register');
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('view')==='portal')setView('portal');},[]);
 const [sdk,setSdk]=useState(false),[ready,setReady]=useState(false),[citizen,setCitizen]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const liffId=process.env.NEXT_PUBLIC_LINE_LIFF_ID,api=process.env.NEXT_PUBLIC_SUPABASE_URL;
 useEffect(()=>{if(view==='register'&&window.liff)setSdk(true);},[view]);
 // Re-run when returning from Parent Portal. The SDK may already be initialized,
 // and Next/Script will not fire onLoad again for an existing script.
 useEffect(()=>{
  if(view!=='register'||!sdk)return;
  if(!liffId){setReady(false);setError('โรงเรียนยังไม่ได้กำหนด LINE LIFF ID');return;}
  const line=window.liff;
  if(!line){setReady(false);setError('โหลด LINE SDK ไม่สำเร็จ กรุณาปิดแล้วเปิดใหม่');return;}
  let active=true;
  setError('');
  async function connect(){
   try{
    // Parent Portal has already logged this LIFF session in: reuse it.
    try{
     if(line!.isLoggedIn()&&line!.getIDToken()){
      if(active)setReady(true);
      return;
     }
    }catch{ /* The SDK is not initialized yet; init it below. */ }
    await line!.init({liffId:liffId!});
    if(!active)return;
    if(!line!.isLoggedIn()){line!.login();return;}
    if(!line!.getIDToken())throw Error('missing_id_token');
    setReady(true);
   }catch{
    if(active){setReady(false);setError('ไม่สามารถเชื่อมต่อบัญชี LINE ได้ กรุณาปิดแล้วเปิดจากเมนู LINE OA ใหม่');}
   }
  }
  void connect();
  return()=>{active=false;};
 },[sdk,liffId,view]);
 async function submit(){if(busy||!ready||!/^[0-9]{13}$/.test(citizen)||!api)return;setBusy(true);setNotice('');setError('');try{
  const idToken=window.liff?.getIDToken();if(!idToken)throw Error('กรุณาเข้าสู่ระบบ LINE อีกครั้ง');
  const result=await fetch(api+'/functions/v1/line-register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id_token:idToken,citizen_id:citizen})});
  const body=await result.json() as {status?:string};
  if(!result.ok)throw Error(body.status==='rate_limited'?'ส่งคำขอเกินจำนวนครั้งที่กำหนด กรุณาลองใหม่ภายหลัง':body.status==='not_configured'?'โรงเรียนยังไม่เปิดบริการลงทะเบียนผ่าน LINE':'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
  setCitizen('');setNotice('รับคำขอแล้ว หากข้อมูลตรงกับทะเบียน โรงเรียนจะตรวจสอบและอนุมัติการเชื่อมบัญชี'); 
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(view==='portal')return <ParentPortalPage onAddChild={()=>{window.history.replaceState(null,'',window.location.pathname);setView('register');setError('');}}/>;
 return <main className="wichakan-page mx-auto max-w-xl px-4 py-8">
  <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" onLoad={()=>setSdk(true)} onReady={()=>setSdk(true)} onError={()=>setError("โหลด LINE SDK ไม่สำเร็จ กรุณาลองเปิดใหม่")}/>
  <PageHeader title="ลงทะเบียนบุตรหลาน"/>
  <button className="ui-secondary mb-4" type="button" onClick={()=>{window.history.replaceState(null,'','?view=portal');setView('portal');}}>ดูบุตรหลานที่อนุมัติแล้ว →</button>
  <p className="mb-5 text-sm">โรงเรียนบ้านภูพระโนนผักหวาน</p>
  <section className="ui-panel">
   <label className="block font-semibold">เลขประจำตัวประชาชนนักเรียน 13 หลัก<input inputMode="numeric" autoComplete="off" type="text" maxLength={13} className="mt-2 block w-full border p-3" placeholder="กรอกเลข 13 หลัก" value={citizen} onChange={e=>setCitizen(e.target.value.replace(/\D/g,'').slice(0,13))}/></label>
   <p className="mt-3 text-xs">ใช้เลขประจำตัวประชาชนนักเรียน 13 หลัก · รอโรงเรียนอนุมัติ</p>
   <button className="ui-primary mt-4" disabled={!ready||busy||citizen.length!==13} onClick={()=>void submit()}>{busy?'กำลังส่ง...':ready?'ส่งคำขอลงทะเบียน':'กำลังเชื่อมต่อ LINE...'}</button>
   {!liffId&&<p className="teacher-error mt-3">โรงเรียนยังไม่ได้กำหนด LINE LIFF ID</p>}
   {error&&<p className="teacher-error mt-3" role="alert">{error}</p>}
   {notice&&<p className="teacher-success mt-3" role="status">{notice}</p>}
  </section>
 </main>;
}
