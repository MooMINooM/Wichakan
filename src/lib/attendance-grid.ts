import {eligibleForLesson,type Attendance} from './pp5';
import type {TeacherWorkspace,TeacherOffering,TeacherStudent} from './use-teacher-workspace';
export type AttendanceStatus='present'|'absent'|'late'|'leave';
export type AttendanceEntry=Attendance&{attendance_status:AttendanceStatus};
export type TeachingSlot={weekday_no:number;period_no:number};
export type AttendanceDay={date:string;periods:number[];inTerm:boolean;week:number;weekday:number};
const iso=(date:Date)=>date.toISOString().slice(0,10);
export function bangkokToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function attendancePages(start:string,end:string,slots:TeachingSlot[]):AttendanceDay[][]{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)return [];
 const monday=new Date(start+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
 const weeks=Math.floor((Date.parse(end+'T00:00:00Z')-monday.getTime())/604800000)+1;
 return Array.from({length:Math.max(4,Math.ceil(weeks/5))},(_,page)=>Array.from({length:25},(_,i)=>{
  const weekday=i%5+1,week=page*5+Math.floor(i/5),d=new Date(monday);d.setUTCDate(d.getUTCDate()+week*7+weekday-1);const date=iso(d),inTerm=date>=start&&date<=end;
  return {date,inTerm,week:week+1,weekday,periods:inTerm?[...new Set(slots.filter(s=>s.weekday_no===weekday).map(s=>s.period_no))].sort((a,b)=>a-b):[]};
 }));
}
export const attendanceKey=(student:string,date:string,period:number)=>student+'#'+date+'#'+period;
export function attendanceChanges(data:TeacherWorkspace,o:TeacherOffering,roster:TeacherStudent[],days:AttendanceDay[],existing:Attendance[],draft:Record<string,AttendanceStatus>,today:string){
 const saved=new Map(existing.map(e=>[attendanceKey(e.student_id,e.class_date,e.session_no),e.attendance_status]));const rows:AttendanceEntry[]=[];
 for(const s of roster)for(const day of days){if(day.date>today||!eligibleForLesson(data,o,s.id,day.date))continue;for(const period of day.periods){const key=attendanceKey(s.id,day.date,period),status=draft[key]??saved.get(key)??'present';if(status!==saved.get(key))rows.push({student_id:s.id,class_date:day.date,session_no:period,attendance_status:status as AttendanceStatus});}}
 return rows;
}
