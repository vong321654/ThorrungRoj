"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem, CartLine } from "./domain/cartItem";

const CART_STORAGE_KEY = "thor-rungroj-cart-v1";

type CartContextValue = {
  cartLines: CartLine[];
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  addItem: (item: CartItem) => void;
  increaseQuantity: (itemId: string) => void;
  decreaseQuantity: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function getProductQuantity(lines: CartLine[], productId: number | null) {
  if (productId === null) return 0;
  return lines.reduce(
    (total, line) => total + (line.item.productId === productId ? line.quantity : 0),
    0,
  );
}

function hasReachedInventoryLimit(lines: CartLine[], item: CartItem) {
  return (
    item.availableQuantity !== null &&
    getProductQuantity(lines, item.productId) >= item.availableQuantity
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
      if (storedCart) {
        const parsed = JSON.parse(storedCart) as unknown;
        if (Array.isArray(parsed)) {
          const validLines = parsed.filter((line): line is CartLine => {
            if (!line || typeof line !== "object") return false;
            const candidate = line as Partial<CartLine>;
            const item = candidate.item;
            return (
              Number.isInteger(candidate.quantity) &&
              (candidate.quantity ?? 0) > 0 &&
              typeof item?.id === "string" &&
              typeof item.name === "string" &&
              (item.productId === null ||
                (Number.isInteger(item.productId) && (item.productId ?? 0) > 0)) &&
              (item.saleType === null ||
                item.saleType === "sell" ||
                item.saleType === "exchange" ||
                item.saleType === "refill") &&
              (item.price === null || (typeof item.price === "number" && Number.isFinite(item.price))) &&
              (item.availableQuantity === undefined ||
                item.availableQuantity === null ||
                (Number.isInteger(item.availableQuantity) && item.availableQuantity >= 0))
            );
          });
          setCartLines(
            validLines.map((line) => ({
              ...line,
              item: {
                ...line.item,
                availableQuantity: line.item.availableQuantity ?? null,
              },
            })),
          );
        }
      }
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartLines));
  }, [cartLines, isHydrated]);

  function addItem(item: CartItem) {
    setCartLines((prev) => {
      if (hasReachedInventoryLimit(prev, item)) return prev;
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.item.id === item.id
            ? { ...line, item, quantity: line.quantity + 1 }
            : line
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setIsCartOpen(true);
  }

  function increaseQuantity(itemId: string) {
    setCartLines((prev) => {
      const selectedLine = prev.find((line) => line.item.id === itemId);
      if (!selectedLine || hasReachedInventoryLimit(prev, selectedLine.item)) return prev;
      return prev.map((line) =>
        line.item.id === itemId ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
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

  function clearCart() {
    setCartLines([]);
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
    clearCart,
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
