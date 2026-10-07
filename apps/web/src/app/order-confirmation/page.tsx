import OrderConfirmationView from "@/components/OrderConfirmationView";
import RequireAuth from "@/features/auth/RequireAuth";

export default function Page() {
  return (
    <RequireAuth>
      <OrderConfirmationView />
    </RequireAuth>
  );
}
