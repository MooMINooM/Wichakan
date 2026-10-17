import type {Pp6Subject,Pp6Cell} from './pp6-grades';

// Use the same hours/40 weight as the existing PP6 GPA calculation.
export function pp6PrintSummary(subjects:Pp6Subject[],cells:Pp6Cell[]){
 const category=(kind:string)=>{
  const rows=subjects.filter(s=>s.category===kind);
  if(!rows.length)return {studied:0,earned:0};
  if(rows.some(s=>!s.learning_hours||s.learning_hours<=0))return {studied:null,earned:null};
  const studied=rows.reduce((n,s)=>n+s.learning_hours!/40,0);
  const earned=rows.every(s=>{const c=cells.find(c=>c.subjectId===s.id);return c?.state==='complete'&&['0','1','1.5','2','2.5','3','3.5','4'].includes(c.grade);})
   ?rows.reduce((n,s)=>n+(Number(cells.find(c=>c.subjectId===s.id)!.grade)>0?s.learning_hours!/40:0),0):null;
  return {studied,earned};
 };
 const basic=category('basic'),additional=category('additional');
 const sum=(a:number|null,b:number|null)=>a===null||b===null?null:a+b;
 return {basic,additional,total:{studied:sum(basic.studied,additional.studied),earned:sum(basic.earned,additional.earned)}};
}
export function pp6PrintOrder(subjects:Pp6Subject[]){
 const categories=['basic','additional'];const prefixes=['ท','ค','ว','ส','พ','ศ','ง','อ'];
 return [...subjects].sort((a,b)=>{
  const category=(s:Pp6Subject)=>categories.includes(s.category??'')?categories.indexOf(s.category!):2;
  const diff=category(a)-category(b);if(diff)return diff;
  if(category(a)===2)return 0;
  const prefix=(s:Pp6Subject)=>{const i=prefixes.indexOf(s.subject_code[0]);return i<0?prefixes.length:i;};
  return prefix(a)-prefix(b)||a.subject_code.localeCompare(b.subject_code,'th',{numeric:true});
 });
}

// Keep Thai combining marks together and bound continuation pages, even for comments full of newlines.
export function pp6CommentPages(comment:string){
 const segmenter=new Intl.Segmenter('th',{granularity:'grapheme'});
 const lines=comment.split(/\r?\n/).flatMap(line=>{
  const characters=Array.from(segmenter.segment(line),s=>s.segment),rows:string[]=[];
  for(let i=0;i<characters.length;i+=50)rows.push(characters.slice(i,i+50).join(''));
  return rows.length?rows:[''];
 });
 return Array.from({length:Math.ceil(lines.length/20)},(_,i)=>lines.slice(i*20,i*20+20).join('\n'));
}
