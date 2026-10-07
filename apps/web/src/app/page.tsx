"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type ProductsResponse = { products: { id: number; name: string }[] };

export default function Home() {
  const [names, setNames] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ProductsResponse>("/api/products/")
      .then((data) => setNames(data.products.map((p) => p.name)))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Wear Right</h1>
      {error && <p role="alert">{error}</p>}
      <ul>{names?.map((name) => <li key={name}>{name}</li>)}</ul>
    </main>
  );
}
