-- =====================================================================
-- ราคาแยกสำหรับร้านค้ากับบ้านทั่วไป (เฉพาะเปลี่ยนถังและฝากเติม)
--
-- 1. products: ราคาร้านค้าของเปลี่ยนถัง/ฝากเติม (0 = ไม่ได้ตั้ง ใช้ราคาปกติแทน)
-- 2. users: ลูกค้าเลือกประเภทครั้งเดียวหลังรับทราบนโยบาย
--    - "customerTypeChosenAt" null = ยังไม่เลือก หน้าร้านจะขึ้น pop-up ให้เลือก
--    - เลือกร้านค้า = "shopRequestStatus" เป็น pending ระหว่างนี้ customerType ยังเป็น individual
--      แอดมินกดยืนยัน (approved, customerType = shop) หรือยกเลิก (rejected, customerType = individual)
-- 3. orders: เก็บประเภทราคาที่ใช้ตอนสั่ง ถ้าแอดมินเปลี่ยนประเภทลูกค้าทีหลัง ออเดอร์เก่ายังถูกต้อง
-- 4. ลูกค้าแก้คอลัมน์ใหม่ใน users เองไม่ได้ (เพิ่มเข้า trigger "protectCustomerColumns")
--
-- ต้องรันก่อน deploy โค้ดที่อ่านคอลัมน์เหล่านี้ ไม่งั้น /api/users/me และการสั่งซื้อจะตอบ 500
-- ลูกค้าเดิมทุกคนมี "customerTypeChosenAt" เป็น null จึงจะเห็น pop-up ให้เลือกในการเข้าใช้ครั้งถัดไป
-- ยกเว้นลูกค้าที่แอดมินตั้งเป็นร้านค้าไว้แล้ว (ส่วน backfill ด้านล่าง) ถือว่ายืนยันแล้ว ไม่ต้องเลือกใหม่
-- 5. trigger "enforceOrderItemRules" (จาก 2026-11-05_harden-orders.sql) เขียนทับ unitPrice ด้วยราคาปกติเสมอ
--    ต้องให้ใช้ราคาร้านค้าด้วย ไม่งั้นราคาต่อชิ้นของร้านค้าไม่ตรงกับยอดรวมของออเดอร์
-- =====================================================================

alter table public.products
  add column if not exists "shopExchangePrice" numeric(10,2) not null default 0,
  add column if not exists "shopRefillPrice" numeric(10,2) not null default 0;

alter table public.users
  add column if not exists "customerTypeChosenAt" timestamptz,
  add column if not exists "shopRequestStatus" text;

-- ลูกค้าที่เป็นร้านค้าอยู่แล้วไม่ต้องเห็น pop-up และไม่ถูกบังคับเลือกใหม่ (รันซ้ำได้ เพราะกรองเฉพาะที่ยังไม่เลือก)
update public.users
  set "customerTypeChosenAt" = now(), "shopRequestStatus" = 'approved'
  where "customerType" = 'shop' and "customerTypeChosenAt" is null;

alter table public.users drop constraint if exists "users_shopRequestStatus_check";
alter table public.users
  add constraint "users_shopRequestStatus_check"
  check ("shopRequestStatus" is null or "shopRequestStatus" in ('pending', 'approved', 'rejected'));

alter table public.orders
  add column if not exists "customerType" text not null default 'individual';

alter table public.orders drop constraint if exists "orders_customerType_check";
alter table public.orders
  add constraint "orders_customerType_check"
  check ("customerType" in ('individual', 'shop'));


-- ---------------------------------------------------------------------
-- เพิ่มคอลัมน์ใหม่เข้า trigger เดิม (ต้นฉบับอยู่ใน 2026-11-07_privacy-rights-and-retention.sql)
-- ลูกค้าเลือกประเภทผ่าน /api/users/me/customer-type ซึ่งเขียนด้วย service role จึงไม่ติด trigger นี้
-- ---------------------------------------------------------------------
create or replace function public."protectCustomerColumns"()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if public.currentemployeerole() = 'superAdmin' then return new; end if;

  if (new.id, new."lineUserId", new."authId", new."isActive", new."avatarUrl",
      new."lineDisplayName", new."contactName", new."shopName", new."customerType",
      new."createdAt", new."erasedAt", new."privacyPolicyVersion", new."privacyAcknowledgedAt",
      new."customerTypeChosenAt", new."shopRequestStatus")
     is distinct from
     (old.id, old."lineUserId", old."authId", old."isActive", old."avatarUrl",
      old."lineDisplayName", old."contactName", old."shopName", old."customerType",
      old."createdAt", old."erasedAt", old."privacyPolicyVersion", old."privacyAcknowledgedAt",
      old."customerTypeChosenAt", old."shopRequestStatus")
  then
    raise exception 'Customers can only update their name, email, phone and address'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public."protectCustomerColumns"() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- ให้ trigger "enforceOrderItemRules" คิดราคาร้านค้าด้วย (เหมือน getUnitPrice ใน orderService.ts)
-- เดิม trigger เขียนทับ unitPrice ด้วยราคาปกติเสมอ ร้านค้าจึงได้ยอดรวมราคาร้านค้าแต่ราคาต่อชิ้นเป็นราคาปกติ
-- ประเภทอ่านจาก users."customerType" ไม่ใช่ orders."customerType" เพราะลูกค้ายิง insert orders ตรงได้
-- (users."customerType" ลูกค้าแก้เองไม่ได้ เพราะ trigger "protectCustomerColumns")
-- ถ้ายังไม่ได้รัน 2026-11-05_harden-orders.sql ฟังก์ชันนี้จะยังไม่ถูกผูกกับ trigger และไม่มีผลอะไร
-- เปลี่ยนจากต้นฉบับเฉพาะ v_is_shop กับ case ของราคา ส่วนตรวจสต๊อกเหมือนเดิม
-- ---------------------------------------------------------------------
create or replace function public."enforceOrderItemRules"()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_status public."orderStatus";
  v_is_shop boolean;
  v_price numeric;
  v_on_hand integer;
  v_open integer;
begin
  select o.status, coalesce(u."customerType" = 'shop', false)
  into v_order_status, v_is_shop
  from public.orders o
  left join public.users u on u.id = o."userId"
  where o.id = new."orderId";

  if v_order_status is distinct from 'pending' then
    raise exception 'Items can only be added to a pending order';
  end if;

  if new.quantity < 1 or new.quantity > 100 then
    raise exception 'Quantity must be between 1 and 100';
  end if;

  if new."saleType" not in ('sell', 'exchange', 'refill') then
    raise exception 'Invalid sale type';
  end if;

  -- ราคาร้านค้า 0 = ไม่ได้ตั้ง ใช้ราคาปกติ ซื้อถังมีราคาเดียว
  select case new."saleType"
    when 'exchange' then
      case when v_is_shop and p."shopExchangePrice" > 0 then p."shopExchangePrice" else p."exchangePrice" end
    when 'refill' then
      case when v_is_shop and p."shopRefillPrice" > 0 then p."shopRefillPrice" else p."refillPrice" end
    else p."sellPrice"
  end
  into v_price
  from public.products p
  where p.id = new."productId" and p."isActive" = true;

  if v_price is null or v_price <= 0 then
    raise exception 'Product is inactive or has no price for this sale type';
  end if;
  new."unitPrice" := v_price;

  if new."saleType" = 'refill' then
    return new;
  end if;

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
    and oi."saleType" <> 'refill'
    and o.status in ('pending', 'preparing', 'delivering');

  if v_open + new.quantity > v_on_hand then
    raise exception 'Insufficient stock for product %', new."productId";
  end if;

  return new;
end;
$$;

revoke all on function public."enforceOrderItemRules"() from public, anon, authenticated;
