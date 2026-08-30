export interface Surveyor {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
  phone_number?: string | null;
  created_at?: string;
  updated_at?: string;
  profile_image?: string | null;
  last_login?: string | null;
  active_projects?: string[];
  assigned_zones?: string[];
  // Supervisor global de este encuestador (users.id, role='supervisor') —
  // usado para precargar la asignación en cascada Coordinador->Supervisor
  // en components/survey-hierarchy-assignment.tsx (reunión 2026-08-27).
  supervisor_id?: string | null;
}
