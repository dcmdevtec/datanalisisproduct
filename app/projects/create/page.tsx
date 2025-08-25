"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase-browser";

export default function CreateProjectPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase.from("companies").select("id, name");
      setCompanies(data || []);
    };
    fetchCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.from("projects").insert([
      {
        name,
        description,
        objective,
        company_id: companyId,
      },
    ]);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/projects");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 flex flex-col items-center">
        <div className="w-full max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Crear Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input placeholder="Nombre del proyecto" value={name} onChange={e => setName(e.target.value)} required />
                <select value={companyId} onChange={e => setCompanyId(e.target.value)} required className="w-full border rounded p-2">
                  <option value="">Selecciona una empresa</option>
                  {companies.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Input placeholder="Descripción (opcional)" value={description} onChange={e => setDescription(e.target.value)} />
                <Input placeholder="Objetivo (opcional)" value={objective} onChange={e => setObjective(e.target.value)} />
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Guardando..." : "Crear Proyecto"}</Button>
                {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
