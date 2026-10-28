import { Suspense } from "react";
import ResetPasswordView from "@/components/ResetPasswordView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordView />
    </Suspense>
  );
}
