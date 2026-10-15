export type SchoolRoom={id:string;academic_year_id:string;level_code:string;room_code:string};
export type SchoolEnrollment={student_id:string;classroom_id:string;academic_year_id:string;status:string};
export type SchoolOffering={id:string;classroom_id:string;term_id:string;subject_id:string};
export type SchoolAssignment={course_offering_id:string};
export type SchoolSubject={id:string;curriculum_version_id:string;subject_code:string;grade_level:string|null};
export type SchoolCurriculumVersion={id:string;curriculum_id:string;effective_year_be:number};
export type LevelReadiness={level:string;rooms:number;students:number;courses:number;assigned:number;unassigned:number;expectedSlots:number;assignedSlots:number;missingStudentRooms:number;progress:number;status:'ready'|'progress'|'empty'};
const levels=['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'];

// The latest effective version of each curriculum is the year-specific catalog.
// Group duplicate codes in equally effective versions; retain IDs for assignment matching.
export function curriculumCourses(subjects:SchoolSubject[],versions:SchoolCurriculumVersion[],yearBE:number,level:string):string[][]{
 const latest=new Map<string,number>();
 for(const v of versions)if(v.effective_year_be<=yearBE)latest.set(v.curriculum_id,Math.max(latest.get(v.curriculum_id)??0,v.effective_year_be));
 const active=new Map(versions.filter(v=>v.effective_year_be===latest.get(v.curriculum_id)).map(v=>[v.id,v.curriculum_id]));
 const grouped=new Map<string,string[]>();
 for(const s of subjects){
  const curriculum=active.get(s.curriculum_version_id);if(!curriculum||s.grade_level!==level)continue;
  const key=JSON.stringify([curriculum,s.subject_code]);
  grouped.set(key,[...(grouped.get(key)??[]),s.id]);
 }
 return [...grouped.values()];
}

// A registered curriculum subject is covered only when ALL rooms have a teacher
// in the selected term, including subjects that have no course_offerings row yet.
export function summarizeLevels(rooms:SchoolRoom[],enrollments:SchoolEnrollment[],offerings:SchoolOffering[],assignments:SchoolAssignment[],yearId:string,termId:string,subjects:SchoolSubject[],versions:SchoolCurriculumVersion[],yearBE:number):LevelReadiness[]{
 const yearRooms=rooms.filter(r=>r.academic_year_id===yearId);
 const assignedIds=new Set(assignments.map(a=>a.course_offering_id));
 return [...new Set(yearRooms.map(r=>r.level_code))].sort((a,b)=>{
  const ai=levels.indexOf(a),bi=levels.indexOf(b);return (ai<0?99:ai)-(bi<0?99:bi)||a.localeCompare(b,'th');
 }).map(level=>{
  const group=yearRooms.filter(r=>r.level_code===level),roomIds=new Set(group.map(r=>r.id));
  const students=new Set(enrollments.filter(e=>e.academic_year_id===yearId&&roomIds.has(e.classroom_id)&&['active','completed'].includes(e.status)).map(e=>e.student_id)).size;
  const expected=curriculumCourses(subjects,versions,yearBE,level);
  const taught=offerings.filter(o=>o.term_id===termId&&roomIds.has(o.classroom_id)&&assignedIds.has(o.id));
  const covered=(ids:string[],roomId:string)=>taught.some(o=>o.classroom_id===roomId&&ids.includes(o.subject_id));
  const assigned=expected.filter(ids=>group.every(r=>covered(ids,r.id))).length;
  const assignedSlots=expected.reduce((n,ids)=>n+group.filter(r=>covered(ids,r.id)).length,0);
  const expectedSlots=expected.length*group.length;
  const studentRooms=group.filter(r=>enrollments.some(e=>e.academic_year_id===yearId&&e.classroom_id===r.id&&['active','completed'].includes(e.status))).length;
  const ready=studentRooms===group.length&&!!termId&&expectedSlots>0&&assignedSlots===expectedSlots;
  const rawProgress=Math.round((studentRooms/group.length+(expected.length?1:0)+(expectedSlots?assignedSlots/expectedSlots:0))/3*100);
  const progress=ready?100:Math.min(99,rawProgress);
  return {level,rooms:group.length,students,courses:expected.length,assigned,unassigned:expected.length-assigned,expectedSlots,assignedSlots,missingStudentRooms:group.length-studentRooms,progress,status:ready?'ready':students||expected.length?'progress':'empty'};
 });
}
