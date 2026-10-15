'use client';
import {useEffect,useState} from 'react';
import {AcademicIcon} from '@/components/academic-visuals';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {SCORE_FIELDS,SCORE_LABELS,evaluateScore,settingCaps,validCaps,type ScoreRecord,type ScoreSetting} from '@/lib/teacher-scores';
import {teacherError,type TeacherStudent} from '@/lib/use-teacher-workspace';
type Draft={values:string[];special:string;dirty:boolean;savedComplete:boolean};
type Props={offeringId:string;students:TeacherStudent[];records:ScoreRecord[];setting?:ScoreSetting;onDirty:(dirty:boolean)=>void;onBusy:(busy:boolean)=>void;onSaved:(record:ScoreRecord)=>void};
export default function TeacherScoreGrid({offeringId,students,records,setting,onDirty,onBusy,onSaved}:Props){
 const [drafts,setDrafts]=useState<Record<string,Draft>>(()=>Object.fromEntries(students.map(s=>{const r=records.find(r=>r.student_id===s.id&&r.course_offering_id===offeringId);return [s.id,{values:SCORE_FIELDS.map(f=>r?.[f]==null?'':String(r[f])),special:r?.special_result??'',dirty:false,savedComplete:r?.is_complete??false}];})));
 const [filter,setFilter]=useState(''),[busy,setBusy]=useState(false),[saveProgress,setSaveProgress]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[failures,setFailures]=useState<Record<string,string>>({});
 const caps=settingCaps(setting),configured=validCaps(caps),dirty=Object.values(drafts).some(d=>d.dirty);
 const complete=(d:Draft)=>d.savedComplete&&!d.dirty&&evaluateScore(d.values,d.special,caps).complete;
 const normal=students.filter(s=>complete(drafts[s.id])&&!drafts[s.id].special).length,special=students.filter(s=>complete(drafts[s.id])&&!!drafts[s.id].special).length;
 const remaining=students.length-normal-special;
 useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
 useEffect(()=>{onBusy(busy);},[busy,onBusy]);
 function update(id:string,change:Partial<Draft>){if(busy)return;setDrafts(old=>({...old,[id]:{...old[id],...change,dirty:true}}));setError('');setNotice('');setFailures(old=>{const next={...old};delete next[id];return next;});}
 async function save(mode:'partial'|'complete',only?:string){
  const db=getSupabaseBrowserClient();if(!db||busy||!configured)return;
  const changed=students.filter(s=>drafts[s.id].dirty&&(!only||s.id===only));if(!changed.length)return;
  const invalid=changed.filter(s=>!evaluateScore(drafts[s.id].values,drafts[s.id].special,caps).valid);
  if(invalid.length){setError('ตรวจคะแนนรหัส '+invalid.map(s=>s.student_no).join(', ')+': ต้องเป็นจำนวนเต็ม 0–คะแนนเต็ม');return;}
  if(mode==='complete'){
   const incomplete=students.filter(s=>!evaluateScore(drafts[s.id].values,drafts[s.id].special,caps).complete);
   if(incomplete.length){setError('ยังกรอกไม่ครบ '+incomplete.length+' คน กรุณากรอกให้ครบ ระบุ ร / มส หรือใช้ “บันทึกบางส่วน”');return;}
  }
  setBusy(true);setError('');setNotice('');const errors:Record<string,string>={};let saved=0;
  for(let i=0;i<changed.length;i++){
   const student=changed[i],draft=drafts[student.id],result=evaluateScore(draft.values,draft.special,caps);setSaveProgress((i+1)+'/'+changed.length);
   try{
    const r=await db.rpc('save_student_course_score',{p_offering_id:offeringId,p_student_id:student.id,p_scores:result.numbers,p_special:draft.special||null});if(r.error)throw r.error;
    const record={course_offering_id:offeringId,student_id:student.id,special_result:draft.special||null,is_complete:result.complete,...Object.fromEntries(SCORE_FIELDS.map((f,index)=>[f,result.numbers[index]]))} as ScoreRecord;
    onSaved(record);setDrafts(old=>({...old,[student.id]:{...old[student.id],dirty:false,savedComplete:result.complete}}));saved++;
   }catch(e){errors[student.id]=teacherError(e);}
  }
  setFailures(errors);setBusy(false);setSaveProgress('');if(saved)setNotice('บันทึกแล้ว '+saved+' คน');if(Object.keys(errors).length)setError('บันทึกไม่สำเร็จ '+Object.keys(errors).length+' คน ข้อมูลที่ยังไม่บันทึกยังคงอยู่ กรุณาลองอีกครั้ง');
 }
 const displayed=students.filter(s=>filter==='special'?!!drafts[s.id].special:filter==='complete'?complete(drafts[s.id]):filter==='incomplete'?!complete(drafts[s.id]):true);
 const termCap=(start:number)=>configured?caps.slice(start,start+3).reduce((a,b)=>a+b,0):'—';
 return <>
  {!configured&&<p role="alert" className="teacher-warning">{!setting?'Admin ยังไม่ได้ตั้งค่าคะแนนเต็มของรายวิชานี้':'คะแนนเต็มทั้ง 6 ช่องต้องรวมเท่ากับ 100 กรุณาให้ Admin แก้ไข'} จึงยังบันทึกคะแนนไม่ได้</p>}
  <section className="teacher-metrics" aria-label="สรุปคะแนนนักเรียน">
   {([{label:'นักเรียนทั้งหมด',value:students.length,icon:'users',color:'purple'},{label:'บันทึกคะแนนแล้ว',value:normal,icon:'check',color:'green'},{label:'ยังไม่ครบ',value:remaining,icon:'calendar',color:'orange'},{label:'ร / มส',value:special,icon:'file',color:'red'}] as const).map(m=><div key={m.label} className={'teacher-metric '+m.color}><i><AcademicIcon name={m.icon}/></i><div><p>{m.label}</p><strong>{m.value} <small>คน</small></strong></div></div>)}
  </section>
  <section className="ui-panel score-panel" aria-labelledby="score-table-heading">
   <div className="score-panel-toolbar"><h2 id="score-table-heading"><AcademicIcon name="check"/>ตารางบันทึกคะแนน</h2><div className="score-caps"><span>ภาคเรียน 1: เก็บ {caps[0]??'—'} | กลางภาค {caps[1]??'—'} | ปลายภาค {caps[2]??'—'}</span><span>ภาคเรียน 2: เก็บ {caps[3]??'—'} | กลางภาค {caps[4]??'—'} | ปลายภาค {caps[5]??'—'}</span><strong>รวมทั้งปี: {setting?caps.reduce((a,b)=>a+b,0):'—'} คะแนน</strong></div></div>
   <div className="score-tools"><label>แสดงนักเรียน<select aria-label="กรองนักเรียนตามสถานะคะแนน" disabled={busy} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">ทั้งหมด ({students.length})</option><option value="complete">บันทึกครบ</option><option value="incomplete">ยังไม่ครบ</option><option value="special">ร / มส</option></select></label><span className={'teacher-state '+(!students.length?'no-students':!configured?'configuration':dirty?'progress':remaining?'empty':'complete')}>{!students.length?'ยังไม่มีนักเรียน':!configured?'รอตั้งคะแนนเต็ม':dirty?'มีคะแนนยังไม่บันทึก':remaining?'กำลังบันทึกคะแนน':'บันทึกครบแล้ว'}</span></div>
   {error&&<p role="alert" className="teacher-error">{error}</p>}{notice&&<p role="status" className="teacher-success">{notice}</p>}
   <div className="score-table-scroll"><table className="score-table"><thead><tr><th rowSpan={2} className="score-number">เลขที่</th><th rowSpan={2} className="score-code">รหัส</th><th rowSpan={2} className="score-name">ชื่อ–นามสกุล</th><th colSpan={4} className="score-term-one">ภาคเรียนที่ 1</th><th colSpan={4} className="score-term-two">ภาคเรียนที่ 2</th><th rowSpan={2}>รวม<br/>ทั้งหมด<br/><small>({configured?100:'—'})</small></th><th rowSpan={2}>เกรด</th><th rowSpan={2}>หมายเหตุ</th></tr><tr>{[0,1,2].map(i=><th key={i}>{['เก็บ','กลางภาค','ปลายภาค'][i]}<small>({caps[i]??'—'})</small></th>)}<th>รวม<br/>ภาคเรียน 1<small>({termCap(0)})</small></th>{[3,4,5].map(i=><th key={i}>{['เก็บ','กลางภาค','ปลายภาค'][i-3]}<small>({caps[i]??'—'})</small></th>)}<th>รวม<br/>ภาคเรียน 2<small>({termCap(3)})</small></th></tr></thead><tbody>{displayed.map(student=>{
    const d=drafts[student.id],value=evaluateScore(d.values,d.special,caps),index=students.findIndex(s=>s.id===student.id);
    const input=(i:number)=><td key={'input'+i}><input aria-label={SCORE_LABELS[i]+' '+student.student_no} aria-invalid={value.invalid[i]||undefined} title={'คะแนนเต็ม '+(caps[i]??'—')} type="number" inputMode="numeric" min="0" max={caps[i]??0} step="1" disabled={!configured||busy} value={d.values[i]} onChange={e=>update(student.id,{values:d.values.map((s,j)=>j===i?e.target.value:s)})}/></td>;
    return <tr key={student.id} className={(d.dirty?'score-dirty ':'')+(failures[student.id]?'score-failed':'')}><td className="score-number">{index+1}</td><td className="score-code">{student.student_no}</td><th scope="row" className="score-name">{student.first_name_th} {student.last_name_th}</th>{[0,1,2].map(input)}<td><output className="score-output term-one" aria-label={'รวมภาคเรียน 1 '+student.student_no}>{value.term1??'—'}</output></td>{[3,4,5].map(input)}<td><output className="score-output term-two" aria-label={'รวมภาคเรียน 2 '+student.student_no}>{value.term2??'—'}</output></td><td><output className="score-output total" aria-label={'รวมทั้งหมด '+student.student_no}>{value.total??'—'}</output></td><td><output className={'score-output grade '+(d.special==='ร'?'special-r':d.special==='มส'?'special-ms':value.total!==null&&value.total>=50?'pass':'')} aria-label={'เกรด '+student.student_no}>{value.grade}</output></td><td className="score-note"><select aria-label={'หมายเหตุ '+student.student_no} disabled={!configured||busy} value={d.special} onChange={e=>update(student.id,{special:e.target.value})}><option value="">—</option><option value="ร">ร</option><option value="มส">มส</option></select>{d.dirty&&<button type="button" disabled={!value.valid||busy} onClick={()=>void save('partial',student.id)} aria-label={'บันทึกแถว '+student.student_no}>บันทึก</button>}{failures[student.id]&&<small role="alert">{failures[student.id]}</small>}</td></tr>;
   })}</tbody></table></div>
   {!students.length&&<p className="teacher-empty">ไม่มีนักเรียนลงทะเบียนในห้องที่เลือก</p>}{students.length>0&&!displayed.length&&<p className="teacher-empty">ไม่พบนักเรียนตามสถานะที่เลือก</p>}
   <footer className="score-footer"><span><AcademicIcon name="users"/>บันทึกครบ <strong>{normal+special}/{students.length}</strong> คน</span><div><button type="button" className="ui-secondary" disabled={!dirty||busy||!configured} onClick={()=>void save('partial')}><AcademicIcon name="file"/>บันทึกบางส่วน</button><button type="button" className="ui-primary" disabled={!dirty||busy||!configured} onClick={()=>void save('complete')}><AcademicIcon name="check"/>{busy?'กำลังบันทึก '+saveProgress:'บันทึกคะแนน'}</button></div></footer>
   <details className="score-help"><summary>วิธีกรอกคะแนน</summary><p>ช่องว่างหมายถึงยังไม่กรอก ไม่ใช่ 0 · ใช้คะแนนเต็มตามที่ Admin กำหนด · ร / มส แสดงแทนเกรดตัวเลข · บันทึกบางส่วนเก็บคะแนนที่กรอกไว้ได้ ระบบนับว่าครบเมื่อกรอกทั้ง 6 ช่องหรือระบุ ร / มส</p></details>
  </section>
 </>;
}
