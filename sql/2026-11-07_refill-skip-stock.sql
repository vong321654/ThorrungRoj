-- =====================================================================
-- ฝากเติม (refill): ไม่ตัดสต๊อกตอนส่งสำเร็จ
--
-- ต้องรันก่อน deploy โค้ดที่เปิดตัวเลือกฝากเติม ไม่งั้นตอนกดส่งสำเร็จ
-- ระบบจะตัดถังเต็มของร้าน หรือส่งไม่สำเร็จถ้าสินค้านั้นไม่มีถังเต็มในคลัง
--
-- เปลี่ยนจากเดิมแค่บรรทัด CONTINUE WHEN เท่านั้น รายการซื้อถัง/เปลี่ยนถังทำงานเหมือนเดิม
-- วิธีย้อนกลับ: ลบบรรทัด CONTINUE WHEN แล้วรัน CREATE OR REPLACE นี้อีกครั้ง
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fulfill_order_and_deduct_inventory(p_order_id uuid, p_admin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item public."orderItems"%ROWTYPE;
  v_inventory public."inventoryProducts"%ROWTYPE;
  v_log public."inventoryLog"%ROWTYPE;
  v_available_before integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_admin_id AND "isActive" = true
  ) THEN
    RAISE EXCEPTION 'Invalid active admin';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'delivered' THEN
    RAISE EXCEPTION 'Order has already been delivered';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled order cannot be delivered';
  END IF;

  FOR v_item IN
    SELECT * FROM public."orderItems" WHERE "orderId" = p_order_id ORDER BY "productId", id
  LOOP
    -- Refills fill the customer's own cylinder, so no shop stock moves.
    CONTINUE WHEN v_item."saleType" = 'refill';

    SELECT * INTO v_inventory
    FROM public."inventoryProducts"
    WHERE "productId" = v_item."productId" AND "stockStatus" = 'full'
    ORDER BY "createdAt", id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No full inventory record for product %', v_item."productId";
    END IF;

    v_available_before := v_inventory."quantityOnHand" - v_inventory."quantityReserved";
    IF v_available_before < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item."productId";
    END IF;

    UPDATE public."inventoryProducts"
    SET
      "quantityOnHand" = v_inventory."quantityOnHand" - v_item.quantity,
      "updatedAt" = now(),
      "updatedBy" = p_admin_id
    WHERE id = v_inventory.id
    RETURNING * INTO v_inventory;

    INSERT INTO public."inventoryLog" (
      "inventoryProductId", "orderId", "orderItemId", "transactionType",
      "quantityOnHandBefore", "quantityOnHandChange", "quantityOnHandAfter",
      "quantityReservedBefore", "quantityReservedChange", "quantityReservedAfter",
      "createdAt", "updatedAt", "createdBy", "updatedBy"
    ) VALUES (
      v_inventory.id, p_order_id, v_item.id, 'saleOut',
      v_inventory."quantityOnHand" + v_item.quantity, -v_item.quantity, v_inventory."quantityOnHand",
      v_inventory."quantityReserved", 0, v_inventory."quantityReserved",
      now(), now(), p_admin_id, p_admin_id
    )
    RETURNING * INTO v_log;

    IF v_item."saleType" = 'exchange' THEN
      -- The full-stock row remains locked while the returned empties are recorded.
      SELECT * INTO v_inventory
      FROM public."inventoryProducts"
      WHERE "productId" = v_item."productId" AND "stockStatus" = 'empty'
      ORDER BY "createdAt", id
      LIMIT 1
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public."inventoryProducts" (
          "productId", "stockStatus", "quantityOnHand", "quantityReserved",
          "minimumStock", "createdBy", "updatedBy"
        ) VALUES (
          v_item."productId", 'empty', 0, 0, 0, p_admin_id, p_admin_id
        )
        RETURNING * INTO v_inventory;
      END IF;

      UPDATE public."inventoryProducts"
      SET "quantityOnHand" = v_inventory."quantityOnHand" + v_item.quantity,
          "updatedAt" = now(), "updatedBy" = p_admin_id
      WHERE id = v_inventory.id
      RETURNING * INTO v_inventory;

      INSERT INTO public."inventoryLog" (
        "inventoryProductId", "orderId", "orderItemId", "transactionType",
        "quantityOnHandBefore", "quantityOnHandChange", "quantityOnHandAfter",
        "quantityReservedBefore", "quantityReservedChange", "quantityReservedAfter",
        "createdAt", "updatedAt", "createdBy", "updatedBy"
      ) VALUES (
        v_inventory.id, p_order_id, v_item.id, 'emptyReturn',
        v_inventory."quantityOnHand" - v_item.quantity, v_item.quantity, v_inventory."quantityOnHand",
        v_inventory."quantityReserved", 0, v_inventory."quantityReserved",
        now(), now(), p_admin_id, p_admin_id
      );
    END IF;
  END LOOP;

  UPDATE public.orders
  SET status = 'delivered', "updatedAt" = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'order', to_jsonb(v_order),
    'status', 'delivered'
  );
END;
$function$;
