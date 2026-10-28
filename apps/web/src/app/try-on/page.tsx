import { Suspense } from "react";
import TryOnView from "@/components/TryOnView";

export default function TryOnPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] grid place-items-center text-sm font-bold text-slate-500">Loading try-on...</div>}>
      <TryOnView />
    </Suspense>
  );
}
