export interface Surveyor {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  profile_image?: string | null;
  last_login?: string | null;
  active_projects?: string[];
  assigned_zones?: string[];
}
