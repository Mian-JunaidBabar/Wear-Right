import { Suspense } from "react";
import ProductDetailView from "@/components/ProductDetailView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProductDetailView />
    </Suspense>
  );
}
