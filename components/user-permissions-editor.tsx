"use client"

import { useMemo, type ReactNode } from "react"
import { RotateCcw } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  MODULE_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  ROLE_DEFAULTS,
  getEffectivePermissions,
  type ModuleKey,
  type ActionKey,
  type PermissionGrid,
  type Role,
} from "@/lib/permissions"

interface Props {
  role: string
  value: PermissionGrid | null
  onChange: (next: PermissionGrid | null) => void
  // Texto de ayuda mostrado arriba del grid — varía según quién usa este
  // componente (ver más abajo).
  description?: ReactNode
  resetLabel?: string
}

// Editor de permisos por módulo/acción, reutilizado en dos lugares con
// distinto "value"/persistencia:
//
//   1) components/role-permissions-tab.tsx (pestaña "Roles y permisos" de
//      /users) — value/onChange apuntan al default EDITABLE de un ROL
//      completo (public.role_permissions), afecta a TODOS los usuarios con
//      ese rol. Este es el uso principal hoy (auditoría 2026-08-30: "no
//      existe forma de decirle a un usuario en particular qué módulo/acción
//      puede hacer" → corrección 2026-08-31 del cliente: "lo que se edita
//      son los permisos del ROL", no de un usuario puntual, y en su propio
//      tab del módulo de Usuarios, no metido en Editar Usuario).
//   2) El override POR USUARIO (users.permissions) se deja funcional en el
//      backend por si hace falta más adelante, pero hoy no tiene UI propia
//      — se sacó de EditUserModal a pedido explícito.
//
// Sea cual sea el "value" que reciba, el comportamiento es el mismo: arranca
// mostrando el default heredado (ROLE_DEFAULTS de lib/permissions.ts, más
// cualquier capa debajo) y cada casilla que se toca pasa a ser un override
// explícito. "Restablecer" (por módulo o global) limpia el override y vuelve
// a heredar.
export function UserPermissionsEditor({ role, value, onChange, description, resetLabel }: Props) {
  const roleDefaults = ROLE_DEFAULTS[role as Role] ?? {}
  const effective = useMemo(
    () => getEffectivePermissions({ role, permissions: value }),
    [role, value],
  )

  const isOverridden = (mod: ModuleKey, action: ActionKey) =>
    value?.[mod]?.[action] !== undefined && value[mod]![action] !== (roleDefaults[mod]?.[action] ?? false)

  const toggle = (mod: ModuleKey, action: ActionKey) => {
    const current = effective[mod]?.[action] === true
    const next: PermissionGrid = { ...(value ?? {}) }
    next[mod] = { ...(next[mod] ?? {}), [action]: !current }
    onChange(next)
  }

  const resetModule = (mod: ModuleKey) => {
    if (!value) return
    const next = { ...value }
    delete next[mod]
    onChange(Object.keys(next).length > 0 ? next : null)
  }

  const resetAll = () => onChange(null)

  const hasAnyOverride = value !== null && value !== undefined && Object.keys(value).length > 0

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/20">
        <p className="text-xs text-muted-foreground">
          {description ?? (
            <>
              Arranca con el default de <strong>{role}</strong>. Lo que toques acá queda guardado como excepción,
              sin afectar los módulos que no toques.
            </>
          )}
        </p>
        {hasAnyOverride && (
          <button
            type="button"
            onClick={resetAll}
            className="shrink-0 ml-3 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> {resetLabel ?? "Restablecer todo al rol"}
          </button>
        )}
      </div>

      <div className="divide-y">
        {(Object.keys(MODULE_ACTIONS) as ModuleKey[]).map((mod) => {
          const actions = MODULE_ACTIONS[mod]
          const moduleHasOverride = actions.some((a) => isOverridden(mod, a))
          return (
            <div key={mod} className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-[140px]">
                <span className="text-sm font-medium">{MODULE_LABELS[mod]}</span>
                {moduleHasOverride && (
                  <button
                    type="button"
                    onClick={() => resetModule(mod)}
                    title="Restablecer este módulo al default del rol"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {actions.map((action) => {
                  const checked = effective[mod]?.[action] === true
                  const overridden = isOverridden(mod, action)
                  return (
                    <label
                      key={action}
                      className={`flex items-center gap-1.5 text-xs cursor-pointer ${overridden ? "text-[#18b0a4] font-medium" : "text-muted-foreground"}`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(mod, action)} />
                      {ACTION_LABELS[action]}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
