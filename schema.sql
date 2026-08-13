-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lineUserId text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  avatarUrl text,
  isActive boolean NOT NULL DEFAULT true,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  updatedAt timestamp with time zone NOT NULL DEFAULT now(),
  authId uuid UNIQUE,
  lineDisplayName text,
  contactName text,
  shopName text,
  customerType text NOT NULL DEFAULT 'individual'::text CHECK ("customerType" = ANY (ARRAY['individual'::text, 'shop'::text])),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_authId_fkey FOREIGN KEY (authId) REFERENCES auth.users(id)
);
CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role USER-DEFINED NOT NULL DEFAULT 'employee'::"employeeRole",
  avatarUrl text,
  isActive boolean NOT NULL DEFAULT true,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  updatedAt timestamp with time zone NOT NULL DEFAULT now(),
  authId uuid,
  address text,
  tel text,
  thaiId text UNIQUE,
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_authId_fkey FOREIGN KEY (authId) REFERENCES auth.users(id)
);
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  postedBy uuid NOT NULL,
  title text NOT NULL,
  content text,
  imageUrl text,
  type USER-DEFINED NOT NULL DEFAULT 'announcement'::"announcementType",
  isPublished boolean NOT NULL DEFAULT false,
  publishedAt timestamp with time zone,
  expiresAt timestamp with time zone,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_postedBy_fkey FOREIGN KEY (postedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.workAttendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employeeId uuid NOT NULL,
  checkInTime timestamp with time zone NOT NULL DEFAULT now(),
  checkOutTime timestamp with time zone,
  workDate date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workAttendance_pkey PRIMARY KEY (id),
  CONSTRAINT workAttendance_employeeId_fkey FOREIGN KEY (employeeId) REFERENCES public.employees(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  userId uuid NOT NULL,
  totalAmount numeric NOT NULL DEFAULT 0,
  paymentMethod USER-DEFINED,
  paymentStatus USER-DEFINED NOT NULL DEFAULT 'pending'::"paymentStatus",
  status USER-DEFINED NOT NULL DEFAULT 'pending'::"orderStatus",
  deliveryAddress text,
  deliveryLat numeric,
  deliveryLng numeric,
  note text,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  updatedAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);
CREATE TABLE public.orderItems (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  orderId uuid NOT NULL,
  productNameSnapshot text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unitPrice numeric NOT NULL CHECK ("unitPrice" >= 0::numeric),
  productId bigint NOT NULL,
  saleType text NOT NULL CHECK ("saleType" = ANY (ARRAY['sell'::text, 'exchange'::text, 'refill'::text, 'return'::text])),
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  updatedAt timestamp with time zone NOT NULL DEFAULT now(),
  createdBy uuid,
  updatedBy uuid,
  totalPrice numeric DEFAULT ((quantity)::numeric * "unitPrice"),
  CONSTRAINT orderItems_pkey PRIMARY KEY (id),
  CONSTRAINT orderItems_orderId_fkey FOREIGN KEY (orderId) REFERENCES public.orders(id),
  CONSTRAINT orderItems_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id),
  CONSTRAINT orderItems_createdBy_fkey FOREIGN KEY (createdBy) REFERENCES public.employees(id),
  CONSTRAINT orderItems_updatedBy_fkey FOREIGN KEY (updatedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  orderId uuid NOT NULL,
  amount numeric NOT NULL,
  method USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::"paymentStatus",
  verifiedBy uuid,
  verifiedAt timestamp with time zone,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_orderId_fkey FOREIGN KEY (orderId) REFERENCES public.orders(id),
  CONSTRAINT payments_verifiedBy_fkey FOREIGN KEY (verifiedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.transferSlips (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paymentId uuid NOT NULL,
  userId uuid NOT NULL,
  slipImageUrl text NOT NULL,
  verifiedBy uuid,
  verifiedAt timestamp with time zone,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::"slipStatus",
  rejectReason text,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transferSlips_pkey PRIMARY KEY (id),
  CONSTRAINT transferSlips_paymentId_fkey FOREIGN KEY (paymentId) REFERENCES public.payments(id),
  CONSTRAINT transferSlips_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id),
  CONSTRAINT transferSlips_verifiedBy_fkey FOREIGN KEY (verifiedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.debtRecords (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  userId uuid NOT NULL,
  orderId uuid,
  recordedBy uuid,
  debtType USER-DEFINED NOT NULL,
  amount numeric NOT NULL,
  productId bigint,
  note text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::"debtStatus",
  dueDate date,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  updatedAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT debtRecords_pkey PRIMARY KEY (id),
  CONSTRAINT debtRecords_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id),
  CONSTRAINT debtRecords_orderId_fkey FOREIGN KEY (orderId) REFERENCES public.orders(id),
  CONSTRAINT debtRecords_recordedBy_fkey FOREIGN KEY (recordedBy) REFERENCES public.employees(id),
  CONSTRAINT debtRecords_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id),
  CONSTRAINT debtRecords_amount_positive CHECK (amount > 0::numeric),
  CONSTRAINT debtRecords_product_required_for_cart CHECK (((debtType = 'money'::"debtType") AND (productId IS NULL)) OR ((debtType = 'cart'::"debtType") AND (productId IS NOT NULL)))
);
CREATE INDEX debtRecords_userId_debtType_status_idx ON public.debtRecords USING btree (userId, debtType, status);

CREATE TABLE public.debtTransactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  debtRecordId uuid NOT NULL,
  transactionType text NOT NULL CHECK (transactionType = ANY (ARRAY['payment'::text, 'return'::text])),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  recordedBy uuid,
  note text,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT debtTransactions_pkey PRIMARY KEY (id),
  CONSTRAINT debtTransactions_debtRecordId_fkey FOREIGN KEY (debtRecordId) REFERENCES public.debtRecords(id),
  CONSTRAINT debtTransactions_recordedBy_fkey FOREIGN KEY (recordedBy) REFERENCES public.employees(id)
);
CREATE INDEX debtTransactions_debtRecordId_createdAt_idx ON public.debtTransactions USING btree (debtRecordId, createdAt);
CREATE TABLE public.deliveryTracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  orderId uuid NOT NULL UNIQUE,
  driverId uuid,
  currentLat numeric,
  currentLng numeric,
  destLat numeric,
  destLng numeric,
  estimatedMinutes integer,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::"deliveryStatus",
  lastKnownLat numeric,
  lastKnownLng numeric,
  lastKnownAt timestamp with time zone,
  signalLostAt timestamp with time zone,
  lastSyncedAt timestamp with time zone,
  updatedAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deliveryTracking_pkey PRIMARY KEY (id),
  CONSTRAINT deliveryTracking_orderId_fkey FOREIGN KEY (orderId) REFERENCES public.orders(id),
  CONSTRAINT deliveryTracking_driverId_fkey FOREIGN KEY (driverId) REFERENCES public.employees(id)
);
CREATE TABLE public.deliveryCheckpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  orderId uuid NOT NULL,
  checkpointName text NOT NULL,
  lat numeric,
  lng numeric,
  isSynced boolean NOT NULL DEFAULT false,
  scannedAt timestamp with time zone NOT NULL DEFAULT now(),
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deliveryCheckpoints_pkey PRIMARY KEY (id),
  CONSTRAINT deliveryCheckpoints_orderId_fkey FOREIGN KEY (orderId) REFERENCES public.orders(id)
);
CREATE TABLE public.chatLogs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  userId uuid NOT NULL,
  message text NOT NULL,
  senderType USER-DEFINED NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chatLogs_pkey PRIMARY KEY (id),
  CONSTRAINT chatLogs_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id)
);
CREATE TABLE public.productsBrand (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  createdBy uuid NOT NULL,
  updatedAt timestamp with time zone,
  updatedBy uuid,
  CONSTRAINT productsBrand_pkey PRIMARY KEY (id),
  CONSTRAINT FK_productsBrand_createdBy FOREIGN KEY (createdBy) REFERENCES public.employees(id),
  CONSTRAINT FK_productsBrand_updatedBy FOREIGN KEY (updatedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.productsType (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  createdBy uuid NOT NULL,
  updatedAt timestamp with time zone,
  updatedBy uuid,
  CONSTRAINT productsType_pkey PRIMARY KEY (id),
  CONSTRAINT FK_productsType_createdBy FOREIGN KEY (createdBy) REFERENCES public.employees(id),
  CONSTRAINT FK_productsType_updatedBy FOREIGN KEY (updatedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.productsUnit (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  unit text NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  createdBy uuid NOT NULL,
  updatedAt timestamp with time zone,
  updatedBy uuid,
  CONSTRAINT productsUnit_pkey PRIMARY KEY (id),
  CONSTRAINT FK_productsUnit_createdBy FOREIGN KEY (createdBy) REFERENCES public.employees(id),
  CONSTRAINT FK_productsUnit_updatedBy FOREIGN KEY (updatedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  brandId bigint NOT NULL,
  size numeric,
  typeId bigint NOT NULL,
  sellPrice numeric NOT NULL DEFAULT '0'::numeric,
  unitId bigint NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  createdBy uuid NOT NULL,
  updatedAt timestamp with time zone,
  updatedBy uuid,
  exchangePrice numeric DEFAULT '0'::numeric,
  refillPrice numeric DEFAULT '0'::numeric,
  imageUrl text,
  isActive boolean NOT NULL,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT FK_products_brand FOREIGN KEY (brandId) REFERENCES public.productsBrand(id),
  CONSTRAINT FK_products_type FOREIGN KEY (typeId) REFERENCES public.productsType(id),
  CONSTRAINT FK_products_unit FOREIGN KEY (unitId) REFERENCES public.productsUnit(id),
  CONSTRAINT FK_products_createdBy FOREIGN KEY (createdBy) REFERENCES public.employees(id),
  CONSTRAINT FK_products_updatedBy FOREIGN KEY (updatedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.inventoryProducts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  productId bigint NOT NULL,
  stockStatus text CHECK ("stockStatus" = ANY (ARRAY['full'::text, 'empty'::text, 'damaged'::text])),
  itemCondition text NOT NULL DEFAULT 'normal'::text CHECK ("itemCondition" = ANY (ARRAY['new'::text, 'old'::text, 'normal'::text])),
  quantityOnHand integer NOT NULL DEFAULT 0 CHECK ("quantityOnHand" >= 0),
  quantityReserved integer NOT NULL DEFAULT 0 CHECK ("quantityReserved" >= 0),
  quantityAvailable integer DEFAULT ("quantityOnHand" - "quantityReserved"),
  minimumStock integer NOT NULL DEFAULT 0 CHECK ("minimumStock" >= 0),
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  updatedAt timestamp with time zone NOT NULL DEFAULT now(),
  createdBy uuid,
  updatedBy uuid,
  CONSTRAINT inventoryProducts_pkey PRIMARY KEY (id),
  CONSTRAINT inventoryProducts_productId_fkey FOREIGN KEY (productId) REFERENCES public.products(id),
  CONSTRAINT inventoryProducts_createdBy_fkey FOREIGN KEY (createdBy) REFERENCES public.employees(id),
  CONSTRAINT inventoryProducts_updatedBy_fkey FOREIGN KEY (updatedBy) REFERENCES public.employees(id)
);
CREATE TABLE public.inventoryLog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inventoryProductId uuid NOT NULL,
  orderId uuid,
  orderItemId uuid,
  transactionType text NOT NULL CHECK ("transactionType" = ANY (ARRAY['stockIn'::text, 'reserve'::text, 'release'::text, 'saleOut'::text, 'exchangeOut'::text, 'emptyReturn'::text, 'adjustment'::text, 'damage'::text, 'restore'::text])),
  quantityOnHandBefore integer NOT NULL,
  quantityOnHandChange integer NOT NULL DEFAULT 0,
  quantityOnHandAfter integer NOT NULL,
  quantityReservedBefore integer NOT NULL,
  quantityReservedChange integer NOT NULL DEFAULT 0,
  quantityReservedAfter integer NOT NULL,
  note text,
  createdAt timestamp with time zone NOT NULL DEFAULT now(),
  updatedAt timestamp with time zone NOT NULL DEFAULT now(),
  createdBy uuid,
  updatedBy uuid,
  CONSTRAINT inventoryLog_pkey PRIMARY KEY (id),
  CONSTRAINT inventoryLog_orderId_fkey FOREIGN KEY (orderId) REFERENCES public.orders(id),
  CONSTRAINT inventoryLog_orderItemId_fkey FOREIGN KEY (orderItemId) REFERENCES public.orderItems(id),
  CONSTRAINT inventoryLog_inventoryProductId_fkey FOREIGN KEY (inventoryProductId) REFERENCES public.inventoryProducts(id),
  CONSTRAINT inventoryLog_createdBy_fkey FOREIGN KEY (createdBy) REFERENCES public.employees(id),
  CONSTRAINT inventoryLog_updatedBy_fkey FOREIGN KEY (updatedBy) REFERENCES public.employees(id)
);

-- Inserts an inventory record and its initial stock-in log atomically.
-- Call this only from a trusted server using the Supabase service-role client.
CREATE OR REPLACE FUNCTION public.create_inventory_with_log(
  p_product_id bigint,
  p_stock_status text,
  p_quantity_on_hand integer,
  p_minimum_stock integer,
  p_note text,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inventory public."inventoryProducts"%ROWTYPE;
  v_log public."inventoryLog"%ROWTYPE;
BEGIN
  IF p_product_id <= 0 OR p_quantity_on_hand < 0 OR p_minimum_stock < 0 THEN
    RAISE EXCEPTION 'Invalid inventory quantities';
  END IF;

  IF p_stock_status NOT IN ('full', 'empty', 'damaged') THEN
    RAISE EXCEPTION 'Invalid stock status';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_admin_id AND "isActive" = true
  ) THEN
    RAISE EXCEPTION 'Invalid active admin';
  END IF;

  INSERT INTO public."inventoryProducts" (
    "productId", "stockStatus", "quantityOnHand", "quantityReserved",
    "minimumStock", "createdBy", "updatedBy"
  ) VALUES (
    p_product_id, p_stock_status, p_quantity_on_hand, 0,
    p_minimum_stock, p_admin_id, p_admin_id
  )
  RETURNING * INTO v_inventory;

  INSERT INTO public."inventoryLog" (
    "inventoryProductId", "transactionType", "quantityOnHandBefore",
    "quantityOnHandChange", "quantityOnHandAfter", "quantityReservedBefore",
    "quantityReservedChange", "quantityReservedAfter", note, "createdBy", "updatedBy"
  ) VALUES (
    v_inventory.id, 'stockIn', 0, p_quantity_on_hand, p_quantity_on_hand,
    0, 0, 0, p_note, p_admin_id, p_admin_id
  )
  RETURNING * INTO v_log;

  RETURN jsonb_build_object(
    'inventory', to_jsonb(v_inventory),
    'inventoryLog', to_jsonb(v_log)
  );
END;
$$;

-- Delivers an order and records all stock deductions atomically. A failure for
-- any item (including insufficient stock) rolls back the order and all logs.
CREATE OR REPLACE FUNCTION public.fulfill_order_and_deduct_inventory(
  p_order_id uuid,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
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
    SELECT * FROM public."orderItems" WHERE "orderId" = p_order_id
  LOOP
    -- All current sale types represent a full cylinder leaving the shop.
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
$$;

-- Verifies one QR transfer slip and updates the slip, payment, and order in a
-- single transaction. This function is only callable by the server service role.
CREATE OR REPLACE FUNCTION public.verify_qr_payment(
  p_payment_id uuid,
  p_slip_id uuid,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_slip public."transferSlips"%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_admin_id AND "isActive" = true) THEN
    RAISE EXCEPTION 'Invalid active admin';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.method <> 'qrScan' THEN RAISE EXCEPTION 'Only QR payments can be verified with a slip'; END IF;
  IF v_payment.status = 'paid' THEN RAISE EXCEPTION 'Payment has already been verified'; END IF;

  SELECT * INTO v_slip FROM public."transferSlips"
  WHERE id = p_slip_id AND "paymentId" = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slip does not belong to this payment'; END IF;
  IF v_slip.status <> 'pending' THEN RAISE EXCEPTION 'Only a pending slip can be verified'; END IF;

  UPDATE public."transferSlips"
  SET status = 'verified', "verifiedBy" = p_admin_id, "verifiedAt" = now()
  WHERE id = p_slip_id
  RETURNING * INTO v_slip;

  UPDATE public."transferSlips"
  SET status = 'rejected', "verifiedBy" = p_admin_id, "verifiedAt" = now(),
      "rejectReason" = 'Another slip was verified for this payment'
  WHERE "paymentId" = p_payment_id AND id <> p_slip_id AND status = 'pending';

  UPDATE public.payments
  SET status = 'paid', "verifiedBy" = p_admin_id, "verifiedAt" = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  UPDATE public.orders
  SET "paymentStatus" = 'paid', "updatedAt" = now()
  WHERE id = v_payment."orderId"
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'slip', to_jsonb(v_slip), 'order', to_jsonb(v_order));
END;
$$;

REVOKE ALL ON FUNCTION public.verify_qr_payment(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_qr_payment(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reject_qr_payment_slip(
  p_payment_id uuid,
  p_slip_id uuid,
  p_reason text,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_slip public."transferSlips"%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_admin_id AND "isActive" = true) THEN RAISE EXCEPTION 'Invalid active admin'; END IF;
  IF length(trim(p_reason)) = 0 THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
  SELECT * INTO v_slip FROM public."transferSlips" WHERE id = p_slip_id AND "paymentId" = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slip does not belong to this payment'; END IF;
  IF v_slip.status <> 'pending' THEN RAISE EXCEPTION 'Only a pending slip can be rejected'; END IF;
  UPDATE public."transferSlips" SET status = 'rejected', "rejectReason" = trim(p_reason), "verifiedBy" = p_admin_id, "verifiedAt" = now()
  WHERE id = p_slip_id RETURNING * INTO v_slip;
  RETURN jsonb_build_object('slip', to_jsonb(v_slip));
END;
$$;

CREATE OR REPLACE FUNCTION public.record_partial_qr_payment(
  p_payment_id uuid,
  p_slip_id uuid,
  p_paid_amount numeric,
  p_note text,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_slip public."transferSlips"%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_debt public."debtRecords"%ROWTYPE;
  v_remaining numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_admin_id AND "isActive" = true) THEN RAISE EXCEPTION 'Invalid active admin'; END IF;
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_payment.method <> 'qrScan' OR v_payment.status = 'paid' THEN RAISE EXCEPTION 'Pending QR payment not found'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_payment."orderId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF EXISTS (SELECT 1 FROM public."debtRecords" WHERE "orderId" = v_order.id AND "debtType" = 'money' AND status <> 'paid') THEN RAISE EXCEPTION 'This order already has an unpaid money debt'; END IF;
  IF p_paid_amount <= 0 OR p_paid_amount >= v_order."totalAmount" THEN RAISE EXCEPTION 'Partial amount must be greater than zero and less than the order total'; END IF;
  SELECT * INTO v_slip FROM public."transferSlips" WHERE id = p_slip_id AND "paymentId" = p_payment_id FOR UPDATE;
  IF NOT FOUND OR v_slip.status <> 'pending' THEN RAISE EXCEPTION 'Pending slip not found for this payment'; END IF;
  v_remaining := v_order."totalAmount" - p_paid_amount;
  UPDATE public."transferSlips" SET status = 'verified', "verifiedBy" = p_admin_id, "verifiedAt" = now() WHERE id = p_slip_id RETURNING * INTO v_slip;
  UPDATE public."transferSlips" SET status = 'rejected', "verifiedBy" = p_admin_id, "verifiedAt" = now(), "rejectReason" = 'Another slip was used for a partial payment'
  WHERE "paymentId" = p_payment_id AND id <> p_slip_id AND status = 'pending';
  UPDATE public.payments SET amount = p_paid_amount, status = 'paid', "verifiedBy" = p_admin_id, "verifiedAt" = now()
  WHERE id = p_payment_id RETURNING * INTO v_payment;
  INSERT INTO public."debtRecords" ("userId", "orderId", "recordedBy", "debtType", amount, note, status)
  VALUES (v_order."userId", v_order.id, p_admin_id, 'money', v_remaining, nullif(trim(coalesce(p_note, '')), ''), 'pending')
  RETURNING * INTO v_debt;
  UPDATE public.orders SET "paymentMethod" = 'pendingPayment', "paymentStatus" = 'pending', "updatedAt" = now()
  WHERE id = v_order.id RETURNING * INTO v_order;
  RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'slip', to_jsonb(v_slip), 'debt', to_jsonb(v_debt), 'order', to_jsonb(v_order));
END;
$$;

REVOKE ALL ON FUNCTION public.reject_qr_payment_slip(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_partial_qr_payment(uuid, uuid, numeric, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_qr_payment_slip(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_partial_qr_payment(uuid, uuid, numeric, text, uuid) TO service_role;

-- Remove only inventory that was never used by an order; sales history remains immutable.
CREATE OR REPLACE FUNCTION public.delete_inventory_with_logs(p_inventory_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_inventory public."inventoryProducts"%ROWTYPE;
BEGIN
  SELECT * INTO v_inventory FROM public."inventoryProducts" WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF EXISTS (SELECT 1 FROM public."inventoryLog" WHERE "inventoryProductId" = p_inventory_id AND ("orderId" IS NOT NULL OR "orderItemId" IS NOT NULL)) THEN
    RAISE EXCEPTION 'Inventory used by an order cannot be deleted';
  END IF;
  DELETE FROM public."inventoryLog" WHERE "inventoryProductId" = p_inventory_id;
  DELETE FROM public."inventoryProducts" WHERE id = p_inventory_id;
  RETURN jsonb_build_object('id', p_inventory_id);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_inventory_with_logs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_inventory_with_logs(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.update_inventory_with_log(
  p_inventory_id uuid, p_stock_status text, p_quantity_on_hand integer,
  p_minimum_stock integer, p_note text, p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_before public."inventoryProducts"%ROWTYPE; v_inventory public."inventoryProducts"%ROWTYPE; v_log public."inventoryLog"%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_admin_id AND "isActive" = true) THEN RAISE EXCEPTION 'Invalid active admin'; END IF;
  IF p_stock_status NOT IN ('full', 'empty', 'damaged') OR p_quantity_on_hand < 0 OR p_minimum_stock < 0 THEN RAISE EXCEPTION 'Invalid inventory values'; END IF;
  SELECT * INTO v_before FROM public."inventoryProducts" WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF p_quantity_on_hand < v_before."quantityReserved" THEN RAISE EXCEPTION 'Quantity cannot be lower than reserved stock'; END IF;
  UPDATE public."inventoryProducts" SET "stockStatus" = p_stock_status, "quantityOnHand" = p_quantity_on_hand, "minimumStock" = p_minimum_stock, "updatedAt" = now(), "updatedBy" = p_admin_id
  WHERE id = p_inventory_id RETURNING * INTO v_inventory;
  IF p_quantity_on_hand <> v_before."quantityOnHand" THEN
    INSERT INTO public."inventoryLog" ("inventoryProductId", "transactionType", "quantityOnHandBefore", "quantityOnHandChange", "quantityOnHandAfter", "quantityReservedBefore", "quantityReservedChange", "quantityReservedAfter", note, "createdBy", "updatedBy")
    VALUES (v_inventory.id, 'adjustment', v_before."quantityOnHand", p_quantity_on_hand - v_before."quantityOnHand", p_quantity_on_hand, v_before."quantityReserved", 0, v_before."quantityReserved", p_note, p_admin_id, p_admin_id)
    RETURNING * INTO v_log;
  END IF;
  RETURN jsonb_build_object('inventory', to_jsonb(v_inventory), 'inventoryLog', to_jsonb(v_log));
END;
$$;
REVOKE ALL ON FUNCTION public.update_inventory_with_log(uuid, text, integer, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_inventory_with_log(uuid, text, integer, integer, text, uuid) TO service_role;
