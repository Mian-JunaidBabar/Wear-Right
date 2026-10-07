import { Suspense } from "react";
import ShopView from "@/components/ShopView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ShopView />
    </Suspense>
  );
}
