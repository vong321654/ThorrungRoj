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
  stockStatus text NOT NULL CHECK ("stockStatus" = ANY (ARRAY['full'::text, 'empty'::text, 'damaged'::text])),
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
