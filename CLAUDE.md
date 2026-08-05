@AGENTS.md
---
name: thor-rungroj-gas-shop
description: Knowledge base and conventions for the Thor Rungroj gas shop LINE LIFF project (ก๊าซทอรุ่งโรจน์) — a Next.js + Supabase web app embedded in LINE Rich Menu. Contains the exact database schema, auth architecture (LIFF for customers, NextAuth for staff), feature scope, naming conventions, and architectural decisions already agreed on. Use this skill whenever the user asks about this project, mentions LINE LIFF with Supabase, references tables like users, employees, orders, deliveryTracking, transferSlips, debtRecords, workAttendance, debtType = cart/money, or asks anything about a gas shop / แก๊ส / ถังแก๊ส management system — even if they don't explicitly name the project. Also trigger when the user asks in Thai about a system with admin/employee/customer roles, delivery tracking, or a LINE-based storefront. Claude should consult this skill before proposing any schema changes, code patterns, or architectural advice for this project.
---

# Thor Rungroj Gas Shop — Project Knowledge Base

This skill contains the complete context for a LINE LIFF-based gas shop (แก๊ส / ถังแก๊ส) management system already in active development. Every decision below has been discussed and agreed with the user — do not re-propose alternatives unless the user explicitly asks.

Respond in Thai by default. The user is a solo developer, Thai-speaking, and prefers concise concrete answers with working code.

## Project identity

- **Thai name:** ก๊าซทอรุ่งโรจน์ (Gas Thor Rungroj)
- **Supabase project names:** `ThorRungroj` and `GasthorRungroj`
- **Type:** LINE LIFF web app (embedded WebView inside LINE chat, NOT a native app, NOT a standalone browser site)
- **Delivery:** Accessed via LINE Rich Menu → opens LIFF page

## Tech stack (locked in)

- **Frontend & backend:** Next.js (App Router)
- **Database:** Supabase (PostgreSQL)
- **Customer auth:** LINE LIFF SDK (`@line/liff`) — identified via `lineUserId`
- **Staff auth:** NextAuth with email + bcrypt-hashed password
- **Storage:** Supabase Storage (3 buckets: `transfer-slips` private, `announcement-images` public, `avatars` public)
- **Map / GPS:** browser Geolocation API (no native background tracking available — see Offline Delivery section)

Do not propose alternatives (Firebase, Prisma+MySQL, separate backend, etc.) unless user explicitly asks.

## Role model — two separate tables

This is critical and was discussed explicitly. Do NOT merge them.

| Table | Auth system | Who | Identifier |
|---|---|---|---|
| `users` | LINE LIFF | Customers only | `lineUserId` |
| `employees` | NextAuth | admin + employee | `email` + `hashedPassword` |

Rationale: customers enter via LINE (no password, no email login); staff enter via normal email/password login to an admin dashboard. They come from completely different auth flows, so merging them forces nullable auth fields everywhere.

`employees.role` enum = `admin | employee` only. There is no "customer" role in `employees`.

## Database schema

The full SQL is in `references/supabase_schema.sql` — read it whenever the user asks about tables, columns, or wants to modify the schema. The DBML version for dbdiagram.io is in `references/schema.dbml`.

**Tables (12 total):**
1. `users` — customers from LINE
2. `employees` — admin + staff with NextAuth
3. `announcements` — admin posts (promotions + general notices, including price updates)
4. `workAttendance` — employee clock in/out
5. `orders` — customer orders (with `deliveryLat/Lng` for map pinning)
6. `orderItems` — line items (no `products` table — product names are free-text)
7. `payments` — payment records linked to orders
8. `transferSlips` — QR payment slip images, admin verifies
9. `debtRecords` — ค้างถัง/ค้างเงิน tracking with `debtType = cart | money`, supports partial payment via `paidAmount`
10. `deliveryTracking` — one-per-order, with offline fallback columns (`lastKnownLat/Lng/At`, `signalLostAt`, `lastSyncedAt`)
11. `deliveryCheckpoints` — optional QR-based checkpoints for offline delivery
12. `chatLogs` — chatbot conversation history

## Coding conventions (strict)

- **camelCase** for all identifiers: `lineUserId`, `totalAmount`, `deliveryTracking`, `createdAt`
- **No snake_case**, no `_` separators, no hyphens in names
- **Double quotes** required around every identifier in SQL (Postgres folds unquoted identifiers to lowercase, which breaks camelCase)
- **UUID primary keys** via `gen_random_uuid()`
- **`timestamptz`** for all timestamps (not `timestamp`)
- **`numeric(10,2)`** for money, **`numeric(10,7)`** for lat/lng
- All tables have `createdAt`; mutable tables also have `updatedAt` with auto-update trigger

## Feature scope (from the original requirements)

### Admin (role = 'admin')
1. CRUD all user data + verify payment slips
2. Post announcements (promotions or notices) — **prices are announced here, not stored in a products table**
3. Record debts: ค้างถัง (cart) or ค้างเงิน (money)
4. Manage employee work attendance

### Employee (role = 'employee')
- Delivery tracking: view customer address on map, update delivery status
- Clock in/out via `workAttendance`

### Customer (users table)
1. View admin's announcements and promotions
2. Chatbot for **troubleshooting only** — NOT for asking prices (see Chatbot scope)
3. Edit own profile
4. Check delivery ETA (กี่นาทีถึง)

### Payment flow (important detail)
When customer taps pay, the chat sends a summary (amount + items), then 4 choices:

| Choice (Thai) | `paymentMethod` enum | What to do |
|---|---|---|
| สแกนจ่าย | `qrScan` | Create `payments`, customer uploads slip → `transferSlips` pending admin verify |
| จ่ายสด | `cash` | Create `payments` status `paid` immediately |
| ค้างชำระ | `pendingPayment` | Create `debtRecords` with `debtType = money` |
| ค้างถัง | `pendingCart` | Create `debtRecords` with `debtType = cart` |

## Chatbot scope (explicitly narrowed)

The chatbot handles **troubleshooting only**. Examples of in-scope questions:
- "หัวปรับรั่วทำยังไง" → return text steps + image + option to contact technician
- "ไฟแช็กไม่ติด" → basic steps + image

**Out of scope** (user decided against these):
- Asking prices (prices come via `announcements`, not via bot)
- No `products` table needed

**Implementation choice:** Hardcode the FAQ dictionary in code (TypeScript object) for now. The user chose this over a DB table because:
- FAQs rarely change
- Content is small (< 20 entries expected)
- Images are static files in the Next.js public folder

Only suggest creating an `faqs` table if the user later asks to make FAQs editable from the admin panel.

## Auth & session architecture

Three route groups, two auth systems working in one Next.js app:

| Route prefix | Auth | Role check |
|---|---|---|
| `/liff/*` | LIFF SDK in-component | `liff.isLoggedIn()` — no middleware |
| `/employee/*` | NextAuth via middleware | `session.role IN ('admin', 'employee')` |
| `/admin/*` | NextAuth via middleware | `session.role === 'admin'` only |

`middleware.ts` covers `/admin/*` and `/employee/*` matchers. LIFF pages check login inside the component because LIFF token isn't a NextAuth session.

On first LIFF open, upsert the user into `users` keyed by `lineUserId` (pulled from `liff.getProfile()` along with `displayName` and `pictureUrl`).

## Offline delivery tracking

LIFF cannot run background GPS — if the driver closes the LIFF tab, tracking stops. Agreed-upon mitigations:

1. **Primary:** GPS updates every 10s while LIFF page is open (foreground only)
2. **Fallback columns on `deliveryTracking`:** `lastKnownLat`, `lastKnownLng`, `lastKnownAt`, `signalLostAt`, `lastSyncedAt` — if driver loses signal, keep showing last known position with timestamp badge
3. **Optional:** `deliveryCheckpoints` table with QR-scanned waypoints
4. **Never promised:** SMS fallback was mentioned as a later option but not implemented

The customer UI should show "ตำแหน่งล่าสุด ณ HH:MM" with a greyed badge when `signalLostAt` is set, rather than flipping to "offline".

## Row Level Security (RLS)

Every table has RLS enabled. A helper function `currentEmployeeRole()` returns the role for `auth.uid()` from the `employees` table. Use it in policies instead of re-querying.

General pattern:
- **Customer-owned rows** (orders, transferSlips, debtRecords, chatLogs): customer sees own rows via `userId::text = auth.uid()::text`; employees/admins see all via `currentEmployeeRole()`
- **Employee-owned rows** (workAttendance): employee sees own; admin sees all
- **Admin-only writes**: `announcements`, `debtRecords`, slip verification
- **Public reads**: `announcements` where `isPublished = true`
- `users` table allows INSERT without auth (needed for first-time LIFF upsert)

## Common pitfalls to avoid

- **Do NOT** suggest Prisma ORM without asking — user is using Supabase client directly
- **Do NOT** suggest merging `users` and `employees` back into one table
- **Do NOT** add `lineUserId` to `employees` or `email/password` to `users`
- **Do NOT** propose a `products` table unless user explicitly asks
- **Do NOT** propose native mobile app patterns (React Native, Expo, background services)
- **Do NOT** propose Firebase, Clerk, Auth0, or any non-NextAuth auth for staff
- **When writing SQL**, always wrap identifiers in double quotes: `"lineUserId"` not `lineUserId`
- **When generating TypeScript types**, match the camelCase column names exactly

## Quick reference: when user asks for…

| User asks | Point them to / do |
|---|---|
| SQL to create tables | `references/supabase_schema.sql` |
| ERD / dbdiagram code | `references/schema.dbml` |
| How auth works | See "Auth & session architecture" above |
| Payment flow code | See "Payment flow" table + build Next.js route |
| RLS policy for new table | See "Row Level Security" section; reuse `currentEmployeeRole()` |
| Add a new feature | Confirm it fits existing schema before adding tables |
| Deploy / hosting | User hasn't decided yet — ask before assuming Vercel |

## Language

Reply to the user in **Thai** by default. Keep explanations concrete and code-first. The user is capable but new to some concepts — explain briefly when introducing a new term (e.g., "RLS คือ...") but don't over-explain things already covered in earlier conversations.

## CRITICAL — Do not use Prisma

This project has NO Prisma. The `prisma/` folder is legacy and must be ignored.
ALL database operations use Supabase client ONLY:

✅ CORRECT
```ts
await supabase.from('orders').insert({ ... })
```

❌ WRONG — never suggest these
```ts
prisma.order.create(...)
npx prisma migrate dev
schema.prisma
```