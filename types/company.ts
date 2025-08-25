export type Company = {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null; // base64
  website?: string | null;
  contact?: string | null;
  created_at?: string;
  updated_at?: string;
};
