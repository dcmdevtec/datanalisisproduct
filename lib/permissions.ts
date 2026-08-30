// Catálogo central de permisos por módulo/acción — un solo lugar de verdad
// para "qué puede hacer cada rol", en vez de tenerlo desperdigado en cada
// requireRole([...]) de app/api/** y en el menú de components/dashboard-layout.tsx.
//
// Contexto: hasta ahora el control de acceso era SOLO por rol fijo (5
// valores), sin forma de decirle a un usuario en particular "podés ver
// Reportes pero no Encuestadores". Este catálogo define:
//   1) qué módulos/acciones existen (MODULE_ACTIONS),
//   2) qué puede hacer cada rol POR DEFECTO (ROLE_DEFAULTS) — codificado
//      para que coincida EXACTO con el comportamiento real de hoy (los
//      requireRole([...]) de cada ruta), así que activar este sistema no
//      cambia nada para nadie hasta que un admin edite permisos puntuales,
//   3) `users.permissions` (columna nueva, ver migration en
//      sql/2026_08_30_user_permissions.sql) — un override OPCIONAL por
//      usuario que se aplica ENCIMA del default de su rol.
//
// IMPORTANTE — esto no reemplaza requireRole(): un supervisor nunca va a
// poder hacer algo que su rol tiene bloqueado a nivel de ruta (ej. crear un
// encuestador, que exige requireRole(["admin"]) sin excepción). Este
// catálogo solo puede RESTRINGIR más dentro de lo que el rol ya permite, o
// habilitar una acción que el rol permite por defecto pero que se quiere
// apagar para alguien puntual — nunca elevar por encima del techo del rol.

export type Role = "admin" | "coordinator" | "supervisor" | "surveyor" | "client"

export type ModuleKey =
  | "dashboard"
  | "companies"
  | "projects"
  | "surveys"
  | "surveyors"
  | "geolocation"
  | "users"
  | "zones"
  | "reports"
  | "messages"

export type ActionKey = "view" | "create" | "edit" | "delete" | "export" | "share" | "assign"

// Qué acciones tiene sentido mostrar/editar para cada módulo (no todos los
// módulos usan las 7 acciones — ej. Dashboard solo se "ve").
export const MODULE_ACTIONS: Record<ModuleKey, ActionKey[]> = {
  dashboard: ["view"],
  companies: ["view", "create", "edit", "delete"],
  projects: ["view", "create", "edit", "delete", "export"],
  surveys: ["view", "create", "edit", "delete", "export"],
  surveyors: ["view", "create", "edit", "delete", "assign"],
  geolocation: ["view"],
  users: ["view", "create", "edit"],
  zones: ["view", "create", "edit", "delete"],
  reports: ["view", "export", "share"],
  messages: ["view"],
}

// Etiquetas en español para la UI (checkboxes del editor de permisos).
export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  companies: "Empresas",
  projects: "Proyectos",
  surveys: "Encuestas",
  surveyors: "Encuestadores",
  geolocation: "Geolocalización",
  users: "Usuarios",
  zones: "Zonas",
  reports: "Reportes",
  messages: "Mensajes",
}

export const ACTION_LABELS: Record<ActionKey, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  export: "Exportar",
  share: "Compartir",
  assign: "Asignar",
}

export type PermissionGrid = Partial<Record<ModuleKey, Partial<Record<ActionKey, boolean>>>>

function grid(modules: Partial<Record<ModuleKey, ActionKey[]>>): PermissionGrid {
  const out: PermissionGrid = {}
  for (const [mod, actions] of Object.entries(modules) as [ModuleKey, ActionKey[]][]) {
    out[mod] = Object.fromEntries(actions.map((a) => [a, true]))
  }
  return out
}

// Comportamiento REAL de hoy, módulo por módulo, codificado como default por
// rol. Ver PERMISOS_DATANALISIS (auditoría 2026-08-30) para la matriz
// completa de dónde sale cada valor. Todo lo que no aparece = false.
export const ROLE_DEFAULTS: Record<Role, PermissionGrid> = {
  admin: grid({
    dashboard: ["view"],
    companies: ["view", "create", "edit", "delete"],
    projects: ["view", "create", "edit", "delete", "export"],
    surveys: ["view", "create", "edit", "delete", "export"],
    surveyors: ["view", "create", "edit", "delete", "assign"],
    geolocation: ["view"],
    users: ["view", "create", "edit"],
    zones: ["view", "create", "edit", "delete"],
    reports: ["view", "export", "share"],
    messages: ["view"],
  }),
  coordinator: grid({
    dashboard: ["view"],
    companies: ["view"],
    projects: ["view", "export"],
    surveys: ["view"],
    geolocation: ["view"],
    zones: ["view"],
    reports: ["view", "export"],
    messages: ["view"],
  }),
  supervisor: grid({
    dashboard: ["view"],
    companies: ["view"],
    projects: ["view", "export"],
    surveys: ["view", "create", "edit", "delete", "export"],
    surveyors: ["view"],
    geolocation: ["view"],
    users: ["view"],
    zones: ["view"],
    reports: ["view", "export", "share"],
    messages: ["view"],
  }),
  surveyor: grid({
    // El encuestador no usa este panel — vive en /portal-encuestador, que
    // no pasa por este catálogo. Se deja todo en false a propósito.
    zones: ["view"], // RLS ya lo deja leer zonas (nombre no es sensible)
  }),
  client: grid({
    // Rol legado — ya no se ofrece al crear usuarios (ver create-user-modal.tsx).
    surveys: ["view"],
    zones: ["view"],
  }),
}

export interface PermissionUser {
  role: string
  permissions?: PermissionGrid | null
}

// Combina el default del rol con el override guardado en users.permissions.
// El override es un OBJETO PARCIAL: solo pisa los módulos/acciones que
// explícitamente define (true o false); todo lo que no menciona conserva
// el default del rol. Esto es lo que hace seguro activar esta función en
// producción: un usuario sin `permissions` (el caso de TODOS los usuarios
// existentes hoy) se comporta exactamente igual que antes.
export function getEffectivePermissions(user: PermissionUser): PermissionGrid {
  const base = ROLE_DEFAULTS[user.role as Role] ?? {}
  const override = user.permissions ?? {}
  const merged: PermissionGrid = {}
  const modules = new Set<ModuleKey>([
    ...(Object.keys(base) as ModuleKey[]),
    ...(Object.keys(override) as ModuleKey[]),
  ])
  for (const mod of modules) {
    merged[mod] = { ...(base[mod] ?? {}), ...(override[mod] ?? {}) }
  }
  return merged
}

export function hasPermission(user: PermissionUser, module: ModuleKey, action: ActionKey): boolean {
  const perms = getEffectivePermissions(user)
  return perms[module]?.[action] === true
}
