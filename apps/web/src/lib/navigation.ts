"use client";

import { useCallback } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from "next/navigation";
import type { ViewType } from "./types";

export { useParams, usePathname };

/** Navigate to a path, or go back/forward when given a number (react-router style). */
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number) => {
      if (typeof to === "number") {
        if (to < 0) router.back();
        else router.forward();
      } else {
        router.push(to);
      }
    },
    [router],
  );
}

/** Read-only search params, returned as a one-item tuple like react-router's hook. */
export function useSearchParams(): [URLSearchParams] {
  return [useNextSearchParams()];
}

export const VIEW_PATHS: Record<ViewType, string> = {
  home: "/",
  auth: "/login",
  profile: "/profile",
  facescan: "/scanner",
  shop: "/shop",
  recommended: "/recommended",
  "complete-outfit": "/complete-outfit",
  "order-confirmation": "/order-confirmation",
  "my-orders": "/my-orders",
  wishlist: "/wishlist",
  about: "/about",
  contact: "/contact",
  admin: "/admin",
};

export function useSetView() {
  const navigate = useNavigate();
  return useCallback((view: ViewType) => navigate(VIEW_PATHS[view]), [navigate]);
}

/** Which nav item is active for a pathname. */
export function viewFromPath(pathname: string): ViewType {
  if (pathname === "/") return "home";
  const first = pathname.split("/")[1];
  if (first === "scanner") return "facescan";
  if (first === "login" || first === "register") return "auth";
  return first as ViewType;
}
