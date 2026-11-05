-- =====================================================================
-- ปิดช่องโหว่การสั่งซื้อระดับฐานข้อมูล (Hardening) — 2026-11-05
--
-- สถานะ: ยังไม่ได้รันกับฐานข้อมูลจริง เขียนจากโครงสร้างที่อ่านได้ ณ วันนี้
-- ควรลองบน Supabase Branch หรือรันทีละส่วนใน SQL Editor แล้วทดสอบสั่งซื้อก่อนใช้งานจริง
-- ไม่จำเป็นสำหรับการสาธิตวันที่ 7: ระบบทำงานได้ตามปกติโดยไม่มีไฟล์นี้
--
-- ปัญหาที่แก้ (พบจากการรีวิว):
--   H1  ลูกค้าที่ล็อกอินยิง PostgREST ตรงเข้า orders/orderItems ได้ ข้ามการตรวจสต๊อกและราคาทั้งหมด
--       เช่น ใส่ unitPrice = 0, quantity = 100000, หรือยัดสินค้าเพิ่มเข้าออเดอร์ที่ส่งแล้ว
--   H2  ลูกค้าลบออเดอร์ของตัวเองได้ทุกสถานะ (แม้ส่งแล้ว) ทำให้ประวัติบัญชีหาย
--   M1  สั่งพร้อมกันตอนเหลือของชิ้นสุดท้ายแล้วผ่านทั้งคู่ (ตรวจกับบันทึกไม่ได้อยู่ในขั้นตอนเดียวกัน)
--
-- สิ่งที่ไฟล์นี้ "ไม่" แก้: orders."totalAmount" ยังเป็นค่าที่ฝั่งลูกค้าส่งมาได้ถ้ายิงตรง
-- (ราคาต่อชิ้นถูกบังคับแล้ว แต่ยอดรวมในหัวออเดอร์ยังไม่ถูกตรวจ) ให้แอดมินเทียบยอดกับสลิปทุกครั้ง
-- ทางแก้เต็มคือให้ createOrder เขียนด้วย service role แล้วลบ policy INSERT ของลูกค้า (งานรอบถัดไป)
-- =====================================================================


-- ---------------------------------------------------------------------
-- ส่วน A: trigger บังคับกติกาของ orderItems ตอน INSERT (แก้ H1 + M1)
--   1) เพิ่มรายการได้เฉพาะออเดอร์ที่ยัง pending
--   2) จำนวน 1-100 และ saleType เป็น sell/exchange เท่านั้น
--   3) unitPrice ถูกเขียนทับด้วยราคาจากตาราง products เสมอ (ค่าที่ client ส่งมาไม่มีผล)
--   4) ล็อกตาม productId แล้วเทียบสต๊อก: ถังเต็มคงเหลือ - จำนวนในออเดอร์ที่ยังไม่ส่ง
--      (กติกาเดียวกับ stockService.ts ฝั่งเว็บ: สินค้าไม่มีแถวคลังถือว่าเหลือ 0)
-- SECURITY DEFINER เพราะต้องนับออเดอร์ของลูกค้าทุกคน ซึ่ง RLS ไม่ให้ลูกค้าคนหนึ่งเห็น
-- ---------------------------------------------------------------------
create or replace function public."enforceOrderItemRules"()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_status public."orderStatus";
  v_price numeric;
  v_on_hand integer;
  v_open integer;
begin
  select o.status into v_order_status
  from public.orders o
  where o.id = new."orderId";

  if v_order_status is distinct from 'pending' then
    raise exception 'Items can only be added to a pending order';
  end if;

  if new.quantity < 1 or new.quantity > 100 then
    raise exception 'Quantity must be between 1 and 100';
  end if;

  if new."saleType" not in ('sell', 'exchange') then
    raise exception 'Invalid sale type';
  end if;

  select case new."saleType" when 'exchange' then p."exchangePrice" else p."sellPrice" end
  into v_price
  from public.products p
  where p.id = new."productId" and p."isActive" = true;

  if v_price is null or v_price <= 0 then
    raise exception 'Product is inactive or has no price for this sale type';
  end if;
  new."unitPrice" := v_price;

  -- ให้ออเดอร์ที่สั่งสินค้าเดียวกันทำงานทีละรายการ ปิดช่องสั่งพร้อมกันแล้วผ่านทั้งคู่
  perform pg_advisory_xact_lock(hashtextextended('orderItems:' || new."productId"::text, 0));

  select coalesce(sum(i."quantityOnHand" - i."quantityReserved"), 0)
  into v_on_hand
  from public."inventoryProducts" i
  where i."productId" = new."productId" and i."stockStatus" = 'full';

  select coalesce(sum(oi.quantity), 0)
  into v_open
  from public."orderItems" oi
  join public.orders o on o.id = oi."orderId"
  where oi."productId" = new."productId"
    and o.status in ('pending', 'preparing', 'delivering');

  if v_open + new.quantity > v_on_hand then
    raise exception 'Insufficient stock for product %', new."productId";
  end if;

  return new;
end;
$$;

-- เป็นฟังก์ชันของ trigger เท่านั้น ไม่ให้ใครเรียกตรงผ่าน /rpc
revoke all on function public."enforceOrderItemRules"() from public, anon, authenticated;

drop trigger if exists "orderItems_enforceRules" on public."orderItems";
create trigger "orderItems_enforceRules"
  before insert on public."orderItems"
  for each row execute function public."enforceOrderItemRules"();


-- ---------------------------------------------------------------------
-- ส่วน B: ลูกค้าสร้างออเดอร์ได้เฉพาะแบบ "ใหม่เอี่ยม" (แก้ H1 ส่วนหัวออเดอร์)
--   ห้ามตั้งสถานะ/การชำระเงินเป็นอย่างอื่นเอง เช่น paymentStatus = 'paid'
-- ---------------------------------------------------------------------
drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert to authenticated
  with check (
    exists (
      select 1 from public.users u
      where u.id = orders."userId"
        and u."authId" = (select auth.uid())
        and u."isActive" = true
    )
    and status = 'pending'
    and "paymentStatus" = 'pending'
    and "paidAt" is null
  );


-- ---------------------------------------------------------------------
-- ส่วน C: ลูกค้าลบได้เฉพาะออเดอร์ที่ยัง pending และยังไม่ชำระ (แก้ H2)
--   ยังพอสำหรับ rollback ของ createOrder ตอนสร้างออเดอร์ไม่สำเร็จ
-- ---------------------------------------------------------------------
drop policy if exists orders_delete_own on public.orders;
create policy orders_delete_own on public.orders
  for delete to authenticated
  using (
    public.currentuserownsorder(id)
    and status = 'pending'
    and "paymentStatus" = 'pending'
  );

drop policy if exists order_items_delete_own on public."orderItems";
create policy order_items_delete_own on public."orderItems"
  for delete to authenticated
  using (
    public.currentuserownsorder("orderId")
    and exists (
      select 1 from public.orders o
      where o.id = "orderItems"."orderId"
        and o.status = 'pending'
        and o."paymentStatus" = 'pending'
    )
  );


-- ---------------------------------------------------------------------
-- วิธีย้อนกลับ (ถ้าสั่งซื้อมีปัญหา) — รันบล็อกนี้เพื่อคืนค่าเดิมทั้งหมด
-- ---------------------------------------------------------------------
-- drop trigger if exists "orderItems_enforceRules" on public."orderItems";
-- drop function if exists public."enforceOrderItemRules"();
--
-- drop policy if exists orders_insert_own on public.orders;
-- create policy orders_insert_own on public.orders for insert to authenticated
--   with check (exists (select 1 from public.users u
--     where u.id = orders."userId" and u."authId" = (select auth.uid()) and u."isActive" = true));
--
-- drop policy if exists orders_delete_own on public.orders;
-- create policy orders_delete_own on public.orders for delete to authenticated
--   using (public.currentuserownsorder(id));
--
-- drop policy if exists order_items_delete_own on public."orderItems";
-- create policy order_items_delete_own on public."orderItems" for delete to authenticated
--   using (public.currentuserownsorder("orderId"));


-- ---------------------------------------------------------------------
-- ตรวจหลังรัน (อ่านอย่างเดียว)
-- ---------------------------------------------------------------------
-- select tgname from pg_trigger where tgrelid = 'public."orderItems"'::regclass and not tgisinternal;
-- select policyname, cmd from pg_policies where schemaname = 'public' and tablename in ('orders', 'orderItems');
-- ทดสอบจริง: สั่งซื้อสินค้าเกินสต๊อกผ่านหน้าเว็บ ต้องได้ข้อความ "มีไม่พอ" และไม่มีออเดอร์ค้างในตาราง orders
