"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { FiltersProvider } from "@/features/catalog/useFilters";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FiltersProvider>{children}</FiltersProvider>
    </AuthProvider>
  );
}
