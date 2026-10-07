import { Suspense } from "react";
import AuthView from "@/components/AuthView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthView mode="login" />
    </Suspense>
  );
}
