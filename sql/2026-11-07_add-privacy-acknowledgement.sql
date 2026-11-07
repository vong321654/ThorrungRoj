-- =====================================================================
-- บันทึกหลักฐานว่าลูกค้ารับทราบนโยบายความเป็นส่วนตัว (PDPA มาตรา 23) ฉบับใด เมื่อใด
--
-- ต้องรันก่อน deploy โค้ดที่อ่านคอลัมน์นี้ ไม่งั้น /api/users/me จะตอบ 500
-- ลูกค้าเดิมมีค่าเป็น null จึงจะเห็น pop-up เมื่อเข้าใช้งานครั้งถัดไป
-- =====================================================================
alter table public.users
  add column if not exists "privacyPolicyVersion" text,
  add column if not exists "privacyAcknowledgedAt" timestamptz;
