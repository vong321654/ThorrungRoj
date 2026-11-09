-- =====================================================================
-- ลูกค้าแนบสลิปได้เฉพาะ payment ที่ยังรอชำระ และออเดอร์ยังไม่ถูกยกเลิก
--
-- เดิม policy เช็คแค่ว่าเป็น payment ของตัวเอง หลังร้านกดยืนยัน (payments.status = 'paid')
-- ลูกค้ายังแนบสลิปเพิ่มได้ ทั้งจากปุ่มในหน้าเว็บและยิง insert ตรงผ่าน Supabase API
-- สลิปที่ถูกปฏิเสธไม่เปลี่ยนสถานะ payment (ยังเป็น pending) ลูกค้าจึงยังแนบใหม่ได้ตามเดิม
-- เงื่อนไขเดียวกับช่องทาง LINE (lineSlipService) และ POST /api/images
-- เปลี่ยนจากเดิมเฉพาะ 2 บรรทัด p.status กับ o.status ส่วนอื่นเหมือนเดิม รันซ้ำได้
-- =====================================================================

drop policy if exists "transfer_slips_insert_own" on public."transferSlips";

create policy "transfer_slips_insert_own" on public."transferSlips"
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.users u
      join public.orders o on o."userId" = u.id
      join public.payments p on p."orderId" = o.id
      where u.id = "transferSlips"."userId"
        and u."authId" = (select auth.uid())
        and u."isActive" = true
        and p.id = "transferSlips"."paymentId"
        and p.status = 'pending'
        and o.status <> 'cancelled'
    )
    and (storage.foldername("slipImageUrl"))[1] = 'receipts'
    and (storage.foldername("slipImageUrl"))[2] = "userId"::text
    and (storage.foldername("slipImageUrl"))[3] = "paymentId"::text
    and status = 'pending'
    and "verifiedBy" is null
    and "verifiedAt" is null
  );
