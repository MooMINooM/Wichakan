-- 57 detailed success indicator targets transcribed from the 2568 SAR Word annex, pp.152–158.
-- These supplement (not replace) the 27 main-target rows of the SAR announcement.
create table public.sar_success_indicators(
 code text primary key,
 parent_code text not null references public.sar_target_topics(code),
 description text not null,
 source_year_be integer not null default 2568
);
alter table public.sar_success_indicators enable row level security;
grant select on public.sar_success_indicators to authenticated;
create policy sar_success_catalog_read on public.sar_success_indicators for select to authenticated
using((select auth.uid()) is not null);
create table public.sar_success_targets(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 indicator_code text not null references public.sar_success_indicators(code),
 target_percent numeric(5,2) not null check(target_percent between 0 and 100),
 updated_at timestamptz not null default now(),
 primary key(school_id,academic_year_id,indicator_code)
);
alter table public.sar_success_targets enable row level security;
grant select,insert,update,delete on public.sar_success_targets to authenticated;
create policy sar_success_read on public.sar_success_targets for select to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_success_targets.school_id and m.user_id=(select auth.uid()) and m.active
 and (m.role='school_admin' or (m.role='teacher' and exists(select 1 from public.sar_year_settings s where s.school_id=sar_success_targets.school_id and s.academic_year_id=sar_success_targets.academic_year_id and s.status='published')))));
create policy sar_success_insert on public.sar_success_targets for insert to authenticated
with check(exists(select 1 from public.school_memberships m where m.school_id=sar_success_targets.school_id and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 and not exists(select 1 from public.sar_year_settings s where s.school_id=sar_success_targets.school_id and s.academic_year_id=sar_success_targets.academic_year_id and s.status='published'));
create policy sar_success_update on public.sar_success_targets for update to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_success_targets.school_id and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 and not exists(select 1 from public.sar_year_settings s where s.school_id=sar_success_targets.school_id and s.academic_year_id=sar_success_targets.academic_year_id and s.status='published'))
with check(exists(select 1 from public.school_memberships m where m.school_id=sar_success_targets.school_id and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 and not exists(select 1 from public.sar_year_settings s where s.school_id=sar_success_targets.school_id and s.academic_year_id=sar_success_targets.academic_year_id and s.status='published'));
create policy sar_success_delete on public.sar_success_targets for delete to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_success_targets.school_id and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 and not exists(select 1 from public.sar_year_settings s where s.school_id=sar_success_targets.school_id and s.academic_year_id=sar_success_targets.academic_year_id and s.status='published'));

insert into public.sar_success_indicators(code,parent_code,description) values
('1.1.1.1','1.1.1','อ่านและเขียนภาษาไทยได้ในระดับดีตามเกณฑ์สถานศึกษา'),
('1.1.1.2','1.1.1','ผ่านการประเมินสมรรถนะสำคัญด้านการสื่อสารในระดับดี'),
('1.1.1.3','1.1.1','สื่อสารและนำเสนอผลงานได้ตามเกณฑ์สถานศึกษา'),
('1.1.1.4','1.1.1','สื่อสารภาษาอังกฤษได้ตามเกณฑ์สถานศึกษา'),
('1.1.1.5','1.1.1','คิดคำนวณได้ในระดับดีตามเกณฑ์สถานศึกษา'),
('1.1.2.1','1.1.2','ผ่านการประเมินการอ่านคิดวิเคราะห์ระดับดี'),
('1.1.2.2','1.1.2','ผ่านการประเมินทักษะการคิดแก้ปัญหาระดับดี'),
('1.1.2.3','1.1.2','ผ่านการประเมินสมรรถนะสำคัญด้านการคิดระดับดี'),
('1.1.3.1','1.1.3','มีความรู้และทักษะพื้นฐานในการสร้างนวัตกรรมระดับดี'),
('1.1.3.2','1.1.3','มีผลงานโครงงานหรือสิ่งประดิษฐ์และอธิบายแนวคิด ขั้นตอน และปัญหาอุปสรรคได้'),
('1.1.3.3','1.1.3','สามารถสร้างนวัตกรรม'),
('1.1.3.4','1.1.3','สามารถสร้างนวัตกรรม นำไปใช้ และเผยแพร่ได้'),
('1.1.4.1','1.1.4','สืบค้นและสรุปความรู้จากอินเทอร์เน็ตได้ด้วยตนเองและอ้างอิงแหล่งข้อมูล'),
('1.1.4.2','1.1.4','ผ่านการประเมินสมรรถนะสำคัญด้านการใช้เทคโนโลยีระดับดี'),
('1.1.4.3','1.1.4','มีทักษะ Digital Literacy เพื่อการเรียนรู้อย่างมีประสิทธิภาพ'),
('1.1.5.1','1.1.5','ผลการเรียนภาษาไทยระดับ 3 ขึ้นไป'),
('1.1.5.2','1.1.5','ผลการเรียนคณิตศาสตร์ระดับ 3 ขึ้นไป'),
('1.1.5.3','1.1.5','ผลการเรียนวิทยาศาสตร์และเทคโนโลยีระดับ 3 ขึ้นไป'),
('1.1.5.4','1.1.5','ผลการเรียนสังคมศึกษาระดับ 3 ขึ้นไป'),
('1.1.5.5','1.1.5','ผลการเรียนศิลปะระดับ 3 ขึ้นไป'),
('1.1.5.6','1.1.5','ผลการเรียนสุขศึกษาและพลศึกษาระดับ 3 ขึ้นไป'),
('1.1.5.7','1.1.5','ผลการเรียนการงานอาชีพระดับ 3 ขึ้นไป'),
('1.1.5.8','1.1.5','ผลการเรียนภาษาต่างประเทศ (ภาษาอังกฤษ) ระดับ 3 ขึ้นไป'),
('1.1.6.1','1.1.6','มีความรู้ เจตคติ และทักษะพื้นฐานต่องานอาชีพตามระดับชั้น'),
('1.1.6.2','1.1.6','นักเรียน ป.6 มีความรู้ เจตคติ และทักษะประกอบอาชีพอย่างน้อยหนึ่งอาชีพ'),
('1.1.6.3','1.1.6','นักเรียน ป.6 มีความพร้อมในการศึกษาต่อและประกอบอาชีพ'),
('1.2.1.1','1.2.1','ผ่านการประเมินคุณลักษณะอันพึงประสงค์ระดับดี'),
('1.2.1.2','1.2.1','มีความรับผิดชอบ มีวินัย มีภาวะผู้นำและจิตอาสา'),
('1.2.1.3','1.2.1','มีคุณลักษณะและค่านิยมที่ดีและเป็นแบบอย่างได้'),
('1.2.2.1','1.2.2','ร่วมกิจกรรมตามประเพณี วันสำคัญและท้องถิ่น'),
('1.2.2.2','1.2.2','แสดงความรักในสถาบันหลักของชาติ'),
('1.2.2.3','1.2.2','ยึดมั่นการปกครองระบอบประชาธิปไตยอันมีพระมหากษัตริย์เป็นประมุข'),
('1.2.2.4','1.2.2','แสดงความรักและภูมิใจในความเป็นไทย'),
('1.2.2.5','1.2.2','แสดงความรักและภูมิใจในประเพณีวัฒนธรรมและท้องถิ่น'),
('1.2.3.1','1.2.3','อยู่ร่วมกันอย่างมีความสุขบนความแตกต่างทางวัฒนธรรมและความคิดเห็น'),
('1.2.3.2','1.2.3','มีทัศนคติที่ดีต่อบ้านเมือง เป็นพลเมืองดี มีคุณธรรมและจริยธรรม'),
('1.2.4.1','1.2.4','มีน้ำหนัก ส่วนสูงและพัฒนาการทางร่างกายตามเกณฑ์กรมอนามัย'),
('1.2.4.2','1.2.4','มีสมรรถภาพทางกายตามเกณฑ์มาตรฐานกรมพลศึกษาหรือ สสส.'),
('1.2.4.3','1.2.4','มีสุขภาพแข็งแรง สะอาดเรียบร้อย ปฏิบัติตามสุขบัญญัติ 10 ประการ'),
('1.2.4.4','1.2.4','หลีกเลี่ยงสิ่งมอมเมา ปัญหาทางเพศ การทะเลาะวิวาท และอบายมุข'),
('1.2.4.5','1.2.4','มีความรู้และทักษะป้องกันตนเองจากภัยคุกคามรูปแบบใหม่'),
('1.2.4.6','1.2.4','ดำเนินชีวิตเป็นมิตรกับสิ่งแวดล้อมและมีจิตสาธารณะ'),
('2.1.1','2.1','เป้าหมาย วิสัยทัศน์และพันธกิจชัดเจน สอดคล้องบริบท ปฏิบัติได้จริง ในระดับดี'),
('2.2.1','2.2','ระบบบริหารจัดการคุณภาพส่งผลต่อการพัฒนาตามมาตรฐานและเป้าหมาย ในระดับดี'),
('2.3.1','2.3','พัฒนาวิชาการเน้นคุณภาพผู้เรียนรอบด้านตามหลักสูตรและทุกกลุ่มเป้าหมาย ในระดับดี'),
('2.4.1','2.4','พัฒนาครูและบุคลากรให้มีความเชี่ยวชาญทางวิชาชีพ ในระดับดี'),
('2.5.1','2.5','สภาพแวดล้อมทางกายภาพและสังคมเอื้อต่อการเรียนรู้อย่างมีคุณภาพ ในระดับดี'),
('2.6.1','2.6','เทคโนโลยีสารสนเทศสนับสนุนการบริหารจัดการและการเรียนรู้ ในระดับดี'),
('3.1.1','3.1','ครูทุกกลุ่มสาระจัดการเรียนรู้เน้นคิดและปฏิบัติจริงตามมาตรฐาน ตัวชี้วัด และประยุกต์ใช้ชีวิตได้'),
('3.1.2','3.1','ครูมีนวัตกรรมจัดการเรียนรู้แบบ Active Learning'),
('3.2.1','3.2','ครูทุกกลุ่มสาระใช้สื่อการเรียนรู้หลากหลาย'),
('3.2.2','3.2','ครูทุกกลุ่มสาระใช้เทคโนโลยีสารสนเทศหรือ Application ในการจัดการเรียนรู้'),
('3.2.3','3.2','ครูใช้แหล่งเรียนรู้ทั้งในและนอกโรงเรียนและภูมิปัญญาท้องถิ่น บูรณาการให้ฝึกปฏิบัติจริง'),
('3.3.1','3.3','ครูจัดการชั้นเรียนเชิงบวก มีปฏิสัมพันธ์เชิงบวกให้นักเรียนรักการเรียนรู้'),
('3.4.1','3.4','ครูประเมินผู้เรียนอย่างเป็นระบบ ให้ข้อมูลย้อนกลับ และนำผลไปพัฒนา'),
('3.4.2','3.4','ครูมีเครื่องมือวัดและวิธีประเมินผลที่เหมาะสมกับเป้าหมายการเรียนรู้'),
('3.5.1','3.5','ครูและผู้เกี่ยวข้องแลกเปลี่ยนเรียนรู้และข้อมูลสะท้อนกลับเพื่อปรับปรุงการสอน')
on conflict(code) do update set parent_code=excluded.parent_code,description=excluded.description;
insert into public.sar_success_targets(school_id,academic_year_id,indicator_code,target_percent)
select y.school_id,y.id,v.code,v.percent from public.academic_years y
cross join (values
('1.1.1.1',60),
('1.1.1.2',80),
('1.1.1.3',55),
('1.1.1.4',55),
('1.1.1.5',70),
('1.1.2.1',70),
('1.1.2.2',70),
('1.1.2.3',80),
('1.1.3.1',55),
('1.1.3.2',55),
('1.1.3.3',55),
('1.1.3.4',55),
('1.1.4.1',80),
('1.1.4.2',80),
('1.1.4.3',80),
('1.1.5.1',70),
('1.1.5.2',55),
('1.1.5.3',60),
('1.1.5.4',70),
('1.1.5.5',80),
('1.1.5.6',80),
('1.1.5.7',80),
('1.1.5.8',50),
('1.1.6.1',80),
('1.1.6.2',80),
('1.1.6.3',80),
('1.2.1.1',90),
('1.2.1.2',90),
('1.2.1.3',90),
('1.2.2.1',90),
('1.2.2.2',90),
('1.2.2.3',90),
('1.2.2.4',90),
('1.2.2.5',90),
('1.2.3.1',90),
('1.2.3.2',90),
('1.2.4.1',90),
('1.2.4.2',90),
('1.2.4.3',90),
('1.2.4.4',90),
('1.2.4.5',90),
('1.2.4.6',90),
('2.1.1',90),
('2.2.1',90),
('2.3.1',90),
('2.4.1',85),
('2.5.1',90),
('2.6.1',85),
('3.1.1',95),
('3.1.2',95),
('3.2.1',90),
('3.2.2',90),
('3.2.3',90),
('3.3.1',90),
('3.4.1',90),
('3.4.2',90),
('3.5.1',90)
) v(code,percent)
where y.school_id='39b470d8-52e8-43d7-9774-4e5d8cf7875f' and y.year_be=2568
on conflict(school_id,academic_year_id,indicator_code) do nothing;
