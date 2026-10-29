import {recordTermProgress,scoreMode,settingCaps,validCaps,type ScoreRecord,type ScoreSetting} from './teacher-scores';
import {validAssessment} from './pp5';
import {activityGroups,ACTIVITY_NAMES,type ActivitySchedule,type ActivityGrade} from './activity-assessments';
import type {TeacherRoom,TeacherOffering,TeacherEnrollment,TeacherTerm} from './use-teacher-workspace';
export type DirectorTerm=TeacherTerm&{starts_on:string|null;ends_on:string|null};
export type DirectorSubject={id:string;subject_code:string;name_th:string;grade_level:string|null;category:string};
export type DirectorAssignment={course_offering_id:string;teacher_user_id:string};
export type DirectorHome={classroom_id:string;teacher_user_id:string};
export type DirectorProfile={user_id:string;display_name:string};
export type AttendanceProgress={course_offering_id:string;expected:number;saved:number;issue:string|null};
export type DirectorAssessment={course_offering_id:string;student_id:string;trait_scores:number[]|null;reading_scores:number[]|null};
export type DirectorActivityGrade=ActivityGrade&{classroom_id:string;academic_year_id:string};
export type DirectorData={rooms:TeacherRoom[];terms:DirectorTerm[];offerings:TeacherOffering[];subjects:DirectorSubject[];assignments:DirectorAssignment[];homerooms:DirectorHome[];profiles:DirectorProfile[];enrollments:TeacherEnrollment[];scores:ScoreRecord[];settings:ScoreSetting[];assessments:DirectorAssessment[];attendance:AttendanceProgress[];activities:ActivitySchedule[];activityGrades:DirectorActivityGrade[]};
export type ProgressCount={done:number;total:number;percent:number|null};
export type DirectorCourse={id:string;name:string;code:string;teachers:string[];scores:ProgressCount;attendance:ProgressCount;attendanceIssue:string|null;traits:ProgressCount;reading:ProgressCount;issues:string[]};
export type DirectorActivity={key:string;name:string;teachers:string[];progress:ProgressCount;period:number};
export type DirectorRoom={room:TeacherRoom;studentIds:string[];homerooms:string[];courses:DirectorCourse[];activities:DirectorActivity[];scores:ProgressCount;attendance:ProgressCount;traits:ProgressCount;reading:ProgressCount;activity:ProgressCount;issues:string[];complete:boolean};
export const countProgress=(done:number,total:number):ProgressCount=>({done,total,percent:total>0?Math.floor(done/total*100):null});
export const sumProgress=(values:ProgressCount[])=>countProgress(values.reduce((n,v)=>n+v.done,0),values.reduce((n,v)=>n+v.total,0));
export const directorRoomLabel=(r:TeacherRoom)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
export function directorOverview(data:DirectorData,yearId:string,termId:string):DirectorRoom[]{
 const term=data.terms.find(t=>t.id===termId&&t.academic_year_id===yearId);if(!term)return [];
 const profileMap=new Map(data.profiles.map(p=>[p.user_id,p.display_name.trim()||'ไม่พบชื่อครู']));
 const names=(ids:string[])=>[...new Set(ids)].map(id=>profileMap.get(id)??'ไม่พบชื่อครู');
 const scores=new Map(data.scores.map(s=>[s.course_offering_id+'#'+s.student_id,s]));
 const assessments=new Map(data.assessments.map(s=>[s.course_offering_id+'#'+s.student_id,s]));
 const attendance=new Map(data.attendance.map(s=>[s.course_offering_id,s]));
 const settings=new Map(data.settings.filter(s=>s.academic_year_id===yearId).map(s=>[s.subject_id,s]));
 const groups=activityGroups(data.activities,data.rooms,data.terms);
 return data.rooms.filter(r=>r.academic_year_id===yearId&&/^(ป\.|ม\.)/.test(r.level_code)).sort((a,b)=>a.level_code.localeCompare(b.level_code,'th',{numeric:true})||a.room_code.localeCompare(b.room_code,'th',{numeric:true})).map(room=>{
  const studentIds=[...new Set(data.enrollments.filter(e=>e.classroom_id===room.id&&e.academic_year_id===yearId&&['active','completed'].includes(e.status)).map(e=>e.student_id))];
  const homeroomIds=data.homerooms.filter(h=>h.classroom_id===room.id).map(h=>h.teacher_user_id),homerooms=names(homeroomIds);
  const courses=data.offerings.filter(o=>o.classroom_id===room.id&&o.term_id===termId&&data.subjects.find(s=>s.id===o.subject_id)?.category!=='activity').map(o=>{
   const subject=data.subjects.find(s=>s.id===o.subject_id),setting=settings.get(o.subject_id),mode=scoreMode(room.level_code),configured=validCaps(settingCaps(setting),mode),a=attendance.get(o.id);
   const teachers=names(data.assignments.filter(t=>t.course_offering_id===o.id).map(t=>t.teacher_user_id));
   const issues:string[]=[];if(!teachers.length)issues.push('ยังไม่มอบหมายครู');if(teachers.includes('ไม่พบชื่อครู'))issues.push('ตรวจสอบชื่อครูผู้สอน');if(!configured)issues.push('รอตั้งคะแนนเต็ม');if(!subject)issues.push('ไม่พบรายวิชา');
   const attendanceIssues:Record<string,string>={dates:'รอกำหนดวันภาคเรียน',slots:'ยังไม่มีคาบสอน/คาบบูรณาการ',future:'ยังไม่ถึงวันเปิดภาคเรียน','no-lessons':'ยังไม่มีคาบที่ต้องบันทึก'};
   if(!a)issues.push('ไม่พบข้อมูลเวลาเรียน');else if(a.issue)issues.push(attendanceIssues[a.issue]??'ตรวจสอบเวลาเรียน');
   const complete=studentIds.filter(id=>recordTermProgress(scores.get(o.id+'#'+id),setting,mode,term.term_no).complete).length;
   const traits=studentIds.filter(id=>validAssessment(assessments.get(o.id+'#'+id)?.trait_scores,8)).length,reading=studentIds.filter(id=>validAssessment(assessments.get(o.id+'#'+id)?.reading_scores,5)).length;
   return {id:o.id,name:subject?.name_th??'ไม่พบรายวิชา',code:subject?.subject_code??'—',teachers,scores:countProgress(configured?complete:0,studentIds.length),attendance:countProgress(Number(a?.saved??0),Number(a?.expected??0)),attendanceIssue:a?.issue??(!a?'missing':null),traits:countProgress(traits,studentIds.length),reading:countProgress(reading,studentIds.length),issues};
  }).sort((a,b)=>a.code.localeCompare(b.code,'th',{numeric:true}));
  const activities=groups.filter(g=>g.classroom_id===room.id&&g.period_no===(room.level_code.startsWith('ป.')?0:term.term_no)).map(g=>{
   const peers=data.activities.filter(a=>a.classroom_id===room.id&&a.activity_type===g.activity_type&&data.terms.some(t=>t.id===a.term_id&&t.academic_year_id===yearId)),direct=peers.filter(a=>a.term_id===termId),applicable=g.period_no&&direct.length?direct:peers;
   const owners=applicable.flatMap(a=>a.teacher_user_id?[a.teacher_user_id]:[]);
   const done=studentIds.filter(id=>data.activityGrades.some(a=>a.classroom_id===room.id&&a.academic_year_id===yearId&&a.activity_type===g.activity_type&&a.period_no===g.period_no&&a.student_id===id&&['pass','fail'].includes(a.result??''))).length;
   return {key:g.key,name:ACTIVITY_NAMES[g.activity_type],teachers:names(owners.length?owners:homeroomIds),progress:countProgress(done,studentIds.length),period:g.period_no};
  });
  const issues:string[]=[];if(!studentIds.length)issues.push('ยังไม่มีนักเรียน');if(!homerooms.length)issues.push('ยังไม่มีครูประจำชั้น');if(!courses.length)issues.push('ยังไม่มีรายวิชา');if(!activities.length)issues.push('ยังไม่กำหนดกิจกรรม');if(activities.some(a=>!a.teachers.length||a.teachers.includes('ไม่พบชื่อครู')))issues.push('ตรวจสอบครูกิจกรรม');
  const summary={scores:sumProgress(courses.map(c=>c.scores)),attendance:sumProgress(courses.map(c=>c.attendance)),traits:sumProgress(courses.map(c=>c.traits)),reading:sumProgress(courses.map(c=>c.reading)),activity:sumProgress(activities.map(a=>a.progress))};
  const complete=!issues.length&&courses.every(c=>!c.issues.length)&&[summary.scores,summary.attendance,summary.traits,summary.reading,summary.activity].every(p=>p.total>0&&p.done===p.total);
  return {room,studentIds,homerooms,courses,activities,...summary,issues,complete};
 });
}
