import { Suspense } from "react";
import CompleteOutfitView from "@/components/CompleteOutfitView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompleteOutfitView />
    </Suspense>
  );
}
