const assert=require('node:assert/strict');
const fs=require('node:fs');
const schema=fs.readFileSync('supabase/migrations/202610300005_sar_operations.sql','utf8');
const academic=fs.readFileSync('supabase/migrations/202610300007_sar_academic_summary.sql','utf8');
const fix=fs.readFileSync('supabase/migrations/202610300006_sar_evidence_client_ids.sql','utf8');
const nav=fs.readFileSync('src/components/app-navigation.tsx','utf8');
for(const table of ['sar_staff_profiles','sar_evidence','sar_national_tests','sar_context','sar_indicator_measurements','sar_quality_reviews','sar_report_versions']){
 assert(schema.includes('create table public.'+table),'missing schema '+table);
 assert(schema.includes('alter table public.'+table+' enable row level security') || (schema.includes("foreach t in array array[") && schema.includes("'"+table+"'")), 'missing RLS '+table);
}
assert(schema.includes("values('wichakan-sar','wichakan-sar',false"),'SAR files must be private');
assert(schema.includes("split_part(name,'/',2)=(select auth.uid())::text"),'private file uploads scoped to owner');
assert(schema.includes("m.role='school_admin'"),'admin permissions required');
assert(schema.includes('v_existing.owner_user_id<>(select auth.uid())') && schema.includes('owner_user_id uuid not null'), 'evidence ownership required');
assert(schema.includes('review_all_topics_before_approval'),'approved reports must require reviews');
assert(schema.includes("version_no"),'report snapshots versioned');
assert(academic.includes("private.line_grade_rows"),'grade 3+ summary uses validated grade calculation');
assert(academic.includes("grade3plus"),'grade 3+ measurement required');
assert(fix.includes('select * into v_existing'),'evidence IDs must support preallocation');
for(const p of ['admin/sar/data','admin/sar/management','admin/sar/review','admin/sar/report','teacher/sar/evidence']){
 assert(fs.existsSync('src/app/'+p+'/page.tsx'),'missing SAR page '+p);
 assert(nav.includes("href:'/"+p+"'"),'missing SAR navigation '+p);
}
const evidence=fs.readFileSync('src/app/teacher/sar/evidence/page.tsx','utf8');
assert(evidence.includes("sar_save_evidence"),'teacher must write through authorized RPC');
assert(evidence.includes("createSignedUrl"),'private files require signed view URLs');
assert(evidence.includes("10*1024*1024"),'file max size client validation');
const report=fs.readFileSync('src/app/admin/sar/report/page.tsx','utf8');
assert(report.includes('sar_approve_report'),'report needs explicit approval');
assert(report.includes('application/msword'),'Word output available');
assert(report.includes('w.print()'),'browser print/PDF available');
const detail=fs.readFileSync('supabase/migrations/202610300009_sar_success_indicators.sql','utf8');
const detailRpc=fs.readFileSync('supabase/migrations/202610300011_sar_save_success_targets.sql','utf8');
const publicationGate=fs.readFileSync('supabase/migrations/202610300010_sar_publication_success_gate.sql','utf8');
const successUI=fs.readFileSync('src/app/admin/sar/success-targets/page.tsx','utf8');
const successList=detail.split('insert into public.sar_success_indicators(code,parent_code,description) values')[1].split('on conflict(code)')[0];
const successRows=[...successList.matchAll(/\('([123]\.\d+\.\d+(?:\.\d+)?)','/g)].map(m=>m[1]);
assert.equal(successRows.length,57,'SAR 2568 annex must contain all 57 detailed indicators');
assert.equal(new Set(successRows).size,57,'SAR success indicator IDs must be unique');
assert(publicationGate.includes('all_success_targets_required'));
assert(detailRpc.includes('published_targets_are_locked'));
assert(successUI.includes('sar_save_success_targets'));
assert(nav.includes("href:'/admin/sar/success-targets'"));
console.log('PASS: SAR operational modules, restricted storage, reporting and routes');
