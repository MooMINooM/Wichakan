'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import type {ScoreRecord,ScoreSetting} from './teacher-scores';
export type TeacherRoom={id:string;level_code:string;room_code:string;academic_year_id:string};
export type TeacherOffering={id:string;classroom_id:string;subject_id:string;term_id:string};
export type TeacherSubject={id:string;subject_code:string;name_th:string};
export type TeacherStudent={id:string;student_no:string;first_name_th:string;last_name_th:string};
export type TeacherYear={id:string;year_be:number;is_active:boolean};
export type TeacherTerm={id:string;academic_year_id:string;term_no:number};
export type TeacherEnrollment={student_id:string;classroom_id:string;academic_year_id:string;status:string};
export type TeacherWorkspace={schoolId:string;offerings:TeacherOffering[];rooms:TeacherRoom[];subjects:TeacherSubject[];years:TeacherYear[];terms:TeacherTerm[];homerooms:{classroom_id:string}[];enrollments:TeacherEnrollment[];students:TeacherStudent[];scores:ScoreRecord[];settings:ScoreSetting[];hiddenAssignments:number};
const empty:TeacherWorkspace={schoolId:'',offerings:[],rooms:[],subjects:[],years:[],terms:[],homerooms:[],enrollments:[],students:[],scores:[],settings:[],hiddenAssignments:0};
export const teacherRoomLabel=(r:TeacherRoom)=>r.room_code.startsWith(r.level_code+'/')?r.room_code:r.level_code+'/'+r.room_code;
export const teacherError=(e:unknown)=>e instanceof Error?e.message:(e as {message?:string})?.message??'โหลดข้อมูลไม่สำเร็จ';
async function all<T>(query:(from:number,to:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>){const rows:T[]=[];for(let i=0;;i+=500){const r=await query(i,i+499);if(r.error)throw r.error;rows.push(...(r.data??[]) as T[]);if((r.data?.length??0)<500)return rows;}}
async function batches<T>(ids:string[],query:(ids:string[],from:number,to:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>){const rows:T[]=[];const unique=[...new Set(ids)];for(let i=0;i<unique.length;i+=100)rows.push(...await all<T>((a,b)=>query(unique.slice(i,i+100),a,b)));return rows;}
export function useTeacherWorkspace(){
 const db=getSupabaseBrowserClient(),router=useRouter(),sequence=useRef(0);
 const [data,setData]=useState<TeacherWorkspace>(empty),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{
  const seq=++sequence.current;setLoading(true);setError('');
  try{
   if(!db)throw Error('ยังไม่ได้เชื่อมต่อระบบ');
   const auth=await db.auth.getUser();if(auth.error)throw auth.error;if(!auth.data.user){router.replace('/login');return;}
   const user=auth.data.user;
   const roles=await db.from('school_memberships').select('school_id').eq('user_id',user.id).eq('role','teacher').eq('active',true).order('school_id');if(roles.error)throw roles.error;
   const schoolId=roles.data?.[0]?.school_id;if(!schoolId)throw Error('ไม่พบบทบาทครูผู้สอนที่เปิดใช้งาน');
   const [assignments,homerooms,years,terms]=await Promise.all([
    all<{course_offering_id:string}>((a,b)=>db.from('teaching_assignments').select('course_offering_id').eq('school_id',schoolId).eq('teacher_user_id',user.id).order('id').range(a,b)),
    all<{classroom_id:string}>((a,b)=>db.from('homeroom_assignments').select('classroom_id').eq('school_id',schoolId).eq('teacher_user_id',user.id).order('id').range(a,b)),
    all<TeacherYear>((a,b)=>db.from('academic_years').select('id,year_be,is_active').eq('school_id',schoolId).order('id').range(a,b)),
    all<TeacherTerm>((a,b)=>db.from('terms').select('id,academic_year_id,term_no').eq('school_id',schoolId).order('id').range(a,b)),
   ]);
   const offerings=await batches<TeacherOffering>(assignments.map(a=>a.course_offering_id),(ids,a,b)=>db.from('course_offerings').select('id,classroom_id,subject_id,term_id').eq('school_id',schoolId).in('id',ids).order('id').range(a,b));
   const roomIds=[...new Set([...offerings.map(o=>o.classroom_id),...homerooms.map(h=>h.classroom_id)])],subjectIds=offerings.map(o=>o.subject_id);
   const [rooms,subjects,enrollments,scores,settings]=await Promise.all([
    batches<TeacherRoom>(roomIds,(ids,a,b)=>db.from('classrooms').select('id,level_code,room_code,academic_year_id').eq('school_id',schoolId).in('id',ids).order('id').range(a,b)),
    batches<TeacherSubject>(subjectIds,(ids,a,b)=>db.from('subjects').select('id,subject_code,name_th').eq('school_id',schoolId).in('id',ids).order('id').range(a,b)),
    batches<TeacherEnrollment>(roomIds,(ids,a,b)=>db.from('enrollments').select('student_id,classroom_id,academic_year_id,status').eq('school_id',schoolId).in('classroom_id',ids).in('status',['active','completed']).order('id').range(a,b)),
    batches<ScoreRecord>(offerings.map(o=>o.id),(ids,a,b)=>db.from('student_course_scores').select('course_offering_id,student_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final,special_result,is_complete').eq('school_id',schoolId).in('course_offering_id',ids).order('id').range(a,b)),
    batches<ScoreSetting>(subjectIds,(ids,a,b)=>db.from('subject_score_settings').select('subject_id,academic_year_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final').eq('school_id',schoolId).in('subject_id',ids).order('id').range(a,b)),
   ]);
   const students=await batches<TeacherStudent>(enrollments.map(e=>e.student_id),(ids,a,b)=>db.from('students').select('id,student_no,first_name_th,last_name_th').eq('school_id',schoolId).in('id',ids).order('id').range(a,b));
   if(rooms.length!==roomIds.length||subjects.length!==new Set(subjectIds).size||students.length!==new Set(enrollments.map(e=>e.student_id)).size)throw Error('อ่านรายละเอียดงานสอนหรือนักเรียนไม่ครบ กรุณาแจ้งผู้ดูแลตรวจสอบสิทธิ์');
   if(seq!==sequence.current)return;
   setData({schoolId,offerings,rooms,subjects,years:years.sort((a,b)=>b.year_be-a.year_be),terms:terms.sort((a,b)=>a.term_no-b.term_no),homerooms,enrollments,students:students.sort((a,b)=>a.student_no.localeCompare(b.student_no,'th',{numeric:true})),scores,settings,hiddenAssignments:new Set(assignments.map(a=>a.course_offering_id)).size-offerings.length});
  }catch(e){if(seq===sequence.current)setError(teacherError(e));}finally{if(seq===sequence.current)setLoading(false);}
 },[db,router]);
 useEffect(()=>{void reload();return()=>{sequence.current++;};},[reload]);
 function recordSaved(records:ScoreRecord[]){setData(old=>{const keys=new Set(records.map(r=>r.course_offering_id+':'+r.student_id));return {...old,scores:[...old.scores.filter(r=>!keys.has(r.course_offering_id+':'+r.student_id)),...records]};});}
 return {data,loading,error,reload,recordSaved};
}
export function offeringRoster(data:TeacherWorkspace,o:TeacherOffering){const room=data.rooms.find(r=>r.id===o.classroom_id);const ids=new Set(data.enrollments.filter(e=>e.classroom_id===o.classroom_id&&e.academic_year_id===room?.academic_year_id&&['active','completed'].includes(e.status)).map(e=>e.student_id));return data.students.filter(s=>ids.has(s.id));}
