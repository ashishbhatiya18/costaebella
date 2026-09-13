"use client";

import { useEffect, useState } from "react";
import { api, Supplier } from "@/lib/pantrly/api";
import { SuppliersTab } from "@/components/pantrly/suppliers-tab";
import { usePageTitle } from "@/lib/admin/use-page-title";

export default function SuppliersPage() {
  usePageTitle("Suppliers");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listSuppliers();
      setSuppliers(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy">Suppliers</h1>
      </div>
      <SuppliersTab suppliers={suppliers} loading={loading} onChange={load} />
    </div>
  );
}
