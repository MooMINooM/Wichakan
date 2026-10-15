export type SchoolRoom={id:string;academic_year_id:string;level_code:string;room_code:string};
export type SchoolEnrollment={student_id:string;classroom_id:string;academic_year_id:string;status:string};
export type SchoolOffering={id:string;classroom_id:string;term_id:string;subject_id:string};
export type SchoolAssignment={course_offering_id:string};
export type LevelReadiness={level:string;rooms:number;students:number;courses:number;assigned:number;offeringCount:number;assignedOfferings:number;missingStudentRooms:number;missingCourseRooms:number;progress:number;status:'ready'|'progress'|'empty'};
const levels=['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'];

// A subject is assigned at level scope only if every room offering has a teacher.
// Readiness covers preparation for grading; it does not imply scores are complete.
export function summarizeLevels(rooms:SchoolRoom[],enrollments:SchoolEnrollment[],offerings:SchoolOffering[],assignments:SchoolAssignment[],yearId:string,termId:string):LevelReadiness[]{
 const yearRooms=rooms.filter(r=>r.academic_year_id===yearId);
 const assignedIds=new Set(assignments.map(a=>a.course_offering_id));
 return [...new Set(yearRooms.map(r=>r.level_code))].sort((a,b)=>{
  const ai=levels.indexOf(a),bi=levels.indexOf(b);return (ai<0?99:ai)-(bi<0?99:bi)||a.localeCompare(b,'th');
 }).map(level=>{
  const group=yearRooms.filter(r=>r.level_code===level),roomIds=new Set(group.map(r=>r.id));
  const students=new Set(enrollments.filter(e=>e.academic_year_id===yearId&&roomIds.has(e.classroom_id)&&['active','completed'].includes(e.status)).map(e=>e.student_id)).size;
  const courses=offerings.filter(o=>o.term_id===termId&&roomIds.has(o.classroom_id));
  const subjectIds=[...new Set(courses.map(o=>o.subject_id))];
  const assigned=subjectIds.filter(id=>courses.filter(o=>o.subject_id===id).every(o=>assignedIds.has(o.id))).length;
  const assignedOfferings=courses.filter(o=>assignedIds.has(o.id)).length;
  const studentRooms=group.filter(r=>enrollments.some(e=>e.academic_year_id===yearId&&e.classroom_id===r.id&&['active','completed'].includes(e.status))).length;
  const hasStudentsInEveryRoom=studentRooms===group.length;
  const courseRooms=group.filter(r=>courses.some(o=>o.classroom_id===r.id)).length;
  const hasCoursesInEveryRoom=!!termId&&courseRooms===group.length;
  const ready=hasStudentsInEveryRoom&&hasCoursesInEveryRoom&&assignedOfferings===courses.length;
  const rawProgress=Math.round((studentRooms/group.length+courseRooms/group.length+(courses.length?assignedOfferings/courses.length:0))/3*100);
  const progress=ready?100:Math.min(99,rawProgress);
  return {level,rooms:group.length,students,courses:subjectIds.length,assigned,offeringCount:courses.length,assignedOfferings,missingStudentRooms:group.length-studentRooms,missingCourseRooms:group.length-courseRooms,progress,status:ready?'ready':students||courses.length?'progress':'empty'};
 });
}
