-- =====================================================================
-- ระบุถังแก๊สจาก "ชื่อ" ประเภทสินค้าแทน id 14
--
-- productsType ถูกลบแล้วสร้างใหม่ (ถังแก๊สกลายเป็น id 17) ฟังก์ชันคลังสินค้าที่ฝังเลข 14 ไว้จึงไม่รู้จักถังแก๊ส:
--   - decrease_cylinder_as_admin: ปุ่ม "ลดถังเต็ม/ลดถังเปล่า" ตอบ error ทุกครั้ง
--   - create/update_inventory_with_log: ไม่บังคับสถานะถัง และลดถังเต็มแล้วไม่ย้ายไปเป็นถังเปล่า
-- โค้ดฝั่ง Next.js เปลี่ยนไปใช้ชื่อเหมือนกันแล้ว (app/util/productType.ts) ชื่อต้องตรงกันทั้งสองที่
-- เปลี่ยนจากต้นฉบับเฉพาะเงื่อนไข "typeId" = 14 ส่วนอื่นเหมือนเดิมทุกบรรทัด รันซ้ำได้
-- =====================================================================

create or replace function public."isGasCylinderType"(p_type_id bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public."productsType" t
    where t.id = p_type_id and btrim(t.name) = 'ถังแก๊ส'
  );
$$;
-- อ่านอย่างเดียวและ productsType เปิดให้อ่านทุกคนอยู่แล้ว จึงไม่ต้องจำกัดสิทธิ์ execute


CREATE OR REPLACE FUNCTION public.create_inventory_with_log(p_product_id bigint, p_stock_status text, p_item_condition text, p_quantity_on_hand integer, p_minimum_stock integer, p_note text, p_admin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_inventory public."inventoryProducts"%ROWTYPE; v_log public."inventoryLog"%ROWTYPE; v_type_id bigint;
BEGIN
  SELECT "typeId" INTO v_type_id FROM public.products WHERE id=p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF p_product_id<=0 OR p_quantity_on_hand<=0 OR p_minimum_stock<0 THEN RAISE EXCEPTION 'Invalid inventory quantities'; END IF;
  IF p_stock_status IS NOT NULL AND p_stock_status NOT IN ('full','empty','damaged') THEN RAISE EXCEPTION 'Invalid stock status'; END IF;
  IF p_item_condition NOT IN ('new','old','normal') THEN RAISE EXCEPTION 'Invalid item condition'; END IF;
  IF public."isGasCylinderType"(v_type_id) AND p_stock_status IS NULL THEN RAISE EXCEPTION 'Gas cylinders require a stock status'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=p_admin_id AND "isActive"=true) THEN RAISE EXCEPTION 'Invalid active admin'; END IF;
  INSERT INTO public."inventoryProducts" ("productId","stockStatus","itemCondition","quantityOnHand","quantityReserved","minimumStock","createdBy","updatedBy") VALUES(p_product_id,p_stock_status,p_item_condition,p_quantity_on_hand,0,p_minimum_stock,p_admin_id,p_admin_id) RETURNING * INTO v_inventory;
  INSERT INTO public."inventoryLog" ("inventoryProductId","transactionType","quantityOnHandBefore","quantityOnHandChange","quantityOnHandAfter","quantityReservedBefore","quantityReservedChange","quantityReservedAfter",note,"createdBy","updatedBy") VALUES(v_inventory.id,'stockIn',0,p_quantity_on_hand,p_quantity_on_hand,0,0,0,p_note,p_admin_id,p_admin_id) RETURNING * INTO v_log;
  RETURN jsonb_build_object('inventory',to_jsonb(v_inventory),'inventoryLog',to_jsonb(v_log));
END; $function$;


CREATE OR REPLACE FUNCTION public.update_inventory_with_log(p_inventory_id uuid, p_stock_status text, p_item_condition text, p_quantity_on_hand integer, p_minimum_stock integer, p_note text, p_admin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_before public."inventoryProducts"%ROWTYPE;
  v_inventory public."inventoryProducts"%ROWTYPE;
  v_other public."inventoryProducts"%ROWTYPE;
  v_log public."inventoryLog"%ROWTYPE;
  v_type_id bigint;
  v_is_cylinder boolean;
  v_moved integer;
  v_other_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_admin_id AND "isActive" = true) THEN
    RAISE EXCEPTION 'Invalid active admin';
  END IF;
  IF p_stock_status IS NOT NULL AND p_stock_status NOT IN ('full', 'empty', 'damaged') THEN
    RAISE EXCEPTION 'Invalid stock status';
  END IF;
  IF p_item_condition NOT IN ('new', 'old', 'normal') OR p_quantity_on_hand < 0 OR p_minimum_stock < 0 THEN
    RAISE EXCEPTION 'Invalid inventory values';
  END IF;

  v_before := public.lock_inventory_for_cylinder_move(p_inventory_id);

  SELECT "typeId" INTO v_type_id FROM public.products WHERE id = v_before."productId";
  v_is_cylinder := public."isGasCylinderType"(v_type_id);
  IF v_is_cylinder AND p_stock_status IS NULL THEN
    RAISE EXCEPTION 'Gas cylinders require a stock status';
  END IF;
  IF p_quantity_on_hand < v_before."quantityReserved" THEN
    RAISE EXCEPTION 'Quantity cannot be lower than reserved stock';
  END IF;

  UPDATE public."inventoryProducts"
  SET "stockStatus" = p_stock_status,
      "itemCondition" = p_item_condition,
      "quantityOnHand" = p_quantity_on_hand,
      "minimumStock" = p_minimum_stock,
      "updatedAt" = now(),
      "updatedBy" = p_admin_id
  WHERE id = p_inventory_id
  RETURNING * INTO v_inventory;

  IF p_quantity_on_hand <> v_before."quantityOnHand" THEN
    INSERT INTO public."inventoryLog" (
      "inventoryProductId", "transactionType",
      "quantityOnHandBefore", "quantityOnHandChange", "quantityOnHandAfter",
      "quantityReservedBefore", "quantityReservedChange", "quantityReservedAfter",
      note, "createdBy", "updatedBy"
    ) VALUES (
      v_inventory.id, 'adjustment',
      v_before."quantityOnHand", p_quantity_on_hand - v_before."quantityOnHand", p_quantity_on_hand,
      v_before."quantityReserved", 0, v_before."quantityReserved",
      p_note, p_admin_id, p_admin_id
    )
    RETURNING * INTO v_log;
  END IF;

  v_moved := v_before."quantityOnHand" - p_quantity_on_hand;
  IF v_is_cylinder AND v_moved > 0
     AND v_before."stockStatus" IN ('full', 'empty')
     AND p_stock_status = v_before."stockStatus" THEN
    v_other_status := CASE WHEN v_before."stockStatus" = 'full' THEN 'empty' ELSE 'full' END;

    SELECT * INTO v_other
    FROM public."inventoryProducts"
    WHERE "productId" = v_before."productId" AND "stockStatus" = v_other_status
    ORDER BY "createdAt", id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public."inventoryProducts" (
        "productId", "stockStatus", "quantityOnHand", "quantityReserved",
        "minimumStock", "createdBy", "updatedBy"
      ) VALUES (
        v_before."productId", v_other_status, 0, 0, 0, p_admin_id, p_admin_id
      )
      RETURNING * INTO v_other;
    END IF;

    UPDATE public."inventoryProducts"
    SET "quantityOnHand" = v_other."quantityOnHand" + v_moved,
        "updatedAt" = now(),
        "updatedBy" = p_admin_id
    WHERE id = v_other.id;

    INSERT INTO public."inventoryLog" (
      "inventoryProductId", "transactionType",
      "quantityOnHandBefore", "quantityOnHandChange", "quantityOnHandAfter",
      "quantityReservedBefore", "quantityReservedChange", "quantityReservedAfter",
      note, "createdBy", "updatedBy"
    ) VALUES (
      v_other.id, 'adjustment',
      v_other."quantityOnHand", v_moved, v_other."quantityOnHand" + v_moved,
      v_other."quantityReserved", 0, v_other."quantityReserved",
      concat_ws(' - ',
        CASE WHEN v_other_status = 'empty' THEN 'เพิ่มอัตโนมัติจากการลดถังเต็ม' ELSE 'เพิ่มอัตโนมัติจากการลดถังเปล่า (นำไปเติม)' END,
        p_note),
      p_admin_id, p_admin_id
    );
  END IF;

  RETURN jsonb_build_object('inventory', to_jsonb(v_inventory), 'inventoryLog', to_jsonb(v_log));
END;
$function$;


CREATE OR REPLACE FUNCTION public.decrease_cylinder_as_admin(p_inventory_id uuid, p_quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_admin_id uuid;
  v_item public."inventoryProducts"%ROWTYPE;
  v_type_id bigint;
BEGIN
  SELECT id INTO v_admin_id FROM public.employees
  WHERE "authId" = (SELECT auth.uid()) AND "isActive" = true AND "role" IN ('admin', 'superAdmin');
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Admin access required'; END IF;

  v_item := public.lock_inventory_for_cylinder_move(p_inventory_id);

  SELECT "typeId" INTO v_type_id FROM public.products WHERE id = v_item."productId";
  IF NOT public."isGasCylinderType"(v_type_id) OR COALESCE(v_item."stockStatus", '') NOT IN ('full', 'empty') THEN
    RAISE EXCEPTION 'Only full or empty gas cylinders can be decreased';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be a positive integer';
  END IF;
  IF v_item."quantityOnHand" <= 0 THEN
    RAISE EXCEPTION 'No cylinders left';
  END IF;
  IF p_quantity > v_item."quantityOnHand" THEN
    RAISE EXCEPTION 'Not enough cylinders to decrease';
  END IF;

  RETURN public.update_inventory_with_log(
    p_inventory_id, v_item."stockStatus", v_item."itemCondition", v_item."quantityOnHand" - p_quantity,
    v_item."minimumStock",
    CASE WHEN v_item."stockStatus" = 'full' THEN 'ลดถังเต็มด้วยปุ่มในหน้าคลังสินค้า' ELSE 'ลดถังเปล่าด้วยปุ่มในหน้าคลังสินค้า' END,
    v_admin_id
  );
END;
$function$;
