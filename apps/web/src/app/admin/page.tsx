/**
 * /admin : the dashboard. The panel itself is rendered by app/admin/layout.tsx so it
 * persists between sections. This page deliberately renders nothing; insta-nav validation
 * would flag a segment with no UI, so instant navigation is disabled for it.
 */
export const instant = false;

export default function Page() {
  return null;
}
