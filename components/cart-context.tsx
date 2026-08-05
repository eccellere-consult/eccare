'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface CartItem {
  catalogItemId: string;
  name: string;
  price: number;
  imagePath: string | null;
  quantity: number;
}

interface CartState {
  providerId: string | null;
  providerName: string | null;
  listingId: string | null;
  items: CartItem[];
}

interface CartContextValue extends CartState {
  addItem: (providerId: string, providerName: string, listingId: string, item: Omit<CartItem, 'quantity'>) => void;
  updateQuantity: (catalogItemId: string, quantity: number) => void;
  removeItem: (catalogItemId: string) => void;
  clearCart: () => void;
  total: number;
}

const EMPTY_STATE: CartState = { providerId: null, providerName: null, listingId: null, items: [] };
const STORAGE_KEY = 'ec-cart';

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY_STATE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // corrupted/unavailable storage — start with an empty cart, nothing to recover
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable (private browsing, quota) — cart just won't persist
    }
  }, [state]);

  const addItem = useCallback(
    (providerId: string, providerName: string, listingId: string, item: Omit<CartItem, 'quantity'>) => {
      setState((prev) => {
        if (prev.providerId && prev.providerId !== providerId) {
          if (!confirm(`Your cart has items from ${prev.providerName}. Start a new order with ${providerName} instead?`)) {
            return prev;
          }
          return { providerId, providerName, listingId, items: [{ ...item, quantity: 1 }] };
        }

        const existing = prev.items.find((i) => i.catalogItemId === item.catalogItemId);
        const items = existing
          ? prev.items.map((i) => (i.catalogItemId === item.catalogItemId ? { ...i, quantity: i.quantity + 1 } : i))
          : [...prev.items, { ...item, quantity: 1 }];

        return { providerId, providerName, listingId, items };
      });
    },
    [],
  );

  const updateQuantity = useCallback((catalogItemId: string, quantity: number) => {
    setState((prev) => {
      if (quantity <= 0) {
        const items = prev.items.filter((i) => i.catalogItemId !== catalogItemId);
        return items.length === 0 ? EMPTY_STATE : { ...prev, items };
      }
      return { ...prev, items: prev.items.map((i) => (i.catalogItemId === catalogItemId ? { ...i, quantity } : i)) };
    });
  }, []);

  const removeItem = useCallback((catalogItemId: string) => {
    setState((prev) => {
      const items = prev.items.filter((i) => i.catalogItemId !== catalogItemId);
      return items.length === 0 ? EMPTY_STATE : { ...prev, items };
    });
  }, []);

  const clearCart = useCallback(() => setState(EMPTY_STATE), []);

  const total = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ ...state, addItem, updateQuantity, removeItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
