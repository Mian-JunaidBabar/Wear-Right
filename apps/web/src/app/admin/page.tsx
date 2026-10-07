import AdminView from "@/components/AdminView";
import RequireAuth from "@/features/auth/RequireAuth";

export default function Page() {
  return (
    <RequireAuth staffOnly>
      <AdminView />
    </RequireAuth>
  );
}
