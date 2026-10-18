-- School curriculum adjustment: primary career education 40h/year,
-- and one computer period/week in secondary levels, per term.
do $$
declare v_school uuid; v_version uuid; v_year uuid; v_count int;
begin
 select school_id,curriculum_version_id into v_school,v_version
 from public.subjects where subject_code='ง14201' and grade_level='ป.4' and name_th='คอมพิวเตอร์';
 if v_version is null then raise exception 'Primary computer curriculum baseline missing'; end if;
 select id into v_year from public.academic_years where school_id=v_school and year_be=2569;
 if v_year is null then raise exception 'Academic year 2569 missing'; end if;
 update public.subjects set learning_hours=40,hour_basis='year'
 where school_id=v_school and curriculum_version_id=v_version
   and subject_code in ('ง14101','ง15101','ง16101')
   and name_th like 'การงานอาชีพ%';
 get diagnostics v_count=row_count;
 if v_count<>3 then raise exception 'Expected 3 primary career subjects, changed %',v_count; end if;

 insert into public.subjects(school_id,curriculum_version_id,subject_code,name_th,learning_hours,category,grade_level,hour_basis,semester_no)
 select v_school,v_version,x.code,'คอมพิวเตอร์',20,'additional',x.grade,'term',x.sem
 from (values
 ('ง21201','ม.1',1),('ง21202','ม.1',2),
 ('ง22201','ม.2',1),('ง22202','ม.2',2),
 ('ง23201','ม.3',1),('ง23202','ม.3',2)
 ) as x(code,grade,sem)
 on conflict(curriculum_version_id,subject_code) do nothing;
 if (select count(*) from public.subjects where curriculum_version_id=v_version and subject_code in ('ง21201','ง21202','ง22201','ง22202','ง23201','ง23202') and name_th='คอมพิวเตอร์' and category='additional' and learning_hours=20 and hour_basis='term')<>6
 then raise exception 'Secondary computer code conflict or invalid attributes';end if;
 insert into public.course_offerings(school_id,term_id,subject_id,classroom_id)
 select v_school,t.id,s.id,c.id
 from public.terms t join public.classrooms c on c.school_id=v_school and c.academic_year_id=v_year
 join public.subjects s on s.school_id=v_school and s.curriculum_version_id=v_version
   and s.grade_level=c.level_code and s.semester_no=t.term_no
 where t.school_id=v_school and t.academic_year_id=v_year
   and s.subject_code in ('ง21201','ง21202','ง22201','ง22202','ง23201','ง23202')
 on conflict(term_id,subject_id,classroom_id) do nothing;
end $$;