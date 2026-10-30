// LINE parent GPA/GPAX integration contract. No live student data needed for CI.
// Live database role/publication/identity scenarios are additionally checked by SQL.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('supabase/migrations/202610300040_line_parent_gpa_gpax.sql');
const portal=read('src/app/line/parent/portal.tsx');
const admin=read('src/app/admin/line-results/page.tsx');

assert.match(sql,/v_progress:=public\.schoolmis_student_semester_summary\(v_school,p_student_id\)/,
 'Reuse same GPA engine as WICHAKAN reports');
const parentGuard=sql.indexOf('if v_school is null then');
const computed=sql.indexOf('v_progress:=public.schoolmis_student_semester_summary');
assert(parentGuard>0&&computed>parentGuard,'GPA only after LINE guardian + publication authorization');
assert.match(sql,/pub\.published_at is not null/,'Require admin release');
assert.match(sql,/sg\.student_id=p_student_id/,'Require bound child');
assert.match(sql,/auth\.role\(\)<>'service_role'/,'LINE RPC requires service role');
assert.match(sql,/grant execute on function public\.line_parent_portal_data\(text,uuid,uuid,integer\) to service_role/);
assert.match(sql,/if \(v_period_type='year' and p_term=2\) or v_period_type='semester'/,
 'Annual primary GPA must be hidden in term 1');
assert.match(sql,/gpax_to_date' is not null/,'Only completed cumulative progress');
assert(sql.includes("where (t.value->>'year_be')::integer=v_school_year"),'Selected GPA must be restricted to requested year');
assert(sql.includes("and (t.value->>'term_no')::integer<=p_term"),'Running GPAX must not include future semesters');
assert.match(sql,/'gpa_summary',v_summary/,'Expose cumulative summary only from allowed response');
assert.match(portal,/gpa_summary\?:GpaSummary/);
assert.match(portal,/grades:\[\],gpa_summary:undefined,published:undefined/,
 'Changing children/terms clears previous child GPA');
assert.match(portal,/data\?\.published&&/);
assert.match(portal,/data\.gpa_summary&&/,'GPA only shown after published check');
assert.match(portal,/data\.gpa_summary\.period_type==='year'/);
assert.match(admin,/LINE OA จะแสดง GPA รายปี/);
console.log('LINE GPA/GPAX publication and guardian UI contracts passed');
