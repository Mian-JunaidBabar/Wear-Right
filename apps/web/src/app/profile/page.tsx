import ProfileView from "@/components/ProfileView";
import RequireAuth from "@/features/auth/RequireAuth";

export default function Page() {
  return (
    <RequireAuth>
      <ProfileView />
    </RequireAuth>
  );
}
