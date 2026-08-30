"use client"

import { useMemo } from "react"
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
}

// Editor de permisos por módulo/acción para un usuario puntual — auditoría
// 2026-08-30: "no existe forma de decirle a un usuario en particular qué
// módulo/acción puede hacer". Arranca mostrando el default del ROL
// (lib/permissions.ts ROLE_DEFAULTS) y cada casilla que se toca pasa a ser
// un override explícito guardado en users.permissions. "Restablecer al
// default del rol" (por módulo o global) limpia el override.
//
// Vive en su propia pestaña "Roles y permisos" de EditUserModal (antes iba
// apilado junto con Nombre/Rol/Estado en un solo formulario largo, lo que
// se veía muy lleno) — por eso ya no tiene su propio colapsable: al entrar
// a la pestaña ya es lo único que hay que ver.
export function UserPermissionsEditor({ role, value, onChange }: Props) {
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
          Arranca con el default de <strong>{role}</strong>. Lo que toques acá queda guardado como excepción para
          este usuario puntual, sin cambiar el default del rol para los demás.
        </p>
        {hasAnyOverride && (
          <button
            type="button"
            onClick={resetAll}
            className="shrink-0 ml-3 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Restablecer todo al rol
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
