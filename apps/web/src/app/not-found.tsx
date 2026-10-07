"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useNavigate } from "@/lib/navigation";

/** The legacy app sent every unknown URL to the home page; keep that behaviour. */
export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/");
  }, [navigate]);

  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-black text-brand-dark">Page not found</h1>
      <Link href="/" className="bg-slate-900 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider">
        Back to home
      </Link>
    </div>
  );
}
