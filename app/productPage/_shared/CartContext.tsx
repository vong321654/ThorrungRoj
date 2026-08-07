"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CartItem, CartLine } from "./domain/cartItem";

type CartContextValue = {
  cartLines: CartLine[];
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  addItem: (item: CartItem) => void;
  increaseQuantity: (itemId: string) => void;
  decreaseQuantity: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  function addItem(item: CartItem) {
    setCartLines((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setIsCartOpen(true);
  }

  function increaseQuantity(itemId: string) {
    setCartLines((prev) =>
      prev.map((line) => (line.item.id === itemId ? { ...line, quantity: line.quantity + 1 } : line))
    );
  }

  function decreaseQuantity(itemId: string) {
    setCartLines((prev) =>
      prev.flatMap((line) => {
        if (line.item.id !== itemId) return [line];
        const nextQuantity = line.quantity - 1;
        return nextQuantity > 0 ? [{ ...line, quantity: nextQuantity }] : [];
      })
    );
  }

  function removeItem(itemId: string) {
    setCartLines((prev) => prev.filter((line) => line.item.id !== itemId));
  }

  const cartCount = useMemo(
    () => cartLines.reduce((total, line) => total + line.quantity, 0),
    [cartLines]
  );

  const cartTotal = useMemo(
    () => cartLines.reduce((total, line) => total + line.quantity * (line.item.price ?? 0), 0),
    [cartLines]
  );

  const value: CartContextValue = {
    cartLines,
    cartCount,
    cartTotal,
    isCartOpen,
    addItem,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}