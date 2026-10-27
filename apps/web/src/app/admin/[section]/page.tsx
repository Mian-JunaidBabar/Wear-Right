import { ADMIN_SECTION_SLUGS } from "@/features/admin/sections";

/**
 * /admin/<section> : the panel (rendered by the admin layout) picks the section from the URL.
 * This page deliberately renders nothing; instant navigation would flag a segment with no UI,
 * so it is disabled for it.
 */
export const instant = false;

export function generateStaticParams() {
  return ADMIN_SECTION_SLUGS.map((section) => ({ section }));
}

export default function Page() {
  return null;
}
