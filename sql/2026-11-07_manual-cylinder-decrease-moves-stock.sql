-- =====================================================================
-- ลดถังแก๊สด้วยมือแล้วย้ายไปอีกฝั่งของสินค้าเดียวกัน
--   ลดถังเต็ม  -> ถังเปล่าเพิ่มเท่าจำนวนที่ลด
--   ลดถังเปล่า -> ถังเต็มเพิ่มเท่าจำนวนที่ลด (นำถังเปล่าไปเติม)
--
-- 1. update_inventory_with_log: ย้ายเฉพาะถังแก๊ส (typeId = 14) ที่สถานะ full/empty
--    ไม่เปลี่ยนทั้งก่อนและหลังแก้ และจำนวนลดลง ถ้าไม่มีแถวปลายทางจะสร้างให้
--    การเพิ่มจำนวน / เปลี่ยนสถานะ / แถวชำรุด / สินค้าอื่น ทำงานเหมือนเดิม
-- 2. decrease_cylinder_as_admin(id, จำนวน): ใช้กับปุ่ม "ลดถังเต็ม" / "ลดถังเปล่า" ในหน้าคลังสินค้า
--    คิดจากจำนวนล่าสุดในแถวที่ล็อกไว้ ไม่ใช่ตัวเลขที่ค้างบนหน้าจอ (ถ้ารันไฟล์นี้ไปแล้วรอบก่อน
--    ให้รันซ้ำได้เลย ไฟล์จะลบฟังก์ชันเวอร์ชันลดทีละ 1 ถังให้เอง)
--
-- ต้องรันก่อน deploy โค้ดที่มีปุ่มลดถัง ไม่งั้นกดปุ่มแล้วจะ error
-- วิธีย้อนกลับ: ลบบล็อก IF ของการย้ายถังแล้วรัน CREATE OR REPLACE นี้อีกครั้ง
-- และ DROP FUNCTION public.decrease_cylinder_as_admin(uuid, integer), public.lock_inventory_for_cylinder_move(uuid);
-- =====================================================================

-- ชื่อเดิมจากไฟล์ร่างก่อนหน้า ถ้าเคยรันไปแล้วให้ลบทิ้ง
DROP FUNCTION IF EXISTS public.decrease_full_cylinder_as_admin(uuid);

-- ล็อกแถวที่จะแก้ โดยถ้าเป็นถังเปล่าจะล็อกถังเต็มแถวแรกของสินค้านั้นก่อน
-- ให้ลำดับการล็อกเป็น "ถังเต็ม -> ถังเปล่า" เหมือน fulfill_order_and_deduct_inventory กัน deadlock
CREATE OR REPLACE FUNCTION public.lock_inventory_for_cylinder_move(p_inventory_id uuid)
 RETURNS public."inventoryProducts"
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hint public."inventoryProducts"%ROWTYPE;
  v_row public."inventoryProducts"%ROWTYPE;
BEGIN
  SELECT * INTO v_hint FROM public."inventoryProducts" WHERE id = p_inventory_id;
  IF FOUND AND v_hint."stockStatus" = 'empty' THEN
    PERFORM 1 FROM public."inventoryProducts"
    WHERE "productId" = v_hint."productId" AND "stockStatus" = 'full'
    ORDER BY "createdAt", id
    LIMIT 1
    FOR UPDATE;
  END IF;

  SELECT * INTO v_row FROM public."inventoryProducts" WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_inventory_for_cylinder_move(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_inventory_for_cylinder_move(uuid) TO service_role;

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
  IF v_type_id = 14 AND p_stock_status IS NULL THEN
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
  IF v_type_id = 14 AND v_moved > 0
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

-- เวอร์ชันเก่าลดได้ทีละ 1 ถัง (พารามิเตอร์เดียว) ต้องลบก่อน ไม่งั้นจะมีสองฟังก์ชันชื่อซ้ำกัน
DROP FUNCTION IF EXISTS public.decrease_cylinder_as_admin(uuid);

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
  IF v_type_id IS DISTINCT FROM 14 OR COALESCE(v_item."stockStatus", '') NOT IN ('full', 'empty') THEN
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

REVOKE ALL ON FUNCTION public.decrease_cylinder_as_admin(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decrease_cylinder_as_admin(uuid, integer) TO authenticated, service_role;
