const assert=require('node:assert/strict');
const fs=require('node:fs');
const sql=fs.readFileSync('supabase/migrations/202610300001_sar_standard_2_3_foundation.sql','utf8');
const admin=fs.readFileSync('src/app/admin/sar/page.tsx','utf8');
const teacher=fs.readFileSync('src/app/teacher/sar/page.tsx','utf8');
const nav=fs.readFileSync('src/components/app-navigation.tsx','utf8');
const items=[...sql.matchAll(/\('([23]\.\d+(?:\.\d+)?)',[23],/g)].map(match=>match[1]);
assert.equal(items.length,15,'SAR must seed six standard 2 and nine standard 3 questions');
assert.equal(items.filter(x=>x.startsWith('2.')).length,6);
assert.equal(items.filter(x=>x.startsWith('3.')).length,9);
assert.equal(new Set(items).size,15,'assessment codes must be unique');
for(const tbl of ['sar_assessment_items','sar_year_settings','sar_teacher_assessments','sar_teacher_submissions']){
 assert(sql.includes('alter table public.'+tbl+' enable row level security'),'RLS required: '+tbl);
}
assert(sql.includes("m.role='school_admin'"),'admin role validation required');
assert(sql.includes("m.role='teacher'"),'teacher role validation required');
assert(sql.includes("auth.uid()"),'authentication required');
assert(sql.includes('all_sar_items_required'),'partial draft must not be submitted as complete');
assert(sql.includes('published_targets_are_locked'),'published targets should be locked');
assert(admin.includes('sar_save_indicator_targets'),'admin must set yearly consideration targets through authorized RPC');
assert(admin.includes('sar_reopen_teacher_assessment'),'admin must be able to reopen teacher work');
assert(teacher.includes('sar_save_teacher_assessment'),'teacher page should save via authorized RPC');
assert(nav.includes("href:'/admin/sar'"));
assert(nav.includes("href:'/teacher/sar'"));
const snapshot=fs.readFileSync('supabase/migrations/202610300002_sar_admin_auto_snapshot.sql','utf8');
const adminCurrent=fs.readFileSync('src/app/admin/sar/page.tsx','utf8');
assert(snapshot.includes("m.role='school_admin'"),'SAR snapshot must require school admin');
assert(snapshot.includes('count(distinct(w.weekday_no,w.period_no))'),'weekly teacher periods must not double-count identical slots');
assert(snapshot.includes("'เด็กชาย','นาย'"),'male prefixes must include เด็กชาย and นาย');
assert(snapshot.includes("'เด็กหญิง','นางสาว'"),'female prefixes must include เด็กหญิง and นางสาว');
assert(snapshot.includes("'unknown'"),'unrecognized prefixes must remain reviewable');
assert(adminCurrent.includes("sar_admin_auto_snapshot"),'Admin SAR dashboard should load calculated school data');
const perIndicatorSql=fs.readFileSync('supabase/migrations/202610300003_sar_indicator_targets.sql','utf8');
const adminPerIndicator=fs.readFileSync('src/app/admin/sar/page.tsx','utf8');
const teacherPerIndicator=fs.readFileSync('src/app/teacher/sar/page.tsx','utf8');
assert(perIndicatorSql.includes('target_percent numeric(5,2)'),'SAR target must support percent with two decimal places');
assert(perIndicatorSql.includes('section_code text not null'),'annual SAR target needs one row per consideration');
assert(perIndicatorSql.includes('all_indicator_targets_required'),'cannot publish incomplete target set');
assert(perIndicatorSql.includes("v_old_status='published'"),'published annual targets must remain locked');
assert(perIndicatorSql.includes("revoke execute on function public.sar_set_year_targets"),'legacy standard-wide target API must be revoked');
assert(perIndicatorSql.includes('alter table public.sar_indicator_targets enable row level security'));
assert(adminPerIndicator.includes("sar_save_indicator_targets"),'admin must save each topic target');
assert(adminPerIndicator.includes('sections.length===27'),'admin must check all 27 three-standard targets');
assert(adminPerIndicator.includes('target_percent:Number(raw)'),'numeric percentages saved per topic');
assert(teacherPerIndicator.includes('sar_indicator_targets'),'teacher must read the same published indicator targets');
assert(!teacherPerIndicator.includes('target_standard_2'),'teacher must not use obsolete global target');
const completeSql=fs.readFileSync('supabase/migrations/202610300004_sar_full_target_table_2568.sql','utf8');
const catalog=completeSql.slice(completeSql.indexOf('insert into public.sar_target_topics(code'),completeSql.indexOf('on conflict(code)'));
const targetSeed=completeSql.slice(completeSql.indexOf('insert into public.sar_indicator_targets('),completeSql.indexOf('on conflict(school_id,academic_year_id,section_code)'));
const expected=['1','1.1','1.1.1','1.1.2','1.1.3','1.1.4','1.1.5','1.1.6','1.2','1.2.1','1.2.2','1.2.3','1.2.4','2','2.1','2.2','2.3','2.4','2.5','2.6','3','3.1','3.2','3.3','3.4','3.5','overall'];
for(const code of expected){
 assert(catalog.includes("('"+code+"',"),'missing consideration catalog: '+code);
 assert(targetSeed.includes("('"+code+"',"),'missing Word 2568 percentage: '+code);
}
assert.equal(expected.length,27);
const known={'1':80,'1.1':70,'1.1.1':64,'1.1.2':73,'1.1.3':55,'1.1.4':80,'1.1.5':69,'1.1.6':80,'1.2':90,'2':88,'2.4':85,'3':91,'3.1':95,'overall':86};
for(const [code,percent] of Object.entries(known)){
 assert(targetSeed.includes("('"+code+"',"+percent+")"),'incorrect source Word target for '+code);
}
assert(completeSql.includes('not exists(select 1 from public.academic_years'),'archive 2568 must be idempotent');
assert(completeSql.includes('2568 (รอตรวจสอบรายวิชา)'),'archival curriculum version must not pretend copied 2569 subjects');
assert(completeSql.includes("and y.year_be=2568"),'seed must only populate 2568');
assert(completeSql.includes("'draft'"),'archive must not auto-publish targets');
assert(completeSql.includes('select count(*) into v_expected from public.sar_target_topics'),'publication needs all catalog targets');
assert(completeSql.includes('v_target_count<>(select count(*) from public.sar_target_topics)'),'teacher assessment needs all targets');
assert(adminPerIndicator.includes("sar_target_topics"),'admin must load full three-standard catalog');
assert(adminPerIndicator.includes('topics.filter(t=>t.standard_no===no)'),'admin must display hierarchical tables');
assert(teacherPerIndicator.includes('yearTargets.length===27'),'teacher gate must recognize all 27 targets');
console.log('PASS: SAR 2–3 seed, access controls, year targets and assessment UI');
