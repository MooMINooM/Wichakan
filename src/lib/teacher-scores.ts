export const SCORE_FIELDS=['term1_coursework','term1_midterm','term1_final','term2_coursework','term2_midterm','term2_final'] as const;
export const SCORE_LABELS=['คะแนนเก็บ ภาคเรียน 1','กลางภาค ภาคเรียน 1','ปลายภาค ภาคเรียน 1','คะแนนเก็บ ภาคเรียน 2','กลางภาค ภาคเรียน 2','ปลายภาค ภาคเรียน 2'];
export type ScoreSetting={subject_id:string;academic_year_id:string;term1_coursework:number;term1_midterm:number;term1_final:number;term2_coursework:number;term2_midterm:number;term2_final:number};
export type ScoreRecord={course_offering_id:string;student_id:string;term1_coursework:number|null;term1_midterm:number|null;term1_final:number|null;term2_coursework:number|null;term2_midterm:number|null;term2_final:number|null;special_result:string|null;is_complete:boolean};
export const numericGrade=(total:number)=>total>=80?'4':total>=75?'3.5':total>=70?'3':total>=65?'2.5':total>=60?'2':total>=55?'1.5':total>=50?'1':'0';
export function settingCaps(setting?:ScoreSetting){return setting?SCORE_FIELDS.map(f=>setting[f]):[];}
export type ScoreMode='annual'|'semester';
export function scoreMode(level:string|null|undefined):ScoreMode{return level?.startsWith('ม.')?'semester':'annual';}
export function validCaps(caps:number[],mode:ScoreMode='annual'){return caps.length===6&&caps.every(n=>Number.isInteger(n)&&n>=0&&n<=100)&&(mode==='annual'?caps.reduce((a,b)=>a+b,0)===100:caps.slice(0,3).reduce((a,b)=>a+b,0)===100&&caps.slice(3).reduce((a,b)=>a+b,0)===100);}
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
