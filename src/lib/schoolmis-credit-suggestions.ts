/**
 * Recommend a *candidate* historical weight from the stored WICHAKAN curriculum.
 * Never silently confirm: an effective-2569 plan does not prove the 2567/2568
 * credit hours were identical, even when the subject codes are unchanged.
 */
export type CurriculumCreditSubject={
 subject_code:string;grade_level:string|null;name_th:string;learning_hours:number;
 hour_basis:string|null;curriculum_version_id:string;
};
export type CurriculumCreditVersion={
 id:string;version_label:string;effective_year_be:number;
};
export type HistoricalCreditRow={
 year:number;level:string;term:number;subject_code:string;name:string;
};
export type CreditCandidate={
 credit:number;hours:number;version:string;effectiveYear:number;
 sameName:boolean;historicalVersion:boolean;companionCode?:string;
};
const comparableName=(name:string)=>
 name.normalize('NFC').replace(/[\s\-–.]/g,'').replace(/นาฎศิลป์/g,'นาฏศิลป์');
export function creditSuggestion(
 row:HistoricalCreditRow,subjects:CurriculumCreditSubject[],versions:CurriculumCreditVersion[]
):CreditCandidate|null{
 const valid=subjects.filter(s=>
  s.subject_code===row.subject_code && s.grade_level===row.level
  && s.learning_hours>0
  && s.hour_basis===(row.level.startsWith('ม.')?'term':'year')
 ).map(s=>({s,version:versions.find(v=>v.id===s.curriculum_version_id)}))
  .filter((p):p is {s:CurriculumCreditSubject;version:CurriculumCreditVersion}=>!!p.version);
 if(!valid.length)return null;
 // Prefer most recent curriculum in force by the historic year;
 // otherwise use the closest future version for REVIEW ONLY.
 valid.sort((a,b)=>{
  const aPast=a.version.effective_year_be<=row.year;
  const bPast=b.version.effective_year_be<=row.year;
  if(aPast!==bPast)return aPast?-1:1;
  return aPast
   ?b.version.effective_year_be-a.version.effective_year_be
   :a.version.effective_year_be-b.version.effective_year_be;
 });
 const found=valid[0];
 // In older SchoolMIS exports primary health+physical education and
 // visual art+music are ONE officially assessed grade. In the current
 // curriculum each consists of two separately recorded teaching subjects.
 // Weight the combined official grade with BOTH annual learning-hours.
 const mergedHealth=row.level.startsWith('ป.')
   && /^พ1[1-6]101$/.test(row.subject_code)
   && /สุขศึกษา.*พลศึกษา/.test(row.name);
 const mergedArts=row.level.startsWith('ป.')
   && /^ศ1[1-6]101$/.test(row.subject_code)
   && /ศิลปะ.*(ดนตรี|นาฏศิลป์|นาฎศิลป์)/.test(row.name);
 const combined=mergedHealth||mergedArts;
 const companionCode=row.subject_code.slice(0,3)+'102';
 const companion=combined?subjects.find(s=>
  s.subject_code===companionCode&&s.grade_level===row.level
  && s.curriculum_version_id===found.s.curriculum_version_id
  && s.hour_basis==='year'&&s.learning_hours>0
 ):undefined;
 if(combined&&!companion)return null; // Never silently underweight the merged grade.
 const totalHours=found.s.learning_hours+(companion?.learning_hours??0);
 return {
  credit:totalHours/40,
  hours:totalHours,
  version:found.version.version_label,
  effectiveYear:found.version.effective_year_be,
  sameName:combined||comparableName(row.name)===comparableName(found.s.name_th),
  historicalVersion:found.version.effective_year_be<=row.year,
  ...(companion?{companionCode}:{}),
 };
}
