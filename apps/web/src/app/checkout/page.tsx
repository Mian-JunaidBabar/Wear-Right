import CheckoutView from "@/components/CheckoutView";
import RequireAuth from "@/features/auth/RequireAuth";

export default function Page() {
  return (
    <RequireAuth>
      <CheckoutView />
    </RequireAuth>
  );
}
