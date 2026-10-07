import { Suspense } from "react";
import RecommendedProductsView from "@/components/RecommendedProductsView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecommendedProductsView />
    </Suspense>
  );
}
