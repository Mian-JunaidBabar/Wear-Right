import MyOrdersView from "@/components/MyOrdersView";
import RequireAuth from "@/features/auth/RequireAuth";

export default function Page() {
  return (
    <RequireAuth>
      <MyOrdersView />
    </RequireAuth>
  );
}
