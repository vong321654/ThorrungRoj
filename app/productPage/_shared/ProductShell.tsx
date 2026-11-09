"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { CartProvider, useCart } from "./CartContext";
import ThemeRegistry from "./ThemeRegistry";
import CartDrawer from "./components/CartDrawer";
import CategoryNavBar from "./components/CategoryNavBar";
import { CustomerProfileProvider } from "./CustomerProfileContext";
import CustomerTypeDialog from "./components/CustomerTypeDialog";
import PrivacyPolicyDialog from "./components/PrivacyPolicyDialog";
import ShopContactFooter from "./components/ShopContactFooter";
import SiteTopBar from "./components/SiteTopBar";
import { useRouter } from "next/navigation";
import { getVerifiedAccessToken } from "@/app/util/customerSession";
import { loginUrlWithNext } from "@/app/util/loginRedirect";
import { belowHeaderMinHeightSx } from "@/app/components/UI/authStyles";

const CHECKOUT_PATH = "/productPage/checkout";

function CartDrawerConnected() {
  const cart = useCart();
  const router = useRouter();
  return (
    <CartDrawer
      open={cart.isCartOpen}
      lines={cart.cartLines}
      total={cart.cartTotal}
      onClose={cart.closeCart}
      onRemove={cart.removeItem}
      onIncrease={cart.increaseQuantity}
      canIncrease={cart.canIncrease}
      onDecrease={cart.decreaseQuantity}
      onCheckout={async () => {
        cart.closeCart();
        // ยังไม่ login (หรือ session ค้างที่ใช้ไม่ได้) ไปหน้า LINE login แล้วกลับมาหน้าสั่งซื้อต่อ ตะกร้าอยู่ใน localStorage ไม่หาย
        const accessToken = await getVerifiedAccessToken();
        router.push(accessToken ? CHECKOUT_PATH : loginUrlWithNext(CHECKOUT_PATH));
      }}
    />
  );
}

export default function ProductShell({ children }: { children: ReactNode }) {
  return (
    <ThemeRegistry>
      <CustomerProfileProvider>
        <CartProvider>
          <Box sx={{ ...belowHeaderMinHeightSx, display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
            <SiteTopBar />
            <CategoryNavBar />
            {children}
            <ShopContactFooter />
          </Box>
          <CartDrawerConnected />
          {/* แสดงทีละอัน: นโยบายก่อน แล้วจึงเลือกประเภทลูกค้า */}
          <PrivacyPolicyDialog />
          <CustomerTypeDialog />
        </CartProvider>
      </CustomerProfileProvider>
    </ThemeRegistry>
  );
}
