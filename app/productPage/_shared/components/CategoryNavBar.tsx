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

const navItemSx = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 0.5,
  color: "#fff",
  px: { xs: 1.25, sm: 2 },
  py: 1,
  borderRadius: 1.5,
} as const;

type NavTabProps = {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
};

function NavTab({ href, active, icon, label }: NavTabProps) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <ButtonBase component="span" sx={{ ...navItemSx, bgcolor: active ? "rgb(2, 0, 0)" : "transparent" }}>
        {icon}
        <Typography variant="caption" sx={{ color: "inherit", fontWeight: active ? 700 : 600 }}>
          {label}
        </Typography>
      </ButtonBase>
    </Link>
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
        px: { xs: 1, md: 3 },
      }}
    >
      <Box sx={{ display: "flex", overflowX: "auto" }}>
        <NavTab href="/productPage" active={isProductsActive} icon={<TankIcon color="#fff" />} label="รายการถังแก๊ส" />
        <NavTab href="/productPage/parts" active={isPartsActive} icon={<PartIcon color="#fff" />} label="อะไหล่แก๊ส" />
        <NavTab href="/productPage/orders" active={isOrdersActive} icon={<HomeIcon color="#fff" />} label="คำสั่งซื้อ" />
        <NavTab href="/productPage/announcements" active={isAnnouncementsActive} icon={<BellIcon color="#fff" />} label="โปรโมชั่น" />
        <NavTab href="/productPage/chat" active={isChatActive} icon={<ChatIcon color="#fff" />} label="แชทบอท" />
      </Box>

      <ButtonBase onClick={openCart} sx={navItemSx}>
        <Badge badgeContent={cartCount} color="error">
          <CartIcon color="#fff" />
        </Badge>
        <Typography variant="caption" sx={{ color: "inherit", fontWeight: 600 }}>
          ตะกร้า
        </Typography>
      </ButtonBase>
    </Box>
  );
}
