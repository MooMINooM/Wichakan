'use client';
import {useEffect,useState} from 'react';
import {resolveYear} from './academic-year-selection';
import type {TeacherWorkspace} from './use-teacher-workspace';
/** Resolve explicit course links without falling back to another teacher's offering. */
export function useCourseContext(data:TeacherWorkspace,loading:boolean){
 const [yearId,setYearId]=useState(''),[offeringId,setOfferingId]=useState(''),[initialized,setInitialized]=useState(false),[linkError,setLinkError]=useState('');
 useEffect(()=>{if(loading||initialized||!data.schoolId)return;
  const requested=new URLSearchParams(window.location.search).get('offering'),o=data.offerings.find(o=>o.id===requested);
  if(requested&&!o)setLinkError('ไม่มีสิทธิ์จัดการรายวิชาจากลิงก์นี้');
  setYearId(data.rooms.find(r=>r.id===o?.classroom_id)?.academic_year_id??resolveYear(data.years,data.schoolId));setOfferingId(o?.id??'');setInitialized(true);
 },[data,loading,initialized]);
 const available=data.offerings.filter(o=>data.rooms.some(r=>r.id===o.classroom_id&&r.academic_year_id===yearId));
 const selected=linkError?undefined:available.find(o=>o.id===offeringId)??available[0];
 return {yearId,available,selected,linkError,initialized,chooseYear:(id:string)=>{setYearId(id);setOfferingId('');setLinkError('');},chooseOffering:(id:string)=>{setOfferingId(id);setLinkError('');}};
}
