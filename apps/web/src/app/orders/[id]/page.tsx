import OrderDetailView from "@/components/OrderDetailView";
import RequireAuth from "@/features/auth/RequireAuth";

// Order ids are only known at request time; this page must not be prerendered.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <OrderDetailView orderId={id} />
    </RequireAuth>
  );
}
