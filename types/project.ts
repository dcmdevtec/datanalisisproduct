export type Project = {
  id: string;
  name: string;
  description?: string | null;
  objective?: string | null;
  company_id: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};
