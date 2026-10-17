import {recordComplete,settingCaps,validCaps,scoreMode} from './teacher-scores';
import type {TeacherWorkspace,TeacherOffering} from './use-teacher-workspace';
export type CourseOverview={subjectId:string;code:string;name:string;offerings:TeacherOffering[];roomIds:string[];studentIds:string[];expected:number;saved:number;progress:number|null;configured:boolean;status:'complete'|'progress'|'empty'|'configuration'|'no-students'};
export function teacherOverview(data:TeacherWorkspace,yearId:string,termId:string,selectedSubject=''):CourseOverview[]{
 const bySubject=new Map<string,TeacherOffering[]>();
 for(const o of data.offerings){const room=data.rooms.find(r=>r.id===o.classroom_id);if(room?.academic_year_id!==yearId||o.term_id!==termId||(selectedSubject&&o.subject_id!==selectedSubject))continue;const list=bySubject.get(o.subject_id);if(list)list.push(o);else bySubject.set(o.subject_id,[o]);}
 return [...bySubject].map(([subjectId,offerings])=>{
  const subject=data.subjects.find(s=>s.id===subjectId),setting=data.settings.find(s=>s.subject_id===subjectId&&s.academic_year_id===yearId);
  const mode=scoreMode(subject?.grade_level),termNo=data.terms.find(t=>t.id===termId)?.term_no??1;
  const configured=validCaps(settingCaps(setting),mode),ids=new Set<string>();let expected=0,saved=0;
  for(const o of offerings){const roster=new Set(data.enrollments.filter(e=>e.classroom_id===o.classroom_id&&e.academic_year_id===yearId&&['active','completed'].includes(e.status)).map(e=>e.student_id));expected+=roster.size;for(const id of roster){ids.add(id);if(recordComplete(data.scores.find(s=>s.course_offering_id===o.id&&s.student_id===id),setting,mode,termNo))saved++;}}
  const progress=configured&&expected?Math.floor(saved/expected*100):null;
  const status=!configured?'configuration':!expected?'no-students':saved===expected?'complete':saved?'progress':'empty';
  return {subjectId,code:subject?.subject_code??'—',name:subject?.name_th??'ไม่พบรายวิชา',offerings,roomIds:[...new Set(offerings.map(o=>o.classroom_id))],studentIds:[...ids],expected,saved,progress,configured,status} as CourseOverview;
 }).sort((a,b)=>a.code.localeCompare(b.code,'th',{numeric:true}));
}
