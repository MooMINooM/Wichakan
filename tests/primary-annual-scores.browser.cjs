// Build with NEXT_PUBLIC_SUPABASE_URL=https://ux-test.supabase.co,
// NEXT_PUBLIC_SUPABASE_ANON_KEY=test and NEXT_PUBLIC_BASE_PATH=/Wichakan.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const fixture=require('./pp5-fixture.cjs')(),d=fixture.data,first=d.offerings[0],second={...first,id:'semester-two',term_id:'term-two'};
 const term={...d.terms[0],id:'term-two',term_no:2};
 const tables={school_memberships:[{id:'member',school_id:fixture.school,user_id:fixture.teacher,role:'teacher',active:true}],
  academic_years:d.years,terms:[...d.terms,term],classrooms:d.rooms,subjects:d.subjects,course_offerings:[second,first],
  teaching_assignments:[first,second].map((o,i)=>({id:'assignment'+i,school_id:fixture.school,teacher_user_id:fixture.teacher,course_offering_id:o.id})),
  homeroom_assignments:d.homerooms.map(h=>({...h,school_id:fixture.school})),students:d.students.map(s=>({...s,school_id:fixture.school})),enrollments:d.enrollments,student_course_scores:d.scores,subject_score_settings:d.settings};
 const root=path.resolve(__dirname,'../out');
 const server=http.createServer((req,res)=>{let p=path.join(root,decodeURI(req.url.split('?')[0]).replace(/^\/Wichakan/,''));try{if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
 try{
  const context=await browser.newContext(),user={id:fixture.teacher,aud:'authenticated',role:'authenticated'},exp=Math.floor(Date.now()/1000)+3600,b64=s=>Buffer.from(JSON.stringify(s)).toString('base64url');
  const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({...user,sub:user.id,exp})+'.test';
  await context.addCookies([{name:'sb-ux-test-auth-token',value:'base64-'+b64({access_token:token,refresh_token:'test',expires_at:exp,expires_in:3600,token_type:'bearer',user}),domain:'127.0.0.1',path:'/'}]);
  const writes=[],fields=['term1_coursework','term1_midterm','term1_final','term2_coursework','term2_midterm','term2_final'];
  await context.route('https://ux-test.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();
   if(url.pathname==='/auth/v1/user')return route.fulfill({json:user});
   if(req.method()!=='GET'){
    assert.equal(table,'save_course_scores');const body=req.postDataJSON();writes.push(body);
    assert.equal(body.p_offering_id,first.id,'semester 2 must save to the original annual ledger');
    for(const row of body.p_rows){const saved=tables.student_course_scores.find(r=>r.course_offering_id===first.id&&r.student_id===row.student_id);assert(saved);Object.assign(saved,Object.fromEntries(fields.map((f,i)=>[f,row.scores[i]])),{special_result:row.special,is_complete:row.scores.every(n=>n!==null)});}
    return route.fulfill({json:null});
   }
   let rows=tables[table]??[];
   for(const [key,value] of url.searchParams){if(['select','order','offset','limit'].includes(key))continue;if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3));else if(value.startsWith('in.('))rows=rows.filter(r=>value.slice(4,-1).split(',').includes(String(r[key])));}
   if(url.searchParams.has('offset'))rows=rows.slice(Number(url.searchParams.get('offset')),Number(url.searchParams.get('offset'))+Number(url.searchParams.get('limit')));
   return route.fulfill({json:rows});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port+'/Wichakan',student=fixture.roster[0].student_no;
  await page.goto(base+'/teacher/scores/?offering='+second.id);
  const input=label=>page.getByLabel(label+' '+student,{exact:true});
  await input('คะแนนเก็บ ภาคเรียน 1').waitFor();
  assert.equal(await input('คะแนนเก็บ ภาคเรียน 1').inputValue(),'30');
  await page.getByRole('note').filter({hasText:'ใช้ตารางบันทึกคะแนนชุดเดียวกัน'}).waitFor();
  await input('คะแนนเก็บ ภาคเรียน 2').fill('25');await input('กลางภาค ภาคเรียน 2').fill('8');await input('ปลายภาค ภาคเรียน 2').fill('9');
  await page.getByRole('button',{name:'บันทึกคะแนนทั้งหมด',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.score-footer button')?.disabled);
  assert.equal(writes.length,1);assert.deepEqual(writes[0].p_rows[0].scores,[30,10,10,25,8,9]);
  await page.getByLabel('ภาคเรียนที่เปิดสอนคะแนน').selectOption(first.term_id);
  assert.equal(await input('คะแนนเก็บ ภาคเรียน 2').inputValue(),'25');
  await page.reload();await input('คะแนนเก็บ ภาคเรียน 1').waitFor();
  assert.equal(await input('คะแนนเก็บ ภาคเรียน 2').inputValue(),'25');
  // Both semester deep links read back the same persisted record.
  await page.goto(base+'/teacher/scores/?offering='+first.id);await input('คะแนนเก็บ ภาคเรียน 1').waitFor();
  assert.equal(await input('ปลายภาค ภาคเรียน 2').inputValue(),'9');
  await page.getByLabel('ภาคเรียนที่เปิดสอนคะแนน').selectOption(second.term_id);
  assert.equal(await input('คะแนนเก็บ ภาคเรียน 1').inputValue(),'30');
  assert.match(await page.getByRole('navigation',{name:'เมนูบันทึกข้อมูลรายวิชา'}).getByRole('link',{name:'เวลาเรียน',exact:true}).getAttribute('href'),/semester-two/);
  assert.equal(tables.student_course_scores.filter(r=>r.course_offering_id===second.id).length,0);
  assert.deepEqual(errors,[]);
  console.log('PASS: primary term 2 deep link loads term 1 marks, saves all six fields to the original ledger, survives reload and either semester, attendance keeps term 2 context.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
