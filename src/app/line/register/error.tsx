'use client';
import {useEffect} from 'react';
// Keep LINE registrations recoverable if the client runtime throws unexpectedly.
export default function LineRegisterError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('LINE registration view failed',error.name);},[error]);
 return <main className="wichakan-page mx-auto max-w-xl px-4 py-8">
  <h1 className="text-xl font-semibold">ไม่สามารถเปิดบริการ LINE ได้</h1>
  <p className="mt-3 text-sm">เกิดข้อผิดพลาดระหว่างแสดงหน้าเว็บ กรุณาลองโหลดใหม่ หากยังพบปัญหาให้แจ้งผู้ดูแลระบบโรงเรียน</p>
  <button type="button" className="ui-primary mt-4" onClick={()=>reset()}>ลองใหม่อีกครั้ง</button>
 </main>;
}
