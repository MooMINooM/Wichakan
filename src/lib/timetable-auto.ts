export type Lesson={course_offering_id:string;weekday_no:number;period_no:number};
export type Course={id:string;classroom_id:string;subject_id:string;target:number;double_period?:boolean};
export type Rule={kind:string;weekday_no:number;period_no:number|null;teacher_user_id:string|null;subject_id:string|null};
export type Teacher={course_offering_id:string;teacher_user_id:string};
export function autoFill(courses:Course[],existing:Lesson[],teachers:Teacher[],rules:Rule[],periodsPerDay=8){
 const taken=[...existing],suggested:Lesson[]=[];
 const teaching=(id:string)=>teachers.filter(a=>a.course_offering_id===id).map(a=>a.teacher_user_id);
 const blocked=(c:Course,d:number,p:number)=>{
  if(rules.some(r=>r.kind==='school_break'&&r.weekday_no===d&&r.period_no===p))return true;
  if(rules.some(r=>r.kind==='subject_day_block'&&r.weekday_no===d&&r.subject_id===c.subject_id))return true;
  const staff=teaching(c.id);
  if(rules.some(r=>r.kind==='teacher_unavailable'&&r.weekday_no===d&&r.period_no===p&&staff.includes(r.teacher_user_id??'')))return true;
  return taken.some(x=>x.weekday_no===d&&x.period_no===p&&(courses.some(z=>z.id===x.course_offering_id&&z.classroom_id===c.classroom_id)||teaching(x.course_offering_id).some(t=>staff.includes(t))));
 };
 // All grade levels share the same teacher occupancy and load counters.
 // Prefer scarce courses first, then spread each teacher's weekly workload across days.
 const teacherDaily=(teacherId:string,day:number)=>taken.filter(x=>x.weekday_no===day&&teaching(x.course_offering_id).includes(teacherId)).length;
 const roomDaily=(roomId:string,day:number)=>taken.filter(x=>x.weekday_no===day&&courses.some(z=>z.id===x.course_offering_id&&z.classroom_id===roomId)).length;
 const queue=[...courses].sort((a,b)=>a.target-b.target);
 for(const c of queue){
  let need=Math.max(0,c.target-taken.filter(x=>x.course_offering_id===c.id).length);
  while(need>0){
   const desiredPair=!!c.double_period&&need>=2;
   const possible=[] as {d:number;p:number;daily:number;balance:number;roomLoad:number}[];
   const staff=teaching(c.id);
   const length=desiredPair?2:1;
   const balanceDelta=(d:number)=>staff.reduce((total,id)=>{
    const counts=[1,2,3,4,5].map(day=>teacherDaily(id,day));
    // Sum-of-squares is minimized by distributing periods as evenly as possible.
    return total+2*length*counts[d-1]+length*length;
   },0);
   for(let d=1;d<=5;d++)for(let p=1;p<=periodsPerDay;p++){
    if(blocked(c,d,p))continue;
    if(desiredPair&&(p===periodsPerDay||blocked(c,d,p+1)))continue;
    possible.push({d,p,daily:taken.filter(x=>x.course_offering_id===c.id&&x.weekday_no===d).length,balance:balanceDelta(d),roomLoad:roomDaily(c.classroom_id,d)});
   }
   possible.sort((a,b)=>a.balance-b.balance||a.daily-b.daily||a.roomLoad-b.roomLoad||a.p-b.p||a.d-b.d);
   if(!possible.length)break;
   for(let offset=0;offset<length;offset++){
    const next={course_offering_id:c.id,weekday_no:possible[0].d,period_no:possible[0].p+offset};
    taken.push(next);suggested.push(next);
   }
   need-=length;
  }
 }
 return {suggested,unplaced:queue.map(c=>({id:c.id,remaining:Math.max(0,c.target-taken.filter(x=>x.course_offering_id===c.id).length)})).filter(x=>x.remaining>0)};
}