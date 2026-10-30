import {numericGrade} from './teacher-scores';
import type {Pp6Subject,Pp6Cell} from './pp6-grades';

/**
 * SchoolMIS compatibility is a report projection, never a change to how teachers
 * enter scores, receive teaching assignments, or print individual PP5 books.
 */
const primaryPart=(code:string)=>code.match(/^([พศ])1([1-6])(101|102)$/u);
export const isInternalSecondaryComputer=(subject:Pp6Subject,level:string)=>
 level.startsWith('ม.')&&/^ง2[1-3]20[12]$/u.test(subject.subject_code)&&/คอมพิวเตอร์/u.test(subject.name_th);

const primaryName=(area:string,grade:string)=>
 area==='พ'?'สุขศึกษาและพลศึกษา '+grade:'ศิลปะ ดนตรี นาฏศิลป์ '+grade;

function pairOf(subject:Pp6Subject,subjects:Pp6Subject[]):Pp6Subject|undefined{
 const match=primaryPart(subject.subject_code);
 if(!match||match[3]!=='101')return undefined;
 return subjects.find(s=>s.subject_code===match[1]+'1'+match[2]+'102');
}
export function officialPp6Subjects(subjects:Pp6Subject[],level:string):Pp6Subject[]{
 if(!level.startsWith('ป.'))return subjects.filter(s=>!isInternalSecondaryComputer(s,level));
 return subjects.filter(s=>primaryPart(s.subject_code)?.[3]!=='102').map(s=>{
  const match=primaryPart(s.subject_code);
  if(!match||match[3]!=='101')return s;
  const companion=pairOf(s,subjects);
  // A missing companion must not fabricate full course hours or a completed grade.
  return {...s,name_th:primaryName(match[1],match[2]),
   learning_hours:companion?(s.learning_hours??0)+(companion.learning_hours??0):0,
   category:'basic'};
 });
}

function combinedCell(primary:Pp6Cell|undefined,secondary:Pp6Cell|undefined,subjectId:string,termNo:number):Pp6Cell{
 const missing: Pp6Cell={subjectId,grade:'—',score:null,state:'missing'};
 if(!primary||!secondary)return missing;
 if(primary.state==='duplicate'||secondary.state==='duplicate')return {...missing,grade:'ตรวจสอบ',state:'duplicate'};
 if(primary.state==='special'||secondary.state==='special'){
  const special=[primary,secondary].find(c=>c.grade==='มส')?.grade
   ??[primary,secondary].find(c=>c.grade==='ร')?.grade??'—';
  return {...missing,grade:special,state:'special'};
 }
 if(termNo===1){
  if(primary.state==='inprogress'&&secondary.state==='inprogress'
    &&primary.score!==null&&secondary.score!==null)
   return {subjectId,score:(primary.score+secondary.score)/2,grade:'ระหว่างปี',state:'inprogress'};
  return {...missing,state:primary.state==='missing'||secondary.state==='missing'?'missing':'inprogress'};
 }
 if(primary.state!=='complete'||secondary.state!=='complete'
  ||primary.score===null||secondary.score===null)return {...missing,state:primary.state==='missing'||secondary.state==='missing'?'missing':'inprogress'};
 const mean=(primary.score+secondary.score)/2;
 // Grade *after* averaging scores. Averaging the two already-rounded grades is incorrect.
 return {subjectId,score:mean,grade:numericGrade(mean),state:'complete'};
}
export function officialPp6Cells(
 sourceSubjects:Pp6Subject[],rawCells:Pp6Cell[],level:string,termNo:number
):Pp6Cell[]{
 const selected=officialPp6Subjects(sourceSubjects,level);
 if(!level.startsWith('ป.'))return selected.map(s=>rawCells.find(c=>c.subjectId===s.id)??{subjectId:s.id,grade:'—',score:null,state:'missing'});
 return selected.map(subject=>{
  const match=primaryPart(subject.subject_code);
  if(!match||match[3]!=='101')return rawCells.find(c=>c.subjectId===subject.id)??{subjectId:subject.id,grade:'—',score:null,state:'missing'};
  const companion=pairOf(subject,sourceSubjects);
  return combinedCell(rawCells.find(c=>c.subjectId===subject.id),
   companion?rawCells.find(c=>c.subjectId===companion.id):undefined,subject.id,termNo);
 });
}
