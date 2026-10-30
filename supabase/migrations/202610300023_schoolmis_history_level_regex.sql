alter table public.schoolmis_grade_history drop constraint schoolmis_grade_history_level_code_check;
alter table public.schoolmis_grade_history add constraint schoolmis_grade_history_level_code_check check (level_code ~ '^[ปม][.][1-6]$');
alter table public.schoolmis_history_imports drop constraint schoolmis_history_imports_current_level_code_check;
alter table public.schoolmis_history_imports add constraint schoolmis_history_imports_current_level_code_check check (current_level_code ~ '^[ปม][.][1-6]$');