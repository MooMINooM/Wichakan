export const ACTIVITY_NAMES:Record<string,string>={sss:'สสส.',guidance:'แนะแนว',ethics:'อบรมคุณธรรม',club:'ชุมนุม',scout:'ลูกเสือ–เนตรนารี'};
export type ActivitySchedule={id:string;school_id:string;term_id:string;classroom_id:string;activity_type:string;teacher_user_id:string|null};
export type ActivityTerm={id:string;academic_year_id:string;term_no:number};
export type ActivityRoom={id:string;academic_year_id:string;level_code:string;room_code:string};
export type ActivityGrade={student_id:string;activity_type:string;period_no:number;result:string|null};
export type ActivityGroup={key:string;classroom_id:string;academic_year_id:string;activity_type:string;period_no:number;assessor:'teacher'|'homeroom'};
export type ActivityHomeroom={id:string;classroom_id:string;teacher_user_id:string;is_activity_recorder:boolean;created_at:string};
export type ActivityViewer={userId:string};
export const activityPeriod=(level:string,term:number)=>level.startsWith('ป.')?0:term;
export const isHomeroomActivity=(kind:string)=>kind==='club'||kind==='scout';

// Exactly one assigned homeroom teacher records both activities in a room.
// An explicit admin choice wins; otherwise use the oldest homeroom assignment.
export function activityRecorders(assignments:ActivityHomeroom[]){
 const sorted=[...assignments].sort((a,b)=>Number(b.is_activity_recorder)-Number(a.is_activity_recorder)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 const result=new Map<string,string>();
 for(const a of sorted)if(!result.has(a.classroom_id))result.set(a.classroom_id,a.teacher_user_id);
 return result;
}
export function activityGroups(schedules:ActivitySchedule[],rooms:ActivityRoom[],terms:ActivityTerm[],viewer?:ActivityViewer,homerooms:ActivityHomeroom[]=[]){
 const groups=new Map<string,ActivityGroup>(),recorders=activityRecorders(homerooms);
 const roomMap=new Map(rooms.map(r=>[r.id,r])),termMap=new Map(terms.map(t=>[t.id,t]));
 for(const s of schedules){
  const r=roomMap.get(s.classroom_id),t=termMap.get(s.term_id);
  if(!r||!t||r.academic_year_id!==t.academic_year_id||!ACTIVITY_NAMES[s.activity_type]||!['ป.','ม.'].some(prefix=>r.level_code.startsWith(prefix)))continue;
  for(const period of r.level_code.startsWith('ป.')?[0]:[1,2]){
   const key=[r.id,s.activity_type,period].join(':');
   if(groups.has(key))continue;
   const peers=schedules.filter(x=>x.classroom_id===r.id&&x.school_id===s.school_id&&x.activity_type===s.activity_type&&termMap.get(x.term_id)?.academic_year_id===r.academic_year_id);
   const direct=peers.filter(x=>termMap.get(x.term_id)?.term_no===period),assigned=period&&direct.length?direct:peers;
   if(viewer){
    if(isHomeroomActivity(s.activity_type)){
     if(recorders.get(r.id)!==viewer.userId)continue;
    }else if(!assigned.some(x=>x.teacher_user_id===viewer.userId))continue;
   }
   groups.set(key,{key,classroom_id:r.id,academic_year_id:t.academic_year_id,activity_type:s.activity_type,period_no:period,assessor:isHomeroomActivity(s.activity_type)?'homeroom':'teacher'});
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
