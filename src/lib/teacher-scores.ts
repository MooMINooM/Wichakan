import type {TeacherWorkspace,TeacherOffering} from './use-teacher-workspace';
export const SCORE_FIELDS=['term1_coursework','term1_midterm','term1_final','term2_coursework','term2_midterm','term2_final'] as const;
export const SCORE_LABELS=['คะแนนเก็บ ภาคเรียน 1','กลางภาค ภาคเรียน 1','ปลายภาค ภาคเรียน 1','คะแนนเก็บ ภาคเรียน 2','กลางภาค ภาคเรียน 2','ปลายภาค ภาคเรียน 2'];
export type ScoreSetting={subject_id:string;academic_year_id:string;term1_coursework:number;term1_midterm:number;term1_final:number;term2_coursework:number;term2_midterm:number;term2_final:number};
export type ScoreRecord={course_offering_id:string;student_id:string;term1_coursework:number|null;term1_midterm:number|null;term1_final:number|null;term2_coursework:number|null;term2_midterm:number|null;term2_final:number|null;special_result:string|null;is_complete:boolean};
export const numericGrade=(total:number)=>total>=80?'4':total>=75?'3.5':total>=70?'3':total>=65?'2.5':total>=60?'2':total>=55?'1.5':total>=50?'1':'0';
export function settingCaps(setting?:ScoreSetting){return setting?SCORE_FIELDS.map(f=>setting[f]):[];}
export type ScoreMode='annual'|'semester';
export function scoreMode(level:string|null|undefined):ScoreMode{return level?.startsWith('ม.')?'semester':'annual';}
// Primary scores contain both semesters in one row. Timetable offerings remain
// separate, but every score entry point uses the first semester's annual ledger.
// Only resolve within the caller's authorized offerings, same room and year.
export function scoreOffering(data:Pick<TeacherWorkspace,'offerings'|'rooms'|'subjects'|'terms'>,offering:TeacherOffering):TeacherOffering{
 const room=data.rooms.find(r=>r.id===offering.classroom_id);
 const level=room?.level_code??data.subjects.find(s=>s.id===offering.subject_id)?.grade_level;
 if(!level?.startsWith('ป.'))return offering;
 const year=data.terms?.find(t=>t.id===offering.term_id)?.academic_year_id;
 if(!year||year!==room?.academic_year_id)return offering;
 return data.offerings.find(o=>o.classroom_id===offering.classroom_id&&o.subject_id===offering.subject_id
  &&data.terms.some(t=>t.id===o.term_id&&t.academic_year_id===year&&t.term_no===1))??offering;
}
export function validCaps(caps:number[],mode:ScoreMode='annual'){return caps.length===6&&caps.every(n=>Number.isInteger(n)&&n>=0&&n<=100)&&(mode==='annual'?caps.slice(0,3).reduce((a,b)=>a+b,0)===50&&caps.slice(3).reduce((a,b)=>a+b,0)===50:caps.slice(0,3).reduce((a,b)=>a+b,0)===100&&caps.slice(3).reduce((a,b)=>a+b,0)===100);}
export function evaluateScore(values:string[],special:string,caps:number[],mode:ScoreMode='annual',termNo=2){
 const numbers=values.map(v=>v.trim()===''?null:Number(v));
 const invalid=numbers.map((v,i)=>v!==null&&(!Number.isInteger(v)||v<0||v>caps[i]));
 const valid=validCaps(caps,mode)&&numbers.length===6&&!invalid.some(Boolean)&&['','ร','มส'].includes(special);
 const sum=(start:number)=>valid&&numbers.slice(start,start+3).every(v=>v!==null)?numbers.slice(start,start+3).reduce<number>((a,b)=>a+(b??0),0):null;
 const term1=sum(0),term2=sum(3),total=term1!==null&&term2!==null?term1+term2:null;
 const selected=mode==='semester'?(termNo===1?term1:term2):total;
 const complete=valid&&(!!special||selected!==null);
 return {numbers,invalid,valid,complete,term1,term2,total:selected,grade:valid?(special||(selected===null?'—':numericGrade(selected))):'—'};
}
export function recordComplete(record:ScoreRecord|undefined,setting:ScoreSetting|undefined,mode:ScoreMode='annual',termNo=2){return !!record?.is_complete&&evaluateScore(SCORE_FIELDS.map(f=>record[f]===null?'':String(record[f])),record.special_result??'',settingCaps(setting),mode,termNo).complete;}

// Dashboard progress follows the selected semester, independently of annual
// grading and the persisted annual is_complete flag.
export function recordTermProgress(record:ScoreRecord|undefined,setting:ScoreSetting|undefined,mode:ScoreMode='annual',termNo=1){
 const offset=termNo===2?3:0,special=record?.special_result??'';
 const started=!!record&&(SCORE_FIELDS.slice(offset,offset+3).some(f=>record[f]!=null)||['ร','มส'].includes(special));
 const values=SCORE_FIELDS.map((f,i)=>i>=offset&&i<offset+3&&record?.[f]!=null?String(record[f]):'');
 const result=evaluateScore(values,special,settingCaps(setting),mode,termNo);
 return {started,complete:!!record&&result.valid&&(!!special||(termNo===2?result.term2:result.term1)!==null)};
}
