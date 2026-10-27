import { Suspense, type ReactNode } from "react";
import AdminRoot from "@/components/admin/AdminRoot";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500 font-semibold bg-cream-base" role="status">
          Loading admin panel...
        </div>
      }
    >
      <AdminRoot>{children}</AdminRoot>
    </Suspense>
  );
}
