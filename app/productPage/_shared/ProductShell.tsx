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
import { createClient } from "@/app/api/util/supabase/client";
import { belowHeaderMinHeightSx } from "@/app/components/UI/authStyles";

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
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        router.push(data.session ? "/productPage/checkout" : "/login");
      }}
    />
  );
}

export default function ProductShell({ children }: { children: ReactNode }) {
  return (
    <ThemeRegistry>
      <CartProvider>
        <Box sx={{ ...belowHeaderMinHeightSx, display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
          <SiteTopBar />
          <CategoryNavBar />
          {children}
          <ShopContactFooter />
        </Box>
        <CartDrawerConnected />
        <PrivacyPolicyDialog />
      </CartProvider>
    </ThemeRegistry>
  );
}
