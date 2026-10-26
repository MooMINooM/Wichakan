export const ACTIVITY_LABELS:Record<string,string>={
 computing:'วิทยาการคำนวณ',
 sss:'สสส.',
 guidance:'แนะแนว',
 ethics:'อบรมคุณธรรม',
 club:'ชุมนุม',
 scout:'ลูกเสือ–เนตรนารี'
};
export type TimetableTeacherProfile={user_id:string;display_name:string|null};
export function timetableTeacherNames(teacherIds:string[],profiles:TimetableTeacherProfile[]):string {
 const uniqueIds=[...new Set(teacherIds.filter(Boolean))];
 if(!uniqueIds.length)return 'ยังไม่ระบุครูผู้สอน';
 const names=uniqueIds.map(id=>profiles.find(p=>p.user_id===id)?.display_name?.trim()||'ไม่พบชื่อครู');
 return [...new Set(names)].join(' / ');
}
