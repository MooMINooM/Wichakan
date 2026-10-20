'use client';
import {useEffect,useState} from 'react';
import Script from 'next/script';
import PageHeader from '@/components/page-header';

type Liff={init:(o:{liffId:string})=>Promise<void>;isLoggedIn:()=>boolean;login:()=>void;getIDToken:()=>string|null};
declare global{interface Window{liff?:Liff}}
export default function LineRegisterPage(){
 const [sdk,setSdk]=useState(false),[ready,setReady]=useState(false),[citizen,setCitizen]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const liffId=process.env.NEXT_PUBLIC_LINE_LIFF_ID,api=process.env.NEXT_PUBLIC_SUPABASE_URL;
 useEffect(()=>{if(!sdk||!liffId||!window.liff)return;let live=true;window.liff.init({liffId}).then(()=>{if(!live)return;if(!window.liff?.isLoggedIn())window.liff?.login();else setReady(true);}).catch(()=>{if(live)setError('ไม่สามารถเชื่อมต่อบัญชี LINE ได้ กรุณาเปิดจากเมนู LINE OA');});return()=>{live=false;};},[sdk,liffId]);
 async function submit(){if(busy||!ready||!/^[0-9]{13}$/.test(citizen)||!api)return;setBusy(true);setNotice('');setError('');try{
  const idToken=window.liff?.getIDToken();if(!idToken)throw Error('กรุณาเข้าสู่ระบบ LINE อีกครั้ง');
  const result=await fetch(api+'/functions/v1/line-register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id_token:idToken,citizen_id:citizen})});
  const body=await result.json() as {status?:string};
  if(!result.ok)throw Error(body.status==='rate_limited'?'ส่งคำขอเกินจำนวนครั้งที่กำหนด กรุณาลองใหม่ภายหลัง':body.status==='not_configured'?'โรงเรียนยังไม่เปิดบริการลงทะเบียนผ่าน LINE':'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
  setCitizen('');setNotice('รับคำขอแล้ว หากข้อมูลตรงกับทะเบียน โรงเรียนจะตรวจสอบและอนุมัติการเชื่อมบัญชี'); 
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className="wichakan-page mx-auto max-w-xl px-4 py-8">
  <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" onLoad={()=>setSdk(true)}/>
  <PageHeader title="ลงทะเบียนบุตรหลาน"/>
  <p className="mb-5 text-sm">บริการผู้ปกครองโรงเรียนบ้านภูพระโนนผักหวาน · ระบบรับเพียงเลขประจำตัวประชาชนของนักเรียน 13 หลัก และบัญชี LINE ที่เข้าสู่ระบบ</p>
  <section className="ui-panel">
   <label className="block font-semibold">เลขประจำตัวประชาชนนักเรียน 13 หลัก<input inputMode="numeric" autoComplete="off" type="text" maxLength={13} className="mt-2 block w-full border p-3" placeholder="กรอกเลข 13 หลัก" value={citizen} onChange={e=>setCitizen(e.target.value.replace(/\D/g,'').slice(0,13))}/></label>
   <p className="mt-3 text-xs">เลขบัตรใช้เพื่อจับคู่คำขอ ไม่แสดงชื่อหรือผลการเรียนก่อนโรงเรียนอนุมัติ</p>
   <button className="ui-primary mt-4" disabled={!ready||busy||citizen.length!==13} onClick={()=>void submit()}>{busy?'กำลังส่ง...':ready?'ส่งคำขอลงทะเบียน':'กำลังเชื่อมต่อ LINE...'}</button>
   {!liffId&&<p className="teacher-error mt-3">โรงเรียนยังไม่ได้กำหนด LINE LIFF ID</p>}
   {error&&<p className="teacher-error mt-3" role="alert">{error}</p>}
   {notice&&<p className="teacher-success mt-3" role="status">{notice}</p>}
  </section>
 </main>;
}
