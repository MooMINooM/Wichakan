'use client';
import {useEffect,useState} from 'react';
import {getSupabaseBrowserClient} from './supabase/browser';
import type {DirectorData,DirectorTerm,DirectorSubject,DirectorAssignment,DirectorHome,DirectorProfile,DirectorAssessment,DirectorActivityGrade,AttendanceProgress} from './director-overview';
import type {TeacherRoom,TeacherOffering,TeacherEnrollment,TeacherYear} from './use-teacher-workspace';
import type {ScoreRecord,ScoreSetting} from './teacher-scores';
import type {ActivitySchedule} from './activity-assessments';
export async function directorRows<T>(query:(from:number,to:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>){const rows:T[]=[];for(let from=0;;from+=500){const result=await query(from,from+499);if(result.error)throw result.error;rows.push(...(result.data??[]) as T[]);if((result.data?.length??0)<500)return rows;}}
async function batches<T>(ids:string[],query:(ids:string[],from:number,to:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>){const rows:T[]=[];const unique=[...new Set(ids)];for(let i=0;i<unique.length;i+=100)rows.push(...await directorRows<T>((a,b)=>query(unique.slice(i,i+100),a,b)));return rows;}
const message=(e:unknown)=>(e as {message?:string})?.message??'ไม่สามารถโหลดข้อมูลได้';
type Base={schoolId:string;years:TeacherYear[];terms:DirectorTerm[];rooms:TeacherRoom[];teacherIds:string[];profiles:DirectorProfile[];homerooms:DirectorHome[]};
export function useDirectorBase(retry:number){
 const db=getSupabaseBrowserClient(),[data,setData]=useState<Base|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;setData(null);setError('');setLoading(true);(async()=>{try{
  if(!db)throw Error('ไม่สามารถเชื่อมต่อระบบ');const auth=await db.auth.getUser();if(auth.error)throw auth.error;if(!auth.data.user)throw Error('กรุณาเข้าสู่ระบบ');
  const memberships=await db.from('school_memberships').select('school_id,role').eq('user_id',auth.data.user.id).eq('active',true).in('role',['director','school_admin']).order('school_id');if(memberships.error)throw memberships.error;const schoolId=memberships.data?.[0]?.school_id;if(!schoolId)throw Error('ไม่มีสิทธิ์ดูแดชบอร์ดผู้บริหาร');
  const [years,terms,rooms,teachers,homes]=await Promise.all([
   directorRows<TeacherYear>((a,b)=>db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('year_be',{ascending:false}).order('id').range(a,b)),
   directorRows<DirectorTerm>((a,b)=>db.from('terms').select('id,academic_year_id,term_no,starts_on,ends_on').eq('school_id',schoolId).order('term_no').order('id').range(a,b)),
   directorRows<TeacherRoom>((a,b)=>db.from('classrooms').select('id,academic_year_id,level_code,room_code').eq('school_id',schoolId).order('id').range(a,b)),
   directorRows<{user_id:string}>((a,b)=>db.from('school_memberships').select('user_id').eq('school_id',schoolId).eq('active',true).eq('role','teacher').order('id').range(a,b)),
   directorRows<DirectorHome>((a,b)=>db.from('homeroom_assignments').select('classroom_id,teacher_user_id').eq('school_id',schoolId).order('id').range(a,b))
  ]);
  const teacherIds=[...new Set(teachers.map(t=>t.user_id))],profiles=await batches<DirectorProfile>(teacherIds,(ids,a,b)=>db.from('profiles').select('user_id,display_name').in('user_id',ids).order('user_id').range(a,b));
  if(live)setData({schoolId,years,terms,rooms,teacherIds,profiles,homerooms:homes.filter(h=>teacherIds.includes(h.teacher_user_id))});
 }catch(e){if(live)setError(message(e));}finally{if(live)setLoading(false);}})();return()=>{live=false;};},[db,retry]);return {data,loading,error};
}
export function useDirectorReport(base:Base|null,yearId:string,termId:string,retry:number){
 const db=getSupabaseBrowserClient(),[data,setData]=useState<DirectorData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[updated,setUpdated]=useState(''),[scope,setScope]=useState('');
 useEffect(()=>{let live=true;setData(null);setError('');setUpdated('');setLoading(false);if(!db||!base||!yearId||!base.terms.some(t=>t.id===termId&&t.academic_year_id===yearId))return;setLoading(true);
 (async()=>{try{const school=base.schoolId,roomIds=base.rooms.filter(r=>r.academic_year_id===yearId).map(r=>r.id);
  const [offerings,enrollments,settings,activities,activityGrades,attendanceResult]=await Promise.all([
   batches<TeacherOffering>(roomIds,(ids,a,b)=>db.from('course_offerings').select('id,classroom_id,subject_id,term_id').eq('school_id',school).eq('term_id',termId).in('classroom_id',ids).order('id').range(a,b)),
   batches<TeacherEnrollment>(roomIds,(ids,a,b)=>db.from('enrollments').select('student_id,classroom_id,academic_year_id,status,started_on,ended_on').eq('school_id',school).eq('academic_year_id',yearId).in('classroom_id',ids).in('status',['active','completed']).order('id').range(a,b)),
   directorRows<ScoreSetting>((a,b)=>db.from('subject_score_settings').select('subject_id,academic_year_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final').eq('school_id',school).eq('academic_year_id',yearId).order('id').range(a,b)),
   batches<ActivitySchedule>(base.terms.filter(t=>t.academic_year_id===yearId).map(t=>t.id),(ids,a,b)=>db.from('school_activity_schedules').select('id,school_id,term_id,classroom_id,activity_type,teacher_user_id').eq('school_id',school).in('term_id',ids).order('id').range(a,b)),
   directorRows<DirectorActivityGrade>((a,b)=>db.from('school_activity_period_assessments').select('classroom_id,academic_year_id,student_id,activity_type,period_no,result').eq('school_id',school).eq('academic_year_id',yearId).order('classroom_id').order('activity_type').order('period_no').order('student_id').range(a,b)),
   db.rpc('director_attendance_progress',{p_year:yearId,p_term:termId})
  ]);if(attendanceResult.error)throw attendanceResult.error;
  const ids=offerings.map(o=>o.id),[subjects,assignments,scores,assessments]=await Promise.all([
   batches<DirectorSubject>(offerings.map(o=>o.subject_id),(ids,a,b)=>db.from('subjects').select('id,subject_code,name_th,grade_level,category').eq('school_id',school).in('id',ids).order('id').range(a,b)),
   batches<DirectorAssignment>(ids,(ids,a,b)=>db.from('teaching_assignments').select('course_offering_id,teacher_user_id').eq('school_id',school).in('course_offering_id',ids).order('id').range(a,b)),
   batches<ScoreRecord>(ids,(ids,a,b)=>db.from('student_course_scores').select('course_offering_id,student_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final,special_result,is_complete').eq('school_id',school).in('course_offering_id',ids).order('id').range(a,b)),
   batches<DirectorAssessment>(ids,(ids,a,b)=>db.from('course_student_assessments').select('course_offering_id,student_id,trait_scores,reading_scores').eq('school_id',school).in('course_offering_id',ids).order('course_offering_id').order('student_id').range(a,b))
  ]);
  if(subjects.length!==new Set(offerings.map(o=>o.subject_id)).size)throw Error('อ่านข้อมูลรายวิชาไม่ครบ กรุณาลองใหม่');
  if(live){setScope(base.schoolId+'#'+yearId+'#'+termId);setData({...base,offerings,subjects,assignments:assignments.filter(a=>base.teacherIds.includes(a.teacher_user_id)),enrollments,settings,activities,activityGrades,scores,assessments,attendance:(attendanceResult.data??[]) as AttendanceProgress[]});setUpdated(new Date().toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}));}
 }catch(e){if(live)setError(message(e));}finally{if(live)setLoading(false);}})();return()=>{live=false;};},[db,base,yearId,termId,retry]);return {data:scope===base?.schoolId+'#'+yearId+'#'+termId?data:null,loading,error,updated};
}
