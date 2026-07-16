# FITNESS TRACKER
Architecture Decisions (ADR)

Version: 1.0

=========================================
PROJECT PHILOSOPHY
=========================================

Fitness Tracker không phải một ứng dụng AI.

Đây là một hệ thống lưu trữ dữ liệu tập luyện
được thiết kế để sử dụng nhiều năm.

Triết lý phát triển:

- Offline First
- Free First
- AI Ready
- Data First
- Long-term Maintainable

AI chỉ là công cụ phân tích dữ liệu,
không phải một phần bắt buộc của hệ thống.

=========================================
ADR-001
Database First
=========================================

Mọi dữ liệu phải được lưu đầy đủ.

Không tính toán từ UI.

Dashboard chỉ đọc dữ liệu.

Không lưu dữ liệu tạm trong component.

=========================================
ADR-002
Template chỉ dùng để tạo Session
=========================================

Workout Template chỉ là khuôn mẫu.

Khi tạo Workout Session:

Template
↓

Session

Sau đó Session tồn tại độc lập.

Template thay đổi
không được ảnh hưởng Session đã tạo.

=========================================
ADR-003
Session là nguồn dữ liệu chính
=========================================

Workout History

↓

Session

↓

Session Exercises

không đọc trực tiếp Template.

=========================================
ADR-004
Partial Snapshot
=========================================

Session Exercise chỉ lưu:

- session_id
- exercise_id
- display_order
- target_sets
- target_reps
- notes
- created_from_template_id

Không lưu:

- exercise_name
- muscles
- cue
- image
- video
- equipment
- difficulty

Metadata luôn đọc từ Exercise Library.

Lý do:

- không duplicate data
- dễ mở rộng
- AI luôn đọc metadata mới nhất
- Exercise Library phát triển độc lập

=========================================
ADR-005
Exercise Library dùng Soft Delete
=========================================

Exercise sẽ không bị DELETE.

Thay vào đó:

is_active

hoặc

archived_at

Exercise Archive:

✓ không xuất hiện khi tạo Template

✓ không xuất hiện trong Exercise Picker

✓ Session cũ vẫn đọc được

✓ AI vẫn đọc được

✓ Images vẫn giữ

=========================================
ADR-006
Import phải Idempotent
=========================================

Import nhiều lần

↓

Không được duplicate.

Sử dụng

import_hash

để xác định dữ liệu đã tồn tại.

Application layer
không chịu trách nhiệm chống duplicate.

Database phải đảm bảo.

=========================================
ADR-007
AI Ready
=========================================

Không tích hợp AI trực tiếp.

Không phụ thuộc:

- Claude

- ChatGPT

- Gemini

- OpenAI API

- Anthropic API

Ứng dụng chỉ cần:

Export

↓

Markdown

JSON

CSV

↓

AI phân tích.

=========================================
ADR-008
Exercise Package
=========================================

Mỗi bài tập sẽ là một package hoàn chỉnh.

Exercise gồm:

- Name

- Category

- Primary Muscles

- Secondary Muscles

- Stabilizer

- Equipment

- Difficulty

- Technique Cue

- Common Mistakes

- Breathing

- Range of Motion

- Image

- Muscle Highlight Image

- Animation (future)

- Video (future)

- Tags

App chỉ render package.

Không hardcode dữ liệu trong code.

=========================================
ADR-009
Exercise Library là nguồn dữ liệu duy nhất
=========================================

Workout

Dashboard

Calendar

History

AI Export

đều đọc cùng một Exercise Library.

Không tạo nhiều bản copy.

=========================================
ADR-010
Commercial-grade Architecture
=========================================

Ưu tiên:

Maintainability

>

Performance

>

Features

Code dễ mở rộng
quan trọng hơn code ngắn.

Không thêm shortcut
làm hỏng kiến trúc.

=========================================
LONG TERM GOAL
=========================================

Ứng dụng phải có thể sử dụng ổn định
trong nhiều năm.

Có thể mở rộng:

✓ AI Coach

✓ Exercise Images

✓ Muscle Maps

✓ Videos

✓ Export

✓ Mobile App

✓ PWA

mà không cần thay đổi kiến trúc nền.
