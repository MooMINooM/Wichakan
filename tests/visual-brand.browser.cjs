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
 // Populate two curricula with distinct versions to catch stale cross-curriculum selections.
 tables.curricula=[{id:'c1',school_id:school,name_th:'หลักสูตรสถานศึกษา 2569'},{id:'c2',school_id:school,name_th:'หลักสูตรทดลอง'},{id:'c3',school_id:school,name_th:'หลักสูตรรอจัดทำ'}];
 tables.curriculum_versions=[{id:'v1',school_id:school,curriculum_id:'c1',version_label:'ฉบับเดิม',effective_year_be:2568},{id:'v2',school_id:school,curriculum_id:'c1',version_label:'ฉบับปรับปรุง',effective_year_be:2569},{id:'v3',school_id:school,curriculum_id:'c2',version_label:'ฉบับทดลอง',effective_year_be:2569}];
 for(const s of tables.subjects)Object.assign(s,{curriculum_version_id:'v2',learning_hours:40,hour_basis:'year',category:'basic'});
 tables.subjects.push({...tables.subjects[0],id:'old-thai',curriculum_version_id:'v1',name_th:'ภาษาไทยฉบับเดิม'},{...tables.subjects[0],id:'trial-math',curriculum_version_id:'v3',name_th:'คณิตศาสตร์ทดลอง'});
 for(const s of students)s.status='active';
 let failStudent='',loadFail=false;const writes=[],scoreOffsets=[];
 await context.route('https://ux-test.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').pop();if(u.pathname==='/auth/v1/user')return route.fulfill({json:user});
  assert.equal(req.method(),'GET','visual checks must never write data');
  if(loadFail&&table==='student_course_scores')return route.fulfill({status:503,json:{message:'อ่านคะแนนไม่สำเร็จ'}});
  let data=tables[table]??[];
  for(const [key,value] of u.searchParams){if(['select','order','offset','limit'].includes(key))continue;if(value.startsWith('eq.'))data=data.filter(r=>String(r[key])===value.slice(3));else if(value.startsWith('in.(')){const ids=value.slice(4,-1).split(',');data=data.filter(r=>ids.includes(String(r[key])));}}
  if(u.searchParams.has('offset')){const offset=Number(u.searchParams.get('offset'));if(table==='student_course_scores')scoreOffsets.push(offset);data=data.slice(offset,offset+Number(u.searchParams.get('limit')));}return route.fulfill({json:data});
 });
 const page=await context.newPage(),errors=[];globalThis.testPage=page;page.on('pageerror',e=>errors.push(e.message));
 // Curriculum and version selectors, subject list and editor share one screen.
 await page.goto('http://127.0.0.1:3000/Wichakan/curriculum/');
 await page.waitForFunction(()=>document.querySelector('#curriculum-version-select')?.value==='v2');
 await page.getByRole('combobox',{name:'ระดับชั้น',exact:true}).selectOption('ป.6');
 assert.equal(await page.getByRole('navigation',{name:'ขั้นตอนหลักสูตร'}).count(),0);
 assert.equal(await page.locator('.curriculum-table tbody tr').count(),5);
 await page.getByLabel('ฉบับหลักสูตร',{exact:true}).selectOption('v1');
 await page.getByRole('cell',{name:'ภาษาไทยฉบับเดิม',exact:true}).waitFor();
 assert.equal(await page.locator('.curriculum-table tbody tr').count(),1);
 await page.getByRole('button',{name:'แก้ไข',exact:true}).click();
 assert.equal(await page.getByLabel('ชื่อรายวิชา',{exact:true}).inputValue(),'ภาษาไทยฉบับเดิม');
 await page.getByRole('button',{name:'ปิดแบบฟอร์ม'}).click();
 await page.getByLabel('หลักสูตร',{exact:true}).selectOption('c2');
 await page.getByRole('cell',{name:'คณิตศาสตร์ทดลอง',exact:true}).waitFor();
 assert.equal(await page.getByLabel('ฉบับหลักสูตร',{exact:true}).inputValue(),'v3');
 await page.getByRole('button',{name:'+ เพิ่มรายวิชา',exact:true}).click();
 await page.getByRole('heading',{name:'เพิ่มรายวิชา',exact:true}).waitFor();
 await page.getByRole('button',{name:'ปิดแบบฟอร์ม'}).click();
 await page.getByLabel('หลักสูตร',{exact:true}).selectOption('c3');
 await page.getByRole('heading',{name:'ยังไม่มีฉบับหลักสูตร',exact:true}).waitFor();
 assert.equal(await page.getByLabel('ฉบับหลักสูตร',{exact:true}).isDisabled(),true);
 await page.getByLabel('หลักสูตร',{exact:true}).selectOption('c1');
 await page.waitForFunction(()=>document.querySelector('#curriculum-version-select')?.value==='v2');
 await page.evaluate(async()=>{await document.fonts.ready});
 await page.screenshot({path:'/tmp/balance-curriculum-desktop.png',fullPage:true});
 await page.setViewportSize({width:360,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/tmp/balance-curriculum-mobile.png',fullPage:true});
 // Row actions remain aligned and still open the appropriate existing editor/dialog.
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:3000/Wichakan/students/');
 await page.locator('.student-row-actions').first().waitFor();
 const actions=page.locator('.student-row-actions').first();
 const dimensions=await actions.locator('button').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,top:n.getBoundingClientRect().top})));
 assert.equal(dimensions.length,3);assert(dimensions.every(n=>n.height===dimensions[0].height&&n.top===dimensions[0].top));
 await actions.getByRole('button',{name:'สถานภาพ',exact:true}).click();
 await page.getByRole('dialog',{name:'เปลี่ยนสถานภาพนักเรียน'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'บันทึกสถานภาพ'}).isDisabled(),true);
 await page.getByRole('dialog',{name:'เปลี่ยนสถานภาพนักเรียน'}).getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.evaluate(async()=>{await document.fonts.ready});
 await page.screenshot({path:'/tmp/balance-students-desktop.png',fullPage:true});
 await page.setViewportSize({width:360,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await actions.locator('button').first().evaluate(n=>n.getBoundingClientRect().height>=44),true);
 await page.screenshot({path:'/tmp/balance-students-mobile.png',fullPage:true});
 // Keep the header/sidebar seam intact at every scroll position and breakpoint.
 for(const width of [1440,1024,768,360]){
  await page.setViewportSize({width,height:600});
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  const initial=await page.locator('.app-topbar').boundingBox();
  assert.equal(initial.y,0,'header starts at viewport top');
  assert((await page.locator('.ui-header').boundingBox()).y>=initial.height,'page title clears header');
  for(const top of [120,480,10000]){
   await page.evaluate(top=>window.scrollTo({top,behavior:'instant'}),top);
   assert(await page.evaluate(()=>window.scrollY>0),'fixture must scroll');
   const header=await page.locator('.app-topbar').boundingBox();
   assert.equal(header.y,0,'header stays visible at '+width+' / '+top);
   assert.equal(header.height,width<=600?64:72);
   const logo=await page.locator('.app-topbar .brand-mark').boundingBox();
   assert(logo.y>=0&&logo.y+logo.height<=header.height,'logo stays inside header');
   if(width>=1024){const sidebar=await page.locator('.app-sidebar').boundingBox();assert.equal(sidebar.y,header.height,'sidebar joins header');}
  }
  if(width===1440)await page.screenshot({path:'/tmp/scroll-desktop.png'});
  if(width===360){
   await page.getByRole('button',{name:'เปิดหรือปิดเมนู'}).click();
   const sidebar=await page.locator('.app-sidebar').boundingBox();
   assert.equal(sidebar.y,64,'mobile drawer joins header while scrolled');
   assert.equal(await page.getByRole('button',{name:'เปิดหรือปิดเมนู'}).getAttribute('aria-expanded'),'true');
   await page.screenshot({path:'/tmp/scroll-mobile-menu.png'});
   await page.getByRole('button',{name:'เปิดหรือปิดเมนู'}).click();
  }
 }
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 const routes=[['admin','จัดการสถานศึกษา'],['academic','ตั้งค่างานวิชาการ'],['academic/teachers','มอบหมายครูผู้สอนรายวิชา'],['personnel','จัดการบุคลากร'],['curriculum','หลักสูตรและรายวิชา'],['students','ทะเบียนนักเรียน'],['students/history','ประวัติการศึกษา'],['students/import','นำเข้านักเรียนจาก DMC'],['students/promote','เลื่อนชั้นนักเรียน'],['academic/score-settings','ตั้งค่าโครงสร้างคะแนน'],['teacher','แดชบอร์ดครู'],['teacher/scores/?offering=math','บันทึกคะแนนรายวิชา'],['teacher/pp6','ห้องประจำชั้น'],['director','ภาพรวมผู้บริหาร'],['workspace','เลือกพื้นที่ทำงาน']];
 for(const [route,title] of routes){await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:3000/Wichakan/'+route);await page.getByRole('heading',{name:title,exact:true}).first().waitFor();await page.evaluate(async()=>{await document.fonts.ready});await page.waitForTimeout(100);
 const styles=await page.locator('.ui-header h1').evaluate(el=>({size:getComputedStyle(el).fontSize,color:getComputedStyle(el).color,body:getComputedStyle(document.body).backgroundColor,font:getComputedStyle(el).fontFamily,primary:getComputedStyle(document.documentElement).getPropertyValue('--ui-primary').trim()}));assert.equal(styles.size,'24px',route);assert.match(styles.font,/Wichakan Thai/,route);assert.equal(await page.evaluate(()=>document.fonts.check('600 24px "Wichakan Thai"')),true,route);assert.equal(styles.body,'rgb(248, 250, 252)',route);assert.equal(styles.primary,'#2563eb',route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'desktop overflow '+route);
 if(['teacher','academic','admin','personnel'].includes(route))await page.screenshot({path:'/tmp/brand-'+route+'.png',fullPage:true});
 await page.setViewportSize({width:360,height:900});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow '+route);if(['teacher','academic/teachers','teacher/scores/?offering=math'].includes(route))await page.screenshot({path:'/tmp/brand-mobile-'+route.split('/')[0]+(route.includes('scores')?'-scores':route.includes('teachers')?'-assignments':'')+'.png',fullPage:true});
 }
 await page.goto('http://127.0.0.1:3000/Wichakan/teacher/');await page.getByRole('button',{name:'เปิดหรือปิดเมนู'}).click();await page.getByRole('link',{name:'ห้องประจำชั้น',exact:true}).click();await page.getByRole('heading',{name:'ห้องประจำชั้น',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('a[href="/Wichakan/teacher/pp6/"]')?.getAttribute('aria-current')==='page'||Array.from(document.querySelectorAll('a')).some(a=>a.textContent==='ห้องประจำชั้น'&&a.getAttribute('aria-current')==='page'));assert.equal(await page.getByRole('link',{name:'ห้องประจำชั้น',exact:true}).getAttribute('aria-current'),'page');
 await page.goto('http://127.0.0.1:3000/Wichakan/login/');await page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/brand-login-mobile.png',fullPage:true});assert.equal(await page.locator('.brand-mark').count(),1);assert.deepEqual(errors,[]);assert.equal(writes.length,0);console.log('PASS: pinned header/sidebar seam and mobile drawer at four breakpoints while scrolled; unified curriculum/version selection and empty states, subject editor, aligned student status actions; 15 workspace routes, uniform 24px titles/palette, desktop/mobile overflow, shared Sarabun font, SVG navigation/mobile drawer, homeroom link/active state and login. Mocked reads only.');await browser.close();server.close();
})().catch(async e=>{console.error(e);if(globalThis.testPage){console.log((await globalThis.testPage.locator('body').innerText()).slice(0,1000));await globalThis.testPage.screenshot({path:'/tmp/brand-failure.png',fullPage:true});}process.exit(1)});
