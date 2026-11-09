"use client";

import type { ReactNode } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "../CartContext";
import { BellIcon, CartIcon, ChatIcon, HomeIcon, PartIcon, TankIcon } from "./NavIcons";

// จอมือถือ: แบ่งความกว้างเท่ากันทุกปุ่ม เพื่อให้เห็นครบโดยไม่ต้องเลื่อนข้าง
const navItemSx = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flex: { xs: "1 1 0", sm: "0 0 auto" },
  gap: 0.5,
  color: "#fff",
  minWidth: 0,
  px: { xs: 0, sm: 2 },
  py: 1,
  borderRadius: 1.5,
} as const;

function NavLabel({ label, shortLabel, active }: { label: string; shortLabel?: string; active?: boolean }) {
  return (
    <Typography
      variant="caption"
      noWrap
      sx={{
        color: "inherit",
        fontSize: { xs: "0.6875rem", sm: "0.75rem" },
        fontWeight: active ? 700 : 600,
        maxWidth: "100%",
        // จอแคบพิเศษ เช่น iPhone SE รุ่นแรก (320px) และ Galaxy Fold ตอนพับ (280px)
        "@media (max-width: 359.95px)": { fontSize: "0.625rem" },
        "@media (max-width: 319.95px)": { fontSize: "0.5625rem" },
      }}
    >
      {shortLabel ? (
        <>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>{shortLabel}</Box>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{label}</Box>
        </>
      ) : (
        label
      )}
    </Typography>
  );
}

type NavTabProps = {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  /** ชื่อย่อสำหรับจอมือถือ ใช้เมื่อชื่อเต็มยาวเกินช่อง */
  shortLabel?: string;
};

function NavTab({ href, active, icon, label, shortLabel }: NavTabProps) {
  return (
    <ButtonBase
      component={Link}
      href={href}
      aria-current={active ? "page" : undefined}
      sx={{ ...navItemSx, bgcolor: active ? "rgb(2, 0, 0)" : "transparent" }}
    >
      {icon}
      <NavLabel label={label} shortLabel={shortLabel} active={active} />
    </ButtonBase>
  );
}

export default function CategoryNavBar() {
  const pathname = usePathname();
  const { cartCount, openCart } = useCart();
  const isPartsActive = pathname?.startsWith("/productPage/parts") ?? false;
  const isOrdersActive = pathname?.startsWith("/productPage/orders") ?? false;
  const isProductsActive = pathname === "/productPage";
  const isAnnouncementsActive = pathname?.startsWith("/productPage/announcements") ?? false;
  const isChatActive = pathname?.startsWith("/productPage/chat") ?? false;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        bgcolor: "secondary.main",
        px: { xs: 0.5, md: 3 },
      }}
    >
      <Box
        component="nav"
        aria-label="เมนูหลัก"
        sx={{ display: "flex", flex: { xs: "5 1 0", sm: "0 1 auto" }, minWidth: 0, overflowX: { sm: "auto" } }}
      >
        <NavTab href="/productPage" active={isProductsActive} icon={<TankIcon color="#fff" />} label="รายการถังแก๊ส" shortLabel="ถังแก๊ส" />
        <NavTab href="/productPage/parts" active={isPartsActive} icon={<PartIcon color="#fff" />} label="อะไหล่แก๊ส" shortLabel="อะไหล่" />
        <NavTab href="/productPage/orders" active={isOrdersActive} icon={<HomeIcon color="#fff" />} label="คำสั่งซื้อ" />
        <NavTab href="/productPage/announcements" active={isAnnouncementsActive} icon={<BellIcon color="#fff" />} label="โปรโมชั่น" />
        <NavTab href="/productPage/chat" active={isChatActive} icon={<ChatIcon color="#fff" />} label="แชทบอท" />
      </Box>

      <ButtonBase onClick={openCart} sx={navItemSx}>
        <Badge badgeContent={cartCount} color="error">
          <CartIcon color="#fff" />
        </Badge>
        <NavLabel label="ตะกร้า" />
      </ButtonBase>
    </Box>
  );
}
