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
assert(admin.includes('sar_set_year_targets'),'admin must set yearly targets through authorized RPC');
assert(admin.includes('sar_reopen_teacher_assessment'),'admin must be able to reopen teacher work');
assert(teacher.includes('sar_save_teacher_assessment'),'teacher page should save via authorized RPC');
assert(nav.includes("href:'/admin/sar'"));
assert(nav.includes("href:'/teacher/sar'"));
console.log('PASS: SAR 2–3 seed, access controls, year targets and assessment UI');
