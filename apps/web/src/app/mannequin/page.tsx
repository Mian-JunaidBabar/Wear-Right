import { Suspense } from "react";
import DressingRoomView from "@/components/DressingRoomView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DressingRoomView />
    </Suspense>
  );
}
