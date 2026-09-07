import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastState = {
  items: ToastItem[];
  push: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
};

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, variant = "default") => {
    const id = `toast-${Date.now()}-${seq++}`;
    set((s) => ({ items: [...s.items.slice(-2), { id, message, variant }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 3200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, variant: ToastVariant = "default") {
  useToastStore.getState().push(message, variant);
}
