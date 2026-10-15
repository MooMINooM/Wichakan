import {curriculumCourses,type SchoolSubject,type SchoolCurriculumVersion,type SchoolRoom,type SchoolOffering} from './school-readiness';
export type AssignmentSubject=SchoolSubject&{name_th:string};
export type TeachingAssignment={id:string;course_offering_id:string;teacher_user_id:string};
export type AssignmentRow={key:string;room:SchoolRoom;subject:AssignmentSubject|null;subjectIds:string[];assignments:TeachingAssignment[];teacherIds:string[];legacy:boolean};
/** Curriculum × room is the baseline, including subjects without an offering yet. */
export function teacherAssignmentRows(rooms:SchoolRoom[],subjects:AssignmentSubject[],versions:SchoolCurriculumVersion[],offerings:SchoolOffering[],assignments:TeachingAssignment[],yearBE:number,termId:string):AssignmentRow[]{
 if(!termId)return [];
 const bySubject=new Map(subjects.map(s=>[s.id,s]));
 const byOffering=new Map<string,TeachingAssignment[]>();
 for(const a of assignments){const group=byOffering.get(a.course_offering_id);if(group)group.push(a);else byOffering.set(a.course_offering_id,[a]);}
 return rooms.flatMap(room=>{
  const current=offerings.filter(o=>o.classroom_id===room.id&&o.term_id===termId);
  const catalog=curriculumCourses(subjects,versions,yearBE,room.level_code);
  const covered=new Set(catalog.flat());
  // Retain existing offerings outside the current catalog so their teachers can still be managed.
  const groups=[...catalog.map(ids=>({ids,legacy:false})),...[...new Set(current.filter(o=>!covered.has(o.subject_id)).map(o=>o.subject_id))].map(id=>({ids:[id],legacy:true}))];
  return groups.map(({ids,legacy})=>{
   const matched=current.filter(o=>ids.includes(o.subject_id));
   const list=[...new Map(matched.flatMap(o=>byOffering.get(o.id)??[]).map(a=>[a.id,a])).values()];
   return {key:room.id+':'+ids.join(','),room,subject:bySubject.get(matched[0]?.subject_id??ids[0])??null,subjectIds:ids,assignments:list,teacherIds:[...new Set(list.map(a=>a.teacher_user_id))],legacy};
  });
 });
}
