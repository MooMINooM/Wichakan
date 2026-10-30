
/** Safe CSV parser for SchoolMIS whole-stage grade exports; never mutates live course scores. */
export type HistoryEntry={
 student_no:string;student_name:string;student_id?:string;
 academic_year_be:number;level_code:string;grade_number:number;term_no:number;
 subject_key:string;subject_code:string;subject_name:string;source_column:number;
 result_text:string;grade_value:number|null;is_activity:boolean;
};
export type SchoolmisPreview={
 entries:HistoryEntry[];studentCount:number;historicalGradeCount:number;activityCount:number;
 zeroSkipped:number;currentSkipped:number;unknownResults:number;issues:string[];
};
export function parseSchoolmisCsv(text:string):string[][]{
 const result:string[][]=[];let row:string[]=[],field='',quoted=false;
 const raw=text.replace(/^\uFEFF/,'');
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(quoted){
   if(c==='"'&&raw[i+1]==='"'){field+='"';i++;}
   else if(c==='"')quoted=false;
   else field+=c;
  }else if(c==='"'&&field==='')quoted=true;
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'||c==='\r'){
   if(c==='\r'&&raw[i+1]==='\n')i++;
   row.push(field);field='';
   if(row.some(v=>v.trim()))result.push(row);
   row=[];
  }else field+=c;
 }
 if(quoted)throw Error('ไฟล์ CSV มีเครื่องหมายอัญประกาศไม่ครบ');
 if(field||row.length){row.push(field);if(row.some(v=>v.trim()))result.push(row);}
 return result;
}
export function normalizeStudentName(text:string){
 return text.trim().replace(/^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.)/u,'')
 .replace(/[\s.\-–]/g,'').normalize('NFC');
}
export function recognizeSchoolmisLevel(fileName:string):string{
 const x=fileName.match(/ชั้น(ประถม|มัธยม)ศึกษาปีที่\s*([1-6])/);
 return x?(x[1]==='ประถม'?'ป.':'ม.')+x[2]:'';
}
export function buildSchoolmisPreview(
 text:string,referenceYear:number,currentLevel:string,includeZero=false
):SchoolmisPreview{
 const matrix=parseSchoolmisCsv(text),header=matrix[0]??[],issues:string[]=[];
 if(header[0]?.trim()!=='#'||header[1]?.trim()!=='รหัสนักเรียน'||header[2]?.trim()!=='ชื่อ-สกุล')
  throw Error('ไม่ใช่ไฟล์คะแนน CSV รูปแบบ SchoolMIS (ต้องมี #, รหัสนักเรียน, ชื่อ-สกุล)');
 if(!/^(ป\.[1-6]|ม\.[1-3])$/.test(currentLevel))throw Error('กรุณาเลือกระดับชั้นที่ส่งออก');
 if(!Number.isInteger(referenceYear)||referenceYear<2500||referenceYear>2700)throw Error('ปีการศึกษาไม่ถูกต้อง');
 if(matrix.length<2||matrix.length>501)throw Error('ไม่พบข้อมูลนักเรียนหรือมีนักเรียนเกิน 500 คน');
 if(header.length<15||header.length>250)throw Error('จำนวนคอลัมน์ไม่ตรงกับไฟล์ SchoolMIS');
 const primary=currentLevel.startsWith('ป.'),currentNumber=Number(currentLevel.slice(2));
 const seenNumbers=new Set<string>(),entries:HistoryEntry[]=[];
 let zeroSkipped=0,currentSkipped=0,unknownResults=0,activityCount=0,historicalGradeCount=0;
 // In the secondary file every term starts with a Thai subject:
 // ท21101, ท21102, ท22101, ท22102, ท23101, ท23102.
 let slot=0,activityIndex=0;
 const termSlots=primary?[]:['ท21101','ท21102','ท22101','ท22102','ท23101','ท23102'];
 let activityStart=header.findIndex((h,i)=>i>=3&&/^ก\d{5}\s/u.test(h));
 if(activityStart<0)activityStart=header.length;
 const specs=header.map((label,col)=>{
  if(col<3)return null;
  const match=label.trim().match(/^([^\s]+)\s+(.+)$/u);
  if(!match){issues.push('คอลัมน์ '+(col+1)+': ไม่พบรหัสและชื่อวิชา');return null;}
  const code=match[1],name=match[2].trim(),activity=code.startsWith('ก');
  if(activity){
   const index=activityIndex++,period=Math.floor(index/4);
   const gradeNumber=primary?period+1:Math.floor(period/2)+1,termNo=primary?0:period%2+1;
   if(!/^ก\d{5}$/u.test(code)||gradeNumber>(primary?6:3)){issues.push('คอลัมน์ '+(col+1)+': รหัสกิจกรรมหรือช่วงชั้นไม่ถูกต้อง');return null;}
   return {code,name,col,isActivity:true,gradeNumber,termNo};
  }
  const core=code.match(/^([ทควสพศงอ])([12])([1-6])\d{3}$/u);
  if(!core){issues.push('คอลัมน์ '+(col+1)+': ไม่รองรับรหัสวิชา '+code);return null;}
  const gradeNumber=Number(core[3]),track=core[2];
  if((primary?'1':'2')!==track||(primary?gradeNumber>6:gradeNumber>3)){
   issues.push('คอลัมน์ '+(col+1)+': รายวิชาไม่อยู่ในช่วงชั้นที่เลือก');return null;
  }
  if(!primary){
   const anchor=termSlots.indexOf(code);
   if(anchor>=0)slot=anchor;
   // Validate that non-anchor codes follow their term anchor; don't trust odd/even codes.
   if(Math.floor(slot/2)+1!==gradeNumber){
    issues.push('คอลัมน์ '+(col+1)+': ลำดับภาคเรียนไม่ตรงตามไฟล์ SchoolMIS');
    return null;
   }
  }
  return {code,name,col,isActivity:false,gradeNumber,termNo:primary?0:slot%2+1};
 });
 if(specs.filter(Boolean).length<10)throw Error('ไม่พบโครงสร้างรายวิชาของ SchoolMIS ที่รองรับ');
 for(let index=1;index<matrix.length;index++){
  const row=matrix[index],no=(row[1]??'').trim(),studentName=(row[2]??'').trim();
  if(!no||!studentName){issues.push('แถว '+(index+1)+': ไม่มีรหัสนักเรียนหรือชื่อ');continue;}
  if(seenNumbers.has(no)){issues.push('แถว '+(index+1)+': รหัสนักเรียนซ้ำในไฟล์');continue;}
  seenNumbers.add(no);
  if(row.length!==header.length){issues.push('แถว '+(index+1)+': จำนวนคอลัมน์ไม่ตรงกับหัวตาราง');continue;}
  for(const spec of specs){
   if(!spec)continue;
   const val=(row[spec.col]??'').trim();
   if(!val)continue;
   if(spec.gradeNumber>currentNumber || spec.gradeNumber===currentNumber){currentSkipped++;continue;}
   const academicYear=referenceYear-(currentNumber-spec.gradeNumber);
   if(academicYear>=referenceYear)continue;
   const isZero=val==='0';
   if(isZero&&!includeZero){zeroSkipped++;continue;}
   let gradeValue:number|null=null;
   if(spec.isActivity){
    if(!['ผ','มผ'].includes(val)){unknownResults++;continue;}
   }else if(val==='ร'||val==='มส'){
    gradeValue=null;
   }else if(/^(0|[1-3](\.5)?|4)$/.test(val)){
    gradeValue=Number(val);
   }else{unknownResults++;continue;}
   entries.push({
    student_no:no,student_name:studentName,academic_year_be:academicYear,
    level_code:(primary?'ป.':'ม.')+spec.gradeNumber,grade_number:spec.gradeNumber,term_no:spec.termNo,
    subject_key:spec.isActivity?'ACT:'+spec.col:spec.code,subject_code:spec.code,subject_name:spec.name,
    source_column:spec.col,is_activity:spec.isActivity,result_text:val,grade_value:gradeValue
   });
   if(spec.isActivity)activityCount++;else historicalGradeCount++;
  }
 }
 if(!seenNumbers.size)issues.push('ไม่พบนักเรียนในไฟล์');
 return {entries,studentCount:seenNumbers.size,historicalGradeCount,activityCount,
  zeroSkipped,currentSkipped,unknownResults,issues};
}
