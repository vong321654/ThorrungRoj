-- =====================================================================
-- รองรับสิทธิและระยะเวลาเก็บข้อมูลตาม PDPA (มาตรา 33, 37 (1), 37 (3))
--
-- ส่วน A: ลูกค้าแก้ได้เฉพาะข้อมูลโปรไฟล์ของตัวเอง
-- ส่วน B: ลบข้อมูลลูกค้าตามคำขอ หรือเมื่อไม่ใช้งานเกิน 2 ปี
-- ส่วน C: ลบข้อมูลที่พ้นกำหนดเก็บตามข้อ 5 ของนโยบายความเป็นส่วนตัว
--
-- ถ้าแก้ระยะเวลาในไฟล์นี้ ต้องแก้ใน app/privacy/PrivacyPolicyContent.tsx ให้ตรงกันด้วย
-- =====================================================================

alter table public.users add column if not exists "erasedAt" timestamptz;


-- ---------------------------------------------------------------------
-- ส่วน A: เดิมลูกค้าแก้ทุกคอลัมน์ในแถวตัวเองได้ รวมถึง lineUserId, authId และ isActive
-- ใช้ trigger แทนการ revoke สิทธิ์คอลัมน์ เพราะ super admin แก้ผ่าน token ของตัวเอง (role authenticated)
-- ไม่ได้ใช้ service role การ revoke จึงจะทำให้หน้าแก้ไขลูกค้าของแอดมินใช้ไม่ได้
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
      new."createdAt", new."erasedAt", new."privacyPolicyVersion", new."privacyAcknowledgedAt")
     is distinct from
     (old.id, old."lineUserId", old."authId", old."isActive", old."avatarUrl",
      old."lineDisplayName", old."contactName", old."shopName", old."customerType",
      old."createdAt", old."erasedAt", old."privacyPolicyVersion", old."privacyAcknowledgedAt")
  then
    raise exception 'Customers can only update their name, email, phone and address'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public."protectCustomerColumns"() from public, anon, authenticated;

drop trigger if exists "users_protectCustomerColumns" on public.users;
create trigger "users_protectCustomerColumns"
  before update on public.users
  for each row execute function public."protectCustomerColumns"();


-- ---------------------------------------------------------------------
-- ส่วน B: ถ้ายังมีรายการค้าง ร้านต้องเก็บไว้ใช้สิทธิเรียกร้องได้ (มาตรา 33 วรรคสอง)
-- ---------------------------------------------------------------------
create or replace function public."customerHasOpenItems"("pUserId" uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o."userId" = "pUserId"
      and (
        o.status in ('pending', 'preparing', 'delivering')
        or (
          o.status = 'delivered'
          and o."paymentMethod" in ('cash', 'qrScan')
          and o."paymentStatus" not in ('paid', 'verified')
        )
      )
  ) or exists (
    select 1 from public."debtRecords" d
    where d."userId" = "pUserId" and d.status <> 'paid'
  );
$$;

-- เก็บแถวเดิมไว้เพราะคำสั่งซื้ออ้างถึง แต่ล้างข้อมูลที่ระบุตัวลูกค้า และลบบัญชีใน auth.users
-- เอกสารการซื้อขายจะถูกล้างเมื่อพ้นกำหนดในส่วน C
create or replace function public."eraseCustomerData"("pUserId" uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid;
  v_erased_at timestamptz;
begin
  select u."authId", u."erasedAt" into v_auth_id, v_erased_at
  from public.users u
  where u.id = "pUserId"
  for update;

  if not found then return 'notFound'; end if;
  if v_erased_at is not null then return 'alreadyErased'; end if;
  if public."customerHasOpenItems"("pUserId") then return 'hasOpenItems'; end if;

  delete from public."chatLogs" c where c."userId" = "pUserId";

  update public.users u
  set "lineUserId" = 'erased:' || u.id::text,
      name = 'ลูกค้าที่ลบข้อมูลแล้ว',
      phone = null,
      email = null,
      address = null,
      "avatarUrl" = null,
      "authId" = null,
      "lineDisplayName" = null,
      "contactName" = null,
      "shopName" = null,
      "privacyPolicyVersion" = null,
      "privacyAcknowledgedAt" = null,
      "isActive" = false,
      "erasedAt" = now()
  where u.id = "pUserId";

  -- auth.users เก็บชื่อและรูปจาก LINE ด้วย ต้องลบด้วย แต่ห้ามแตะบัญชีที่เป็นพนักงาน
  if v_auth_id is not null
     and not exists (select 1 from public.employees e where e."authId" = v_auth_id) then
    delete from auth.users a where a.id = v_auth_id;
  end if;

  return 'erased';
end;
$$;


-- ---------------------------------------------------------------------
-- ส่วน C: เอกสารการซื้อขายเก็บ 5 ปีนับจากวันปิดบัญชีของปีที่เกิดรายการ
-- ถือว่าปิดบัญชีวันที่ 31 ธันวาคม เช่น รายการปี 2569 ปิดบัญชีสิ้นปี 2569 จะพ้นกำหนดเมื่อขึ้นปี 2575
-- ---------------------------------------------------------------------
create or replace function public."orderRetentionExpired"("pOrderId" uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = "pOrderId"
      and o.status in ('delivered', 'cancelled')
      and o."createdAt" < (
        date_trunc('year', (now() at time zone 'Asia/Bangkok') - interval '5 years')
      ) at time zone 'Asia/Bangkok'
      and not exists (
        select 1 from public."debtRecords" d
        where d."orderId" = o.id and d.status <> 'paid'
      )
  );
$$;

-- แอปต้องลบไฟล์ใน Storage ก่อนลบแถว ฟังก์ชันนี้จึงแค่บอกว่าสลิปใดพ้นกำหนด
create or replace function public."listExpiredTransferSlips"("pLimit" integer)
returns table (id uuid, "slipImageUrl" text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t."slipImageUrl"
  from public."transferSlips" t
  join public.payments p on p.id = t."paymentId"
  where public."orderRetentionExpired"(p."orderId")
  order by t."createdAt"
  limit "pLimit";
$$;

create or replace function public."runPrivacyRetention"()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chat_logs integer;
  v_orders integer;
  v_debts integer;
  v_customers integer := 0;
  v_customer_id uuid;
begin
  delete from public."chatLogs" c where c."createdAt" < now() - interval '1 year';
  get diagnostics v_chat_logs = row_count;

  with expired as (
    select o.id from public.orders o
    where public."orderRetentionExpired"(o.id)
      and (o."deliveryAddress" is not null or o.note is not null
           or o."deliveryLat" is not null or o."deliveryLng" is not null)
  )
  update public.orders o
  set "deliveryAddress" = null, note = null, "deliveryLat" = null, "deliveryLng" = null
  from expired
  where o.id = expired.id;
  get diagnostics v_orders = row_count;

  update public."deliveryTracking" t
  set "destLat" = null, "destLng" = null, "currentLat" = null, "currentLng" = null,
      "lastKnownLat" = null, "lastKnownLng" = null
  where public."orderRetentionExpired"(t."orderId")
    and (t."destLat" is not null or t."destLng" is not null
         or t."currentLat" is not null or t."currentLng" is not null
         or t."lastKnownLat" is not null or t."lastKnownLng" is not null);

  delete from public."deliveryCheckpoints" c where public."orderRetentionExpired"(c."orderId");

  -- ล้างรายการย่อยก่อน เพราะการแก้ debtRecords จะเลื่อน updatedAt ที่ใช้เป็นวันปิดรายการ
  update public."debtTransactions" t
  set note = null
  from public."debtRecords" d
  where d.id = t."debtRecordId"
    and d.status = 'paid'
    and d."updatedAt" < now() - interval '5 years'
    and t.note is not null;

  update public."debtRecords" d
  set note = null
  where d.status = 'paid'
    and d."updatedAt" < now() - interval '5 years'
    and d.note is not null;
  get diagnostics v_debts = row_count;

  -- การใช้งานล่าสุดนับจากการเข้าสู่ระบบหรือแก้ข้อมูล (updatedAt) และการสั่งซื้อครั้งล่าสุด
  for v_customer_id in
    select u.id from public.users u
    where u."erasedAt" is null
      and u."updatedAt" < now() - interval '2 years'
      and not exists (
        select 1 from public.orders o
        where o."userId" = u.id and o."createdAt" >= now() - interval '2 years'
      )
      and not public."customerHasOpenItems"(u.id)
  loop
    if public."eraseCustomerData"(v_customer_id) = 'erased' then
      v_customers := v_customers + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'chatLogs', v_chat_logs,
    'orders', v_orders,
    'debts', v_debts,
    'customers', v_customers
  );
end;
$$;

-- เรียกได้จากเซิร์ฟเวอร์ด้วย service role เท่านั้น
revoke all on function public."customerHasOpenItems"(uuid) from public, anon, authenticated;
revoke all on function public."eraseCustomerData"(uuid) from public, anon, authenticated;
revoke all on function public."orderRetentionExpired"(uuid) from public, anon, authenticated;
revoke all on function public."listExpiredTransferSlips"(integer) from public, anon, authenticated;
revoke all on function public."runPrivacyRetention"() from public, anon, authenticated;
grant execute on function public."eraseCustomerData"(uuid) to service_role;
grant execute on function public."listExpiredTransferSlips"(integer) to service_role;
grant execute on function public."runPrivacyRetention"() to service_role;
