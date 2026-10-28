export const ACTIVITY_NAMES:Record<string,string>={sss:'สสส.',guidance:'แนะแนว',ethics:'อบรมคุณธรรม',club:'ชุมนุม',scout:'ลูกเสือ–เนตรนารี'};
export type ActivitySchedule={id:string;school_id:string;term_id:string;classroom_id:string;activity_type:string;teacher_user_id:string|null};
export type ActivityTerm={id:string;academic_year_id:string;term_no:number};
export type ActivityRoom={id:string;academic_year_id:string;level_code:string;room_code:string};
export type ActivityGrade={student_id:string;activity_type:string;period_no:number;result:string|null};
export type ActivityGroup={key:string;classroom_id:string;academic_year_id:string;activity_type:string;period_no:number;assessor:'teacher'|'homeroom'};
export type ActivityViewer={userId:string;admin:boolean;homeroomRoomIds:Set<string>};
export const activityPeriod=(level:string,term:number)=>level.startsWith('ป.')?0:term;
export function activityGroups(schedules:ActivitySchedule[],rooms:ActivityRoom[],terms:ActivityTerm[],viewer?:ActivityViewer){
 const groups=new Map<string,ActivityGroup>();
 for(const s of schedules){
  const r=rooms.find(r=>r.id===s.classroom_id),t=terms.find(t=>t.id===s.term_id);
  if(!r||!t||r.academic_year_id!==t.academic_year_id||!ACTIVITY_NAMES[s.activity_type]||!['ป.','ม.'].some(prefix=>r.level_code.startsWith(prefix)))continue;
  for(const period of r.level_code.startsWith('ป.')?[0]:[1,2]){
   const peers=schedules.filter(x=>x.classroom_id===r.id&&x.school_id===s.school_id&&x.activity_type===s.activity_type&&terms.some(t=>t.id===x.term_id&&t.academic_year_id===r.academic_year_id));
   const direct=peers.filter(x=>terms.some(t=>t.id===x.term_id&&t.term_no===period)),assigned=period&&direct.length?direct:peers;
   const owners=assigned.map(x=>x.teacher_user_id).filter((id):id is string=>!!id),assessor=owners.length?'teacher':'homeroom';
   if(viewer&&!viewer.admin&&!(owners.length?owners.includes(viewer.userId):viewer.homeroomRoomIds.has(r.id)))continue;
   const key=[r.id,s.activity_type,period].join(':');
   groups.set(key,{key,classroom_id:r.id,academic_year_id:t.academic_year_id,activity_type:s.activity_type,period_no:period,assessor});
  }
 }
 return [...groups.values()];
}
export function activitySummary(kinds:string[],grades:ActivityGrade[],student:string,period:number){
 const required=[...new Set(kinds)].filter(k=>ACTIVITY_NAMES[k]);if(!required.length)return null;
 const values=required.map(k=>grades.find(g=>g.student_id===student&&g.activity_type===k&&g.period_no===period)?.result);
 if(values.some(v=>v!=='pass'&&v!=='fail'))return null;
 return values.some(v=>v==='fail')?'ไม่ผ่าน':'ผ่าน';
}
