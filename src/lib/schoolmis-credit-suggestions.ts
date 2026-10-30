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
 sameName:boolean;historicalVersion:boolean;
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
 return {
  credit:found.s.learning_hours/40,
  hours:found.s.learning_hours,
  version:found.version.version_label,
  effectiveYear:found.version.effective_year_be,
  sameName:comparableName(row.name)===comparableName(found.s.name_th),
  historicalVersion:found.version.effective_year_be<=row.year
 };
}
