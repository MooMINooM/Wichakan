const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'../out');
 const server=http.createServer((req,res)=>{let p=path.join(root,decodeURI(req.url.split('?')[0]).replace(/^\/Wichakan/,''));if(p.endsWith('/'))p+='index.html';try{if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');const b=fs.readFileSync(p);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.ttf')?'font/ttf':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(b);}catch{res.statusCode=404;res.end('not found');}});await new Promise(r=>server.listen(3000,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const actor='33333333-3333-4333-8333-333333333333',school='11111111-1111-4111-8111-111111111111';
 const b64=s=>Buffer.from(JSON.stringify(s)).toString('base64url'),exp=Math.floor(Date.now()/1000)+3600,user={id:actor,aud:'authenticated',role:'authenticated'},token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({...user,sub:actor,exp})+'.test';
 await context.addCookies([{name:'sb-ux-test-auth-token',value:'base64-'+b64({access_token:token,refresh_token:'test',expires_at:exp,expires_in:3600,token_type:'bearer',user}),domain:'127.0.0.1',path:'/'}]);
 const fields=['term1_coursework','term1_midterm','term1_final','term2_coursework','term2_midterm','term2_final'],caps=[30,10,10,30,10,10];
 const students=Array.from({length:10},(_,i)=>({id:'st'+i,school_id:school,student_no:String(2615+i),first_name_th:['ด.ช. ศุภลักษณ์','ด.ญ. ณัฐธิดา','ด.ช. กิตติพงษ์','ด.ญ. ชลธิชา','ด.ช. ธนกร','ด.ญ. กัญญาณัฐ','ด.ช. วรเมธ','ด.ญ. ณิชา','ด.ช. ธันวา','ด.ญ. พิมพ์ชนก'][i],last_name_th:['คำลา','ทรงดี','สายทอง','แก้วดี','บุญมี','สุวรรณ','ชัยวงศ์','สุขใจ','ดีงาม','รัตนา'][i]}));
 const offering=(id,sub,room,term='t1')=>({id,school_id:school,subject_id:sub,classroom_id:room,term_id:term});
 const offerings=[offering('math','s-math','r2'),offering('thai1','s-thai','r1'),offering('thai2','s-thai','r2'),offering('science','s-sci','r2'),offering('social','s-social','r2'),offering('english','s-eng','r2'),offering('math2','s-math','r2','t2')];
 const setting=sub=>({id:'settings-'+sub,school_id:school,subject_id:sub,academic_year_id:'y69',...Object.fromEntries(fields.map((f,i)=>[f,caps[i]]))});
 const record=(id,student,values,special=null,complete=true)=>({id,school_id:school,course_offering_id:'math',student_id:student,...Object.fromEntries(fields.map((f,i)=>[f,values[i]])),special_result:special,is_complete:complete});
 const tables={school_memberships:[{id:'member',school_id:school,user_id:actor,role:'teacher',active:true}],academic_years:[{id:'y69',school_id:school,year_be:2569,is_active:true},{id:'y68',school_id:school,year_be:2568,is_active:false}],terms:[{id:'t1',school_id:school,academic_year_id:'y69',term_no:1},{id:'t2',school_id:school,academic_year_id:'y69',term_no:2}],classrooms:[{id:'r1',school_id:school,academic_year_id:'y69',level_code:'ม.3',room_code:'1'},{id:'r2',school_id:school,academic_year_id:'y69',level_code:'ม.3',room_code:'2'}],teaching_assignments:offerings.map((o,i)=>({id:'a'+i,school_id:school,teacher_user_id:actor,course_offering_id:o.id})),homeroom_assignments:[{id:'h',school_id:school,teacher_user_id:actor,classroom_id:'r2'}],subjects:[['s-math','ค23101','คณิตศาสตร์ 3'],['s-thai','ท23101','ภาษาไทย 3'],['s-sci','ว23101','วิทยาศาสตร์ 3'],['s-social','ส23101','สังคมศึกษา 3'],['s-eng','อ23101','ภาษาอังกฤษ 3']].map(([id,subject_code,name_th])=>({id,school_id:school,subject_code,name_th})),course_offerings:offerings,students,enrollments:students.map((s,i)=>({id:'en'+i,school_id:school,student_id:s.id,classroom_id:i<7?'r2':'r1',academic_year_id:'y69',status:'active'})),subject_score_settings:['s-math','s-thai','s-sci','s-social'].map(setting),student_course_scores:[...Array.from({length:1001},(_,i)=>record('archive'+i,'former'+i,[0,0,0,0,0,0])),record('v0','st0',[26,8,9,24,9,8]),record('v1','st1',[22,8,7,21,8,10]),record('v2','st2',[18,7,9,20,7,7]),record('v3','st3',[28,9,10,27,9,9]),record('v4','st4',[15,6,8,null,null,null],null,false),record('v5','st5',[null,null,null,null,null,null],'ร'),record('v6','st6',[null,null,null,null,null,null],'มส')]};
 tables.school_memberships.push({id:'admin-member',school_id:school,user_id:actor,role:'school_admin',active:true},{id:'director-member',school_id:school,user_id:actor,role:'director',active:true});for(const m of tables.school_memberships)m.schools={id:school,name_th:'โรงเรียนบ้านภูพระโนนผักหวาน'};tables.schools=[{id:school,name_th:'โรงเรียนบ้านภูพระโนนผักหวาน',school_code:'1234567890'}];tables.curriculum_versions=[];tables.profiles=[{user_id:actor,display_name:'ครูตัวอย่าง ทดสอบ'}];tables.pp6_student_assessments=[];for(const r of tables.classrooms)r.level_code='ป.6';for(const s of tables.subjects){s.grade_level='ป.6';s.semester_no=null;}
 tables.homeroom_assignments.push({id:'h2',school_id:school,teacher_user_id:'co-teacher',classroom_id:'r2'});tables.profiles.push({user_id:'co-teacher',display_name:'ครูประจำชั้นคนที่สอง'});
 // Populate two curricula with distinct versions to catch stale cross-curriculum selections.
 tables.curricula=[{id:'c1',school_id:school,name_th:'หลักสูตรสถานศึกษา 2569'},{id:'c2',school_id:school,name_th:'หลักสูตรทดลอง'},{id:'c3',school_id:school,name_th:'หลักสูตรรอจัดทำ'}];
 tables.curriculum_versions=[{id:'v1',school_id:school,curriculum_id:'c1',version_label:'ฉบับเดิม',effective_year_be:2568},{id:'v2',school_id:school,curriculum_id:'c1',version_label:'ฉบับปรับปรุง',effective_year_be:2569},{id:'v3',school_id:school,curriculum_id:'c2',version_label:'ฉบับทดลอง',effective_year_be:2569}];
 for(const s of tables.subjects)Object.assign(s,{curriculum_version_id:'v2',learning_hours:40,hour_basis:'year',category:'basic'});
 tables.subjects.push({...tables.subjects[0],id:'old-thai',curriculum_version_id:'v1',name_th:'ภาษาไทยฉบับเดิม'},{...tables.subjects[0],id:'trial-math',curriculum_version_id:'v3',name_th:'คณิตศาสตร์ทดลอง'});
 for(const s of students)s.status='active';
 let loadFail=false,failSave=false,failSettings=false;const writes=[],scoreOffsets=[];
 tables.subjects.find(s=>s.id==='s-eng').grade_level='ม.1';
 tables.subject_score_settings.push({school_id:school,subject_id:'s-math',academic_year_id:'y68',...Object.fromEntries(fields.map((f,i)=>[f,[20,20,10,20,20,10][i]]))});
 await context.route('https://ux-test.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').pop();if(u.pathname==='/auth/v1/user')return route.fulfill({json:user});
  if(req.method()!=='GET'){
   const body=req.postDataJSON();
   if(table==='edit_curriculum_subject_with_hours'){const subject=tables.subjects.find(s=>s.id===body.p_subject_id);assert(subject);Object.assign(subject,{subject_code:body.p_subject_code,name_th:body.p_name_th,grade_level:body.p_grade_level,category:body.p_category,learning_hours:body.p_learning_hours,hour_basis:body.p_hour_basis});return route.fulfill({json:null});}
   if(table==='set_subject_semester')return route.fulfill({json:null});
   assert.equal(table,'save_subject_score_settings');writes.push(body);
   assert.equal(body.p_school_id,school);assert(tables.academic_years.some(y=>y.id===body.p_year_id));
   const subject=tables.subjects.find(s=>s.id===body.p_subject_id);assert(subject);
   const cap=subject.grade_level.startsWith('ม.')?100:50;assert.equal(body.p_scores.length,6);
   assert(body.p_scores.every(n=>Number.isInteger(n)&&n>=0&&n<=100));
   assert.equal(body.p_scores.slice(0,3).reduce((a,b)=>a+b,0),cap);assert.equal(body.p_scores.slice(3).reduce((a,b)=>a+b,0),cap);
   if(failSave)return route.fulfill({status:400,json:{message:'เริ่มบันทึกคะแนนแล้ว ไม่สามารถเปลี่ยนคะแนนเต็มได้'}});
   tables.subject_score_settings=tables.subject_score_settings.filter(s=>!(s.subject_id===body.p_subject_id&&s.academic_year_id===body.p_year_id));
   tables.subject_score_settings.push({school_id:school,subject_id:body.p_subject_id,academic_year_id:body.p_year_id,...Object.fromEntries(fields.map((f,i)=>[f,body.p_scores[i]]))});
   return route.fulfill({json:'saved-setting'});
  }
  if(failSettings&&table==='subject_score_settings')return route.fulfill({status:503,json:{message:'โหลดโครงสร้างคะแนนไม่สำเร็จ'}});
  if(loadFail&&table==='student_course_scores')return route.fulfill({status:503,json:{message:'อ่านคะแนนไม่สำเร็จ'}});
  let data=tables[table]??[];
  for(const [key,value] of u.searchParams){if(['select','order','offset','limit'].includes(key))continue;if(value.startsWith('eq.'))data=data.filter(r=>String(r[key])===value.slice(3));else if(value.startsWith('in.(')){const ids=value.slice(4,-1).split(',');data=data.filter(r=>ids.includes(String(r[key])));}}
  if(u.searchParams.has('offset')){const offset=Number(u.searchParams.get('offset'));if(table==='student_course_scores')scoreOffsets.push(offset);data=data.slice(offset,offset+Number(u.searchParams.get('limit')));}return route.fulfill({json:data});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/Wichakan/curriculum/');
 await page.waitForFunction(()=>document.querySelector('#curriculum-version-select')?.value==='v2');
 await page.getByRole('combobox',{name:'ระดับชั้น',exact:true}).selectOption('ป.6');
 await page.locator('.curriculum-table tbody tr').filter({hasText:'คณิตศาสตร์ 3'}).getByRole('button',{name:'แก้ไข',exact:true}).click();
 await page.getByRole('tab',{name:'โครงสร้างคะแนน',exact:true}).click();
 const panel=page.getByRole('tabpanel',{name:'โครงสร้างคะแนน',exact:true});
 const save=panel.getByRole('button',{name:'บันทึกโครงสร้างคะแนน',exact:true});
 await panel.getByText('โครงสร้างคะแนนที่บันทึกไว้',{exact:false}).waitFor();
 const coursework=panel.getByRole('spinbutton',{name:'คะแนนเก็บ ภาคเรียนที่ 1',exact:true});
 assert.equal(await coursework.inputValue(),'30');
 for(const invalid of ['31','','1.5','-1']){await coursework.fill(invalid);assert.equal(await save.isDisabled(),true);}
 await coursework.fill('25');await panel.getByRole('spinbutton',{name:'สอบกลางภาค ภาคเรียนที่ 1',exact:true}).fill('15');
 await save.click();await panel.getByRole('status').filter({hasText:'บันทึกโครงสร้างคะแนนเรียบร้อยแล้ว'}).waitFor();
 assert.deepEqual(writes[0],{p_school_id:school,p_year_id:'y69',p_subject_id:'s-math',p_scores:[25,15,10,30,10,10]});
 await page.waitForTimeout(100);assert.equal(await panel.getByRole('status').count(),1,'success remains visible');
 await panel.getByRole('combobox').selectOption('y68');await page.waitForFunction(()=>document.querySelector('input[aria-label="คะแนนเก็บ ภาคเรียนที่ 1"]')?.value==='20');
 await panel.getByRole('combobox').selectOption('y69');await page.waitForFunction(()=>document.querySelector('input[aria-label="คะแนนเก็บ ภาคเรียนที่ 1"]')?.value==='25');
 failSave=true;await save.click();await panel.getByRole('alert').filter({hasText:'เริ่มบันทึกคะแนนแล้ว'}).waitFor();
 assert.equal(await coursework.inputValue(),'25');assert.equal(await save.isDisabled(),false,'server errors allow retry');
 failSave=false;await save.click();await panel.getByRole('status').filter({hasText:'บันทึกโครงสร้างคะแนนเรียบร้อยแล้ว'}).waitFor();
 await page.evaluate(async()=>{await document.fonts.ready});await page.screenshot({path:'/tmp/subject-score-desktop.png',fullPage:true});
 await page.setViewportSize({width:360,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/subject-score-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'ปิดแบบฟอร์ม'}).click();
 await page.getByRole('combobox',{name:'ระดับชั้น',exact:true}).selectOption('ม.1');
 await page.locator('.curriculum-table tbody tr').getByRole('button',{name:'แก้ไข',exact:true}).click();await page.getByRole('tab',{name:'โครงสร้างคะแนน',exact:true}).click();
 await panel.getByText('ค่าเริ่มต้นตามระดับชั้น',{exact:false}).waitFor();
 assert.equal(await coursework.inputValue(),'60');await save.click();await panel.getByRole('status').filter({hasText:'บันทึกโครงสร้างคะแนนเรียบร้อยแล้ว'}).waitFor();
 assert.deepEqual(writes.at(-1).p_scores,[60,20,20,60,20,20]);assert.equal(writes.at(-1).p_subject_id,'s-eng');
 // A failed load must not replace unknown saved settings with defaults.
 failSettings=true;await panel.getByRole('combobox').selectOption('y68');await panel.getByRole('alert').filter({hasText:'โหลดโครงสร้างคะแนนไม่สำเร็จ'}).waitFor();assert.equal(await save.isDisabled(),true);
 failSettings=false;
 // Saving subject metadata should lead straight to the same subject's score editor.
 await page.getByRole('button',{name:'ปิดแบบฟอร์ม'}).click();await page.getByLabel('ฉบับหลักสูตร',{exact:true}).selectOption('v1');await page.getByRole('combobox',{name:'ระดับชั้น',exact:true}).selectOption('ป.6');
 await page.locator('.curriculum-table tbody tr').getByRole('button',{name:'แก้ไข',exact:true}).click();
 await page.getByLabel('ชื่อรายวิชา',{exact:true}).fill('ภาษาไทยฉบับเดิมปรับใหม่');await page.getByRole('button',{name:'บันทึกและตั้งคะแนน',exact:true}).click();
 await panel.getByRole('heading',{name:/ภาษาไทยฉบับเดิมปรับใหม่/}).waitFor();assert.equal(await page.getByRole('tab',{name:'โครงสร้างคะแนน',exact:true}).getAttribute('aria-selected'),'true');
 // An academic user can view the same editor but cannot save Admin-only settings.
 tables.school_memberships=tables.school_memberships.filter(m=>m.role!=='school_admin');tables.school_memberships.push({id:'academic',school_id:school,user_id:actor,role:'academic',active:true,schools:tables.schools[0]});
 await page.reload();await page.waitForFunction(()=>document.querySelector('#curriculum-version-select')?.value==='v2');await page.getByRole('combobox',{name:'ระดับชั้น',exact:true}).selectOption('ม.1');await page.locator('.curriculum-table tbody tr').getByRole('button',{name:'แก้ไข',exact:true}).click();await page.getByRole('tab',{name:'โครงสร้างคะแนน',exact:true}).click();
 await panel.getByText('เฉพาะ Admin สามารถแก้ไขโครงสร้างคะแนน').waitFor();assert.equal(await save.count(),0);assert.equal(await coursework.isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS: embedded score settings, primary/secondary totals, exact subject/year RPC payloads, persistence and success feedback, load/save failures, Admin-only editing and mobile layout. All backend requests mocked.');await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
