import {evaluateScore,settingCaps,scoreMode,type ScoreRecord,type ScoreSetting} from './teacher-scores';
export type Pp6Subject={id:string;subject_code:string;name_th:string;grade_level:string|null;category?:string;learning_hours?:number};
export type Pp6Offering={id:string;subject_id:string;classroom_id:string;term_id:string};
export type Pp6Term={id:string;term_no:number;academic_year_id:string};
export type Pp6Cell={subjectId:string;grade:string;score:number|null;state:'complete'|'special'|'missing'|'inprogress'|'duplicate'};
export function pp6Matrix(subjects:Pp6Subject[],offerings:Pp6Offering[],terms:Pp6Term[],scores:ScoreRecord[],settings:ScoreSetting[],studentId:string,yearId:string,termNo:number,level:string):Pp6Cell[]{
 const secondary=scoreMode(level)==='semester';
 return subjects.map(subject=>{
  const ids=offerings.filter(o=>o.subject_id===subject.id&&terms.some(t=>t.id===o.term_id&&t.academic_year_id===yearId&&(!secondary||t.term_no===termNo))).map(o=>o.id);
  const records=scores.filter(r=>r.student_id===studentId&&ids.includes(r.course_offering_id));
  const setting=settings.find(s=>s.subject_id===subject.id&&s.academic_year_id===yearId);
  const evaluated=records.map(r=>evaluateScore(['term1_coursework','term1_midterm','term1_final','term2_coursework','term2_midterm','term2_final'].map(k=>{const v=r[k as keyof ScoreRecord];return v==null?'':String(v)}),r.special_result??'',settingCaps(setting),secondary?'semester':'annual',termNo));
  if(!records.length)return {subjectId:subject.id,grade:'—',score:null,state:'missing'};
  if(records.length>1)return {subjectId:subject.id,grade:'ตรวจสอบ',score:null,state:'duplicate'};
  const result=evaluated[0];
  if(result.grade==='ร'||result.grade==='มส')return {subjectId:subject.id,grade:result.grade,score:null,state:'special'};
  if(secondary&&result.complete)return {subjectId:subject.id,grade:result.grade,score:result.total,state:'complete'};
  if(!secondary&&termNo===1)return {subjectId:subject.id,grade:'ระหว่างปี',score:result.term1,state:'inprogress'};
  if(result.complete)return {subjectId:subject.id,grade:result.grade,score:result.total,state:'complete'};
  return {subjectId:subject.id,grade:'—',score:result.term1,state:'inprogress'};
 });
}
