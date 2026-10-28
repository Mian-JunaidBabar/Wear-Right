import { Suspense } from "react";
import AdminResetPasswordView from "@/components/admin/AdminResetPasswordView";

export default function Page() {
  return (
    <Suspense>
      <AdminResetPasswordView />
    </Suspense>
  );
}
