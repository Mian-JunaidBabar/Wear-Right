"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { FiltersProvider } from "@/features/catalog/useFilters";
import ToastHost from "@/components/ToastHost";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FiltersProvider>{children}</FiltersProvider>
      <ToastHost />
    </AuthProvider>
  );
}
