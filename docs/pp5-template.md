# PP5 form reference

Reference: user-supplied `report5_V29.xls(2).xlsx`, print sheets `1.พิมพ์หน้าปก`, `2.พิมพ์เวลาเรียน`, `3.พิมพ์คะแนน`, `5.พิมพ์ ตชว`.

The printed form retains the source's emblem/title, inline course metadata, grade/count/percentage table, side-by-side assessment summaries, approval/signature boxes, four-level attendance headers and ruled 30-row rosters with larger data text. Secondary results use portrait A4 with the selected term only. Primary results use landscape A4 with two term groups side by side and annual total/grade; each student occupies one row. Both retain eight traits and five reading criteria, explicitly labelled for the selected assessment term. Indicators retain the metadata and numbered writing area. Sarabun is embedded in the PDF.

User-directed adaptations take precedence over the original template: attendance has 25 Monday–Friday date columns in each five-week block, with multiple actual timetable periods in the same day cell. Nonteaching days are shaded. Dates beyond the first 20 weeks and rosters beyond 30 students continue rather than being cropped. Page numbers apply to the full book.

Scores/caps come directly from the same record used by the teacher score-entry form. Primary entry stores six score values in that record; the report prints each term’s coursework/midterm/final/term total, then annual total and grade. Secondary prints only the selected term’s coursework/midterm/final/total/grade. The user explicitly requested removing indicator-level score columns, pre/post-midterm breakdowns, retake placeholders and derived in-term totals. Indicators are report content on the separate indicator page, not score-entry requirements or grading inputs. Annual primary grades remain pending until both terms are complete.

The original workbook's fixed staff names are not copied into live reports. Teacher/homeroom names come from system data. School Admin sets assessment head, academic head and principal names in `/admin/pp5-signatories` for each academic year (`pp5_signatories` table). The teacher's PP5 cover reads the selected year and prints those names beside signature lines; unconfigured names remain dotted handwriting lines. Saving one year's names does not affect another year. Only school_admin may write; authorized school teachers may read. The source OBEC emblem is copied without editing. No school or student records are changed by the layout.

The cover's semester, female student count, subject and total-hours labels share one right-hand column, and their values share a second aligned column.


## เวลาเรียนวิชาบูรณาการ

- ใช้คู่รายวิชาจาก `timetable_course_integrations` ในห้องและภาคเรียนเดียวกัน
- ระบบเลือกคาบวิชาหลักเรียงวันจันทร์–ศุกร์และเลขคาบ ใช้ชุดเดิมทุกสัปดาห์ตามตารางปัจจุบัน
- จำนวนคาบ/สัปดาห์ = ชั่วโมงในหลักสูตร ÷ 40 (รายปี) หรือ ÷ 20 (รายภาค) เช่น 20 ชั่วโมง/ภาค → 1 คาบ; 60 → 3 คาบ
- ต้องได้จำนวนเต็มและวิชาหลักต้องมีคาบเพียงพอ มิฉะนั้นแจ้งผู้ดูแลให้ตรวจข้อมูล ไม่เดาชั่วโมงหรือเพิ่มคาบเอง
- `course_attendance_slots` และ `effective_course_attendance` ใช้ RLS ของผู้เรียก หน้าเช็คเวลาและ ปพ.5 อ่านแหล่งเดียวกัน
- วิชาบูรณาการอ่านสถานะจริงจากวิชาหลักเฉพาะคาบที่เลือก คาบที่ยังไม่บันทึกเป็นช่องว่าง ไม่มีการสร้างสถานะมาเรียนแทน
- แก้สถานะที่วิชาหลักแล้วข้อมูลวิชาบูรณาการเปลี่ยนตามเมื่อโหลดใหม่ ไม่มีการคัดลอกข้อมูลสองชุด คะแนนและการประเมินยังแยกตามวิชา
- ไม่รวมสถานะเดิมที่เคยบันทึกแยกไว้ในวิชาบูรณาการ และปฏิเสธ RPC ที่พยายามบันทึกซ้ำ ข้อมูลเดิมยังอยู่ในฐานข้อมูล
- ตารางสอนและภาระสอนจริงไม่ถูกเพิ่มคาบซ้ำ หากผู้ดูแลแก้ตารางหรือชั่วโมงในหลักสูตร ระบบจะคำนวณชุดคาบจากข้อมูลล่าสุด
- ทดสอบฐานข้อมูลด้วย `tests/integrated-attendance.sql` กับข้อมูลนำเข้าที่มีคู่คณิตศาสตร์เพิ่มเติม 20/60 ชั่วโมง ทุกการเปลี่ยนข้อมูลในชุดทดสอบใช้ transaction และ rollback
