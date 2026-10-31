# PP5 form reference

Reference: user-supplied `report5_V29.xls(2).xlsx`, print sheets `1.พิมพ์หน้าปก`, `2.พิมพ์เวลาเรียน`, `3.พิมพ์คะแนน`, `5.พิมพ์ ตชว`.

The printed form retains the source's emblem/title, inline course metadata, grade/count/percentage table, side-by-side assessment summaries, approval/signature boxes, four-level attendance headers and ruled 30-row rosters with larger data text. Secondary results use portrait A4 with the selected term only. Primary results use landscape A4 with two term groups side by side and annual total/grade; each student occupies one row. Scores, the eight traits and the five reading criteria now print on three separate sheets. Trait and reading sheets use portrait A4 and explicitly show the selected assessment term; their data and quality formulas are unchanged. Each has its own 30-row roster and continuation pages. A standard book has 9 pages: cover, four attendance pages, scores, traits, reading, indicators. Larger rosters add continuation pages to each section, and page numbers run continuously through the whole book. Indicators retain the metadata and numbered writing area. TH Sarabun New Regular/Bold is embedded in the PDF.

User-directed adaptations take precedence over the original template: attendance has 25 Monday–Friday date columns in each five-week block, with multiple actual timetable periods in the same day cell. Nonteaching days are shaded. Dates beyond the first 20 weeks and rosters beyond 30 students continue rather than being cropped. Page numbers apply to the full book.

Scores/caps come directly from the same record used by the teacher score-entry form. Primary entry stores six score values in that record; the report prints each term’s coursework/midterm/final/term total, then annual total and grade. Secondary prints only the selected term’s coursework/midterm/final/total/grade. The user explicitly requested removing indicator-level score columns, pre/post-midterm breakdowns, retake placeholders and derived in-term totals. Indicators are report content on the separate indicator page, not score-entry requirements or grading inputs. Annual primary grades remain pending until both terms are complete.

The original workbook's fixed staff names are not copied into live reports. Teacher/homeroom names come from system data. School Admin sets assessment head, academic head and principal names in `/admin/pp5-signatories` for each academic year (`pp5_signatories` table). The teacher's PP5 cover reads the selected year and prints those names beside signature lines; unconfigured names remain dotted handwriting lines. Saving one year's names does not affect another year. Only school_admin may write; authorized school teachers may read. The source OBEC emblem is copied without editing. No school or student records are changed by the layout.

The cover badge uses the same top-right frame coordinates as PP6 (x=533.469, y=14.548, w=33.09, h=15.15 on A4). Class/semester/year and male/female/total counts use three equal 165 pt columns with 15 pt gutters. All metadata uses the same 88 pt label width and 4 pt value gap. Longer course and learning-area fields span columns; total teaching hours span two columns and weekly teaching hours align with the academic-year column; homeroom teachers use equal 255 pt halves. The principal signature line, name and role share the center of the right approval box. The score ratio labels each component and credit units have their own field. Data, fonts, summary tables and signatures retain their existing sources.


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


## ตัวอักษรในรูปเล่ม

ใช้ TH Sarabun New Regular/Bold ต้นฉบับจาก SIPAFonts ฝังลงใน PDF ทุกหน้า โดยใช้ไฟล์ TTF ต้นฉบับใน `public/pp6` และฝังเป็น TrueType subset ผ่าน fontkit และเงื่อนไขลิขสิทธิ์/ข้อยกเว้นการฝังฟอนต์ที่อยู่ในโฟลเดอร์เดียวกัน

ขนาดอักษรจาก `PP5_TYPE`: หัวข้อหลักทุกหน้า 20 pt, หัวข้อส่วนในปก 16 pt, เนื้อหา/รายชื่อ/คะแนน 14 pt, หัวตารางและหมายเหตุ/เลขหน้า 12 pt ใช้การขึ้นบรรทัดในหัวตารางแทนการย่อหัวข้อแต่ละช่องเป็นขนาดต่างกัน ข้อมูลยาวใช้การตัดบรรทัดและต่อหน้า โดยแถวรายชื่อและข้อมูลใช้ 12 pt ตามรูปแบบ 25 คนต่อหน้า

หัวข้อหน้าเวลาเรียนแยกจากข้อมูลรายวิชาเป็นสองบรรทัด หน้าคะแนนมัธยมใช้ความกว้างกระดาษให้ครบเพื่อรักษาขนาดหัวข้อเดียวกับประถม บล็อกลงชื่อจัดชื่อและตำแหน่งคนละบรรทัดเพื่อให้อ่านได้ชัดเจน


## Vertical cell alignment

Cell text uses the visible bounds of the shaped TH Sarabun New glyphs, including upper/lower Thai vowels and tone marks, to place the block at the center of the cell. Multiline headers and rotated labels use the same visible-bounds centering. A one-point clearance is reserved from horizontal rules; unusually tall names use the existing 12 pt fallback instead of crossing a border. Primary result rows are 15 pt high with a compact 60 pt header, retaining 30 students and both terms on one landscape A4 page. Attendance and assessment rows keep their existing dimensions. Unit PDF checks compare actual glyph outlines with drawn cell rectangles and verify centered ink and clearance; full books are rendered for visual review.

## ขอบกระดาษและการจัดหน้า

- ทุกหน้า A4 กำหนดพื้นที่เนื้อหาและเลขหน้าให้อยู่ภายในขอบ 72 pt หรือ 2.54 ซม. ทุกด้าน
- คงโครงสร้าง องค์ประกอบ และผู้ลงนามของหน้าปกในหน้าเดียว โดยลดช่องว่างและปรับความกว้างตารางตามพื้นที่พิมพ์
- หัวเรื่องและหน้าปกคงขนาดเดิม 20/16/14/12 pt ส่วนข้อมูลแถวรายชื่อ คะแนน เวลาเรียน และผลประเมินใช้ 12 pt เพื่อจัดหน้าได้ 25 คน ไม่บีบสัดส่วนตัวอักษร
- เวลาเรียนเป็นแนวตั้ง 4 สัปดาห์หรือ 20 วันต่อหน้า และรวมช่องชื่อเดือนที่ต่อเนื่องกัน จำนวนแถวนักเรียน 25 คนต่อหน้า โดยใช้ตัวอักษรข้อมูลแถว 12 pt
- คะแนนประถมเป็นแนวตั้งสองภาคเรียนในแถวเดียว มัธยมยังเป็นแนวตั้งรายภาคเรียน ชื่อครูอยู่ต่อจากรายวิชาในส่วนหัวเดียวกัน
- คุณลักษณะและอ่านเขียนเป็นแนวตั้ง ลดความกว้างคอลัมน์ชื่อและผลประเมิน พร้อมตัดบรรทัดหัวคอลัมน์แนวตั้งโดยไม่ย่อฟอนต์
- ไม่พิมพ์คำอธิบายสัญลักษณ์เวลาเรียน หมายเหตุการสรุปเกรดรายปี และคำอธิบายระดับคุณภาพท้ายหน้า
- หน้าตัวชี้วัดตัดบรรทัดและต่อหน้าอัตโนมัติภายในขอบเดียวกัน
- จำนวนหน้าตามจำนวนนักเรียน (แบ่งทุก 25 คน) สัปดาห์ และความยาวข้อความ ไม่กำหนดคงที่ 9 หน้า

หัวข้อหน้าเวลาเรียน คะแนน คุณลักษณะ และอ่านเขียนใช้ 16 pt ตัวหนา บรรทัดรายวิชาและผู้สอนคง 14 pt และเว้นระยะก่อนตาราง 6 pt โดยขยับบรรทัดรายละเอียดขึ้นเพื่อคงพื้นที่ 25 แถวเดิม หน้าปกและหัวข้อตัวชี้วัดไม่เปลี่ยนขนาด

ทุกหน้าเป็น A4 แนวตั้ง ช่องชื่อในตารางเวลาเรียนกว้าง 99 pt (รวมพื้นที่ใต้หัวสัปดาห์) และคะแนนประถม 100 pt ลดจาก 190 และ 200 pt ตามลำดับ ยังคง 4 สัปดาห์ต่อหน้า คะแนนประถมสองภาคในแถวเดียว และนักเรียน 25 คนต่อหน้า
