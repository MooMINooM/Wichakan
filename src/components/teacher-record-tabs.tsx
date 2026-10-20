'use client';
import Link from 'next/link';
type Tab='scores'|'attendance'|'traits'|'reading';
export default function TeacherRecordTabs({offeringId,active,onTraits,onReading}:{offeringId?:string;active:Tab;onTraits?:()=>void;onReading?:()=>void}){
 const id=offeringId?'?offering='+encodeURIComponent(offeringId):'';
 const tabs:{tab:Tab;label:string;href:string;action?:()=>void}[]=[
  {tab:'scores',label:'บันทึกคะแนน',href:'/teacher/scores'+id},
  {tab:'attendance',label:'เวลาเรียน',href:'/teacher/attendance'+id},
  {tab:'traits',label:'คุณลักษณะ',href:'/teacher/assessments'+id+(id?'&':'?')+'group=traits',action:onTraits},
  {tab:'reading',label:'อ่านเขียน',href:'/teacher/assessments'+id+(id?'&':'?')+'group=reading',action:onReading}
 ];
 return <nav aria-label="เมนูบันทึกข้อมูลรายวิชา" className="teacher-record-tabs">{tabs.map(t=>t.action?<button type="button" key={t.tab} aria-current={active===t.tab?'page':undefined} className={'teacher-record-tab'+(active===t.tab?' is-active':'')} onClick={t.action}>{t.label}</button>:<Link key={t.tab} aria-current={active===t.tab?'page':undefined} className={'teacher-record-tab'+(active===t.tab?' is-active':'')} href={t.href}>{t.label}</Link>)}</nav>;
}
