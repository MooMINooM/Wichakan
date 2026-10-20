import {evaluateScore,SCORE_FIELDS,settingCaps,validCaps,scoreMode} from './teacher-scores';
import type {TeacherWorkspace,TeacherOffering,TeacherStudent} from './use-teacher-workspace';
export type CourseAssessment={student_id:string;trait_scores:number[]|null;reading_scores:number[]|null};
export type Attendance={student_id:string;class_date:string;session_no:number;attendance_status:string};
export type Target={id:string;target_type:string;standard_code:string|null;target_code:string|null;target_description:string;indicator_phase:string|null;display_order:number};
export const TRAITS=['รักชาติ ศาสน์ กษัตริย์','ซื่อสัตย์สุจริต','มีวินัย','ใฝ่เรียนรู้','อยู่อย่างพอเพียง','มุ่งมั่นในการทำงาน','รักความเป็นไทย','มีจิตสาธารณะ'];
export const READING=['ข้อที่ 1','ข้อที่ 2','ข้อที่ 3','ข้อที่ 4','ข้อที่ 5'];
export const QUALITY=['ไม่ผ่าน','ผ่าน','ดี','ดีเยี่ยม'];
export const fullName=(s:TeacherStudent)=>(s.name_prefix_th??'')+s.first_name_th+' '+s.last_name_th;
export const gender=(prefix:string|null)=>/^(เด็กชาย|ด\.ช\.|นาย)(?:\s|$)/.test((prefix??'').trim())?0:/^(เด็กหญิง|ด\.ญ\.|นางสาว|นาง)(?:\s|$)/.test((prefix??'').trim())?1:2;
export const orderStudents=(students:TeacherStudent[])=>[...students].sort((a,b)=>gender(a.name_prefix_th)-gender(b.name_prefix_th)||a.student_no.localeCompare(b.student_no,'th',{numeric:true}));
export const validAssessment=(values:number[]|null|undefined,length:number)=>Array.isArray(values)&&values.length===length&&values.every(n=>Number.isInteger(n)&&n>=0&&n<=3);
// Match the supplied workbook: traits = rounded average; reading totals 13/10/5.
export function assessmentQuality(values:number[]|null|undefined,group:'traits'|'reading'){
 if(!validAssessment(values,group==='traits'?8:5))return null;
 const sum=values!.reduce((a,b)=>a+b,0);return group==='traits'?Math.round(sum/8):sum>=13?3:sum>=10?2:sum>=5?1:0;
}
export function pp5Score(data:TeacherWorkspace,o:TeacherOffering,sid:string){
 const room=data.rooms.find(r=>r.id===o.classroom_id),term=data.terms.find(t=>t.id===o.term_id),mode=scoreMode(room?.level_code);
 const record=data.scores.find(r=>r.course_offering_id===o.id&&r.student_id===sid),caps=settingCaps(data.settings.find(s=>s.subject_id===o.subject_id&&s.academic_year_id===room?.academic_year_id));
 const result=evaluateScore(SCORE_FIELDS.map(k=>record?.[k]==null?'':String(record[k])),record?.special_result??'',caps,mode,term?.term_no??1),offset=term?.term_no===2?3:0;
 const termScores=SCORE_FIELDS.slice(offset,offset+3).map(k=>record?.[k]??null),termReady=validCaps(caps,mode)&&result.valid&&(!!record?.special_result||termScores.every(n=>n!==null));
 // A first-term primary PP5 needs that term's scores, not future second-term scores.
 return {caps: caps.slice(offset,offset+3),scores:termScores,total:offset===0?result.term1:result.term2,grade:record?.special_result||(mode==='annual'&&!result.complete?'—':result.grade),complete:termReady};
}
export function attendanceSessions(records:Attendance[]){return [...new Map(records.map(r=>[r.class_date+'#'+r.session_no,{date:r.class_date,period:r.session_no}])).values()].sort((a,b)=>a.date.localeCompare(b.date)||a.period-b.period);}
export function eligibleForLesson(data:TeacherWorkspace,o:TeacherOffering,sid:string,date:string){
 const year=data.rooms.find(r=>r.id===o.classroom_id)?.academic_year_id;
 return data.enrollments.some(e=>e.student_id===sid&&e.classroom_id===o.classroom_id&&e.academic_year_id===year&&['active','completed'].includes(e.status)&&(!e.started_on||e.started_on<=date)&&(!e.ended_on||e.ended_on>=date));
}
export function pp5Readiness(data:TeacherWorkspace,o:TeacherOffering,roster:TeacherStudent[],attendance:Attendance[],assessments:CourseAssessment[],expected:number){
 const sessions=attendanceSessions(attendance),map=new Map(attendance.map(r=>[r.student_id+'#'+r.class_date+'#'+r.session_no,r]));
 const scoreMissing=roster.filter(s=>!pp5Score(data,o,s.id).complete).length;
 const traitsMissing=roster.filter(s=>!validAssessment(assessments.find(a=>a.student_id===s.id)?.trait_scores,8)).length;
 const readingMissing=roster.filter(s=>!validAssessment(assessments.find(a=>a.student_id===s.id)?.reading_scores,5)).length;
 let missingCells=0;for(const s of roster)for(const session of sessions){if(!eligibleForLesson(data,o,s.id,session.date))continue;const entry=map.get(s.id+'#'+session.date+'#'+session.period);if(!entry||!['present','absent','late','leave'].includes(entry.attendance_status))missingCells++;}
 const attendanceReady=expected>0&&sessions.length>=expected&&missingCells===0;
 return {ready:roster.length>0&&!scoreMissing&&!traitsMissing&&!readingMissing&&attendanceReady,scoreMissing,traitsMissing,readingMissing,missingCells,attendanceReady,sessions:sessions.length,expected};
}
export function weekOf(date:string,anchor:string){const d=new Date(date+'T00:00:00Z'),a=new Date(anchor+'T00:00:00Z');a.setUTCDate(a.getUTCDate()-((a.getUTCDay()+6)%7));return Math.max(0,Math.floor((d.getTime()-a.getTime())/604800000));}
