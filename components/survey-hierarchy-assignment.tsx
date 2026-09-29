"use client"

import * as React from "react"
import { Users, X, Plus, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Reunión 2026-08-27 ("Asignación"): antes se elegían encuestadores
// directo de una lista plana de TODOS los encuestadores activos del
// sistema. Se agregó Coordinador/Supervisor porque el mismo encuestador
// puede caer bajo un supervisor distinto según la encuesta ("pueden haber
// coordinadores en otra encuesta con otros supervisores y otros
// encuestadores"). El coordinador/supervisor elegidos acá se guardan junto
// con cada encuestador seleccionado (ver
// survey_surveyor_zones.coordinator_id/supervisor_id en migration.sql).
//
// Ajuste 08/09/2026: Coordinador/Supervisor son selects independientes
// (todas las opciones siempre, sin filtrar por el organigrama global de
// cada usuario) — ver comentario detallado más abajo, en el picker.
//
// Ítem 29/09/2026: "queremos armar el grupo por grupo — se escoge el
// coordinador, luego el supervisor y sus encuestadores, y así
// sucesivamente; si el proyecto tiene más de un coordinador, poder crear
// varios grupos" — el picker anterior era un único select de coordinador +
// un único select de supervisor + UNA lista plana de encuestadores, sin
// ninguna forma de ver "quién quedó bajo quién" una vez marcados. Se
// reemplaza por un armador de grupos: se arma un tramo (coordinador +
// supervisor + sus encuestadores) a la vez con el formulario de abajo, se
// agrega al árbol, y se repite para el siguiente supervisor (mismo
// coordinador) o para un coordinador distinto (arma un grupo nuevo). El
// árbol ya armado se ve agrupado exactamente así — Coordinador > Supervisor
// > Encuestadores — con opción de quitar un encuestador puntual, un
// supervisor completo, o un grupo completo.
//
// El MODELO DE DATOS no cambió: sigue siendo la misma lista plana
// `HierarchyAssignment[]` (cada encuestador con su propio coordinatorId/
// supervisorId) — lo que cambió es solo cómo se arma y se ve en pantalla.
// Un encuestador solo puede estar en un tramo a la vez: marcarlo en un
// supervisor distinto lo MUEVE ahí (se quita de donde estaba antes).

export interface HierarchyCoordinator { id: string; name: string | null }
export interface HierarchySupervisor { id: string; name: string | null; coordinatorId: string | null }
export interface HierarchySurveyor { id: string; name: string | null; email: string; supervisorId: string | null }

export interface HierarchyAssignment {
  surveyorId: string
  coordinatorId: string | null
  supervisorId: string | null
}

interface SurveyHierarchyAssignmentProps {
  title?: string
  description?: string
  coordinators: HierarchyCoordinator[]
  supervisors: HierarchySupervisor[]
  surveyors: HierarchySurveyor[]
  assignments: HierarchyAssignment[]
  onChange: (assignments: HierarchyAssignment[]) => void
}

const NONE = "__none__"

// Agrupa la lista plana en Coordinador -> Supervisor -> [surveyorId, ...],
// preservando el orden de aparición (primer tramo agregado, primero mostrado).
function groupAssignments(assignments: HierarchyAssignment[]) {
  const coordinatorOrder: string[] = []
  const groups = new Map<string, { supervisorOrder: string[]; supervisors: Map<string, string[]> }>()

  for (const a of assignments) {
    const cKey = a.coordinatorId ?? NONE
    const sKey = a.supervisorId ?? NONE
    if (!groups.has(cKey)) {
      groups.set(cKey, { supervisorOrder: [], supervisors: new Map() })
      coordinatorOrder.push(cKey)
    }
    const group = groups.get(cKey)!
    if (!group.supervisors.has(sKey)) {
      group.supervisors.set(sKey, [])
      group.supervisorOrder.push(sKey)
    }
    group.supervisors.get(sKey)!.push(a.surveyorId)
  }

  return { coordinatorOrder, groups }
}

export function SurveyHierarchyAssignment({
  title = "Encuestadores Generales",
  description = "Encuestadores con acceso a todas las zonas seleccionadas",
  coordinators,
  supervisors,
  surveyors,
  assignments,
  onChange,
}: SurveyHierarchyAssignmentProps) {
  // Formulario para armar UN tramo (coordinador + supervisor + sus
  // encuestadores) a la vez. El coordinador queda elegido entre tramos para
  // poder agregar varios supervisores seguidos bajo el mismo grupo sin
  // tener que volver a elegirlo cada vez ("y así sucesivamente para todos
  // los supervisores"); el supervisor y los encuestadores marcados sí se
  // reinician después de cada "Agregar", para armar el siguiente tramo.
  const [draftCoordinatorId, setDraftCoordinatorId] = React.useState<string>(NONE)
  const [draftSupervisorId, setDraftSupervisorId] = React.useState<string>("")
  const [draftSurveyorIds, setDraftSurveyorIds] = React.useState<Set<string>>(new Set())
  const [collapsedCoordinators, setCollapsedCoordinators] = React.useState<Set<string>>(new Set())

  const surveyorById = new Map(surveyors.map((s) => [s.id, s]))
  const coordinatorById = new Map(coordinators.map((c) => [c.id, c]))
  const supervisorById = new Map(supervisors.map((s) => [s.id, s]))

  const assignmentBySurveyorId = new Map(assignments.map((a) => [a.surveyorId, a]))
  const { coordinatorOrder, groups } = groupAssignments(assignments)

  const coordinatorLabel = (key: string) =>
    key === NONE ? "Sin coordinador" : coordinatorById.get(key)?.name || "Sin nombre"
  const supervisorLabel = (key: string) =>
    key === NONE ? "Sin supervisor" : supervisorById.get(key)?.name || "Sin nombre"

  const toggleDraftSurveyor = (surveyorId: string, checked: boolean) => {
    setDraftSurveyorIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(surveyorId)
      else next.delete(surveyorId)
      return next
    })
  }

  // Agrega el tramo armado al árbol: cada encuestador marcado queda con
  // este coordinador/supervisor — si ya estaba en OTRO tramo, se mueve
  // (un encuestador solo pertenece a un tramo a la vez).
  const commitDraft = () => {
    if (!draftSupervisorId || draftSurveyorIds.size === 0) return
    const coordinatorId = draftCoordinatorId === NONE ? null : draftCoordinatorId
    const next = assignments.filter((a) => !draftSurveyorIds.has(a.surveyorId))
    for (const surveyorId of draftSurveyorIds) {
      next.push({ surveyorId, coordinatorId, supervisorId: draftSupervisorId })
    }
    onChange(next)
    setDraftSupervisorId("")
    setDraftSurveyorIds(new Set())
  }

  const removeSurveyor = (surveyorId: string) => {
    onChange(assignments.filter((a) => a.surveyorId !== surveyorId))
  }

  const removeSupervisorGroup = (coordinatorKey: string, supervisorKey: string) => {
    onChange(
      assignments.filter(
        (a) => !((a.coordinatorId ?? NONE) === coordinatorKey && (a.supervisorId ?? NONE) === supervisorKey)
      )
    )
  }

  const removeCoordinatorGroup = (coordinatorKey: string) => {
    onChange(assignments.filter((a) => (a.coordinatorId ?? NONE) !== coordinatorKey))
  }

  const toggleCollapsed = (coordinatorKey: string) => {
    setCollapsedCoordinators((prev) => {
      const next = new Set(prev)
      if (next.has(coordinatorKey)) next.delete(coordinatorKey)
      else next.add(coordinatorKey)
      return next
    })
  }

  const totalAssigned = assignments.length

  return (
    <div className="border rounded-md p-4 space-y-4 bg-background">
      <div>
        <h4 className="text-md font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-primary">{title}</span>
          {totalAssigned > 0 && <Badge variant="outline">{totalAssigned}</Badge>}
        </h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Árbol ya armado — Coordinador > Supervisor > Encuestadores. Cada
          nivel tiene su propio botón para quitarlo completo. */}
      {coordinatorOrder.length > 0 && (
        <div className="space-y-3">
          {coordinatorOrder.map((coordinatorKey) => {
            const group = groups.get(coordinatorKey)!
            const isCollapsed = collapsedCoordinators.has(coordinatorKey)
            const groupTotal = group.supervisorOrder.reduce(
              (sum, sKey) => sum + (group.supervisors.get(sKey)?.length ?? 0),
              0
            )
            return (
              <div key={coordinatorKey} className="border rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(coordinatorKey)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <span className="flex items-center gap-1.5 font-semibold text-sm">
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {coordinatorLabel(coordinatorKey)}
                    <Badge variant="outline" className="ml-1">{groupTotal}</Badge>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removeCoordinatorGroup(coordinatorKey) }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); removeCoordinatorGroup(coordinatorKey) } }}
                    className="rounded-full p-1 hover:bg-muted-foreground/20 cursor-pointer"
                    title="Quitar todo este grupo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="divide-y">
                    {group.supervisorOrder.map((supervisorKey) => {
                      const surveyorIds = group.supervisors.get(supervisorKey) ?? []
                      return (
                        <div key={supervisorKey} className="flex flex-col sm:flex-row sm:items-start gap-2 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 sm:w-40 shrink-0">
                            <span className="text-sm font-medium truncate">{supervisorLabel(supervisorKey)}</span>
                            <button
                              type="button"
                              onClick={() => removeSupervisorGroup(coordinatorKey, supervisorKey)}
                              className="rounded-full p-0.5 hover:bg-muted-foreground/20 shrink-0"
                              title="Quitar este supervisor y sus encuestadores"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {surveyorIds.map((surveyorId) => {
                              const surveyor = surveyorById.get(surveyorId)
                              return (
                                <Badge key={surveyorId} variant="secondary" className="gap-1 pr-1">
                                  {surveyor?.name || surveyor?.email || surveyorId}
                                  <button
                                    type="button"
                                    onClick={() => removeSurveyor(surveyorId)}
                                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Armador de tramos — coordinador + supervisor + encuestadores,
          "Agregar" los suma al árbol de arriba. Coordinador/Supervisor son
          selects independientes con TODAS las opciones siempre (no
          restringen quién se puede elegir — ver comentario de la reunión
          08/09/2026 más arriba). */}
      <div className="border rounded-md p-3 space-y-3 bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Agregar grupo / supervisor
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Select value={draftCoordinatorId} onValueChange={setDraftCoordinatorId}>
            <SelectTrigger>
              <SelectValue placeholder="Coordinador (opcional)..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin coordinador</SelectItem>
              {coordinators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name || "Sin nombre"}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={draftSupervisorId} onValueChange={setDraftSupervisorId}>
            <SelectTrigger>
              <SelectValue placeholder="Supervisor..." />
            </SelectTrigger>
            <SelectContent>
              {supervisors.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Sin supervisores registrados</div>
              )}
              {supervisors.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name || "Sin nombre"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-md divide-y max-h-56 overflow-y-auto bg-background">
          {surveyors.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-3">No hay encuestadores registrados.</p>
          ) : (
            surveyors.map((s) => {
              const existing = assignmentBySurveyorId.get(s.id)
              const isDraftChecked = draftSurveyorIds.has(s.id)
              const currentGroupLabel = existing
                ? `${coordinatorLabel(existing.coordinatorId ?? NONE)} · ${supervisorLabel(existing.supervisorId ?? NONE)}`
                : null
              return (
                <label key={s.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox
                    checked={isDraftChecked}
                    onCheckedChange={(checked) => toggleDraftSurveyor(s.id, checked === true)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                  </div>
                  {/* Si ya pertenece a otro tramo, se avisa — tildarlo acá lo
                      MUEVE al tramo que se está armando. */}
                  {currentGroupLabel && !isDraftChecked && (
                    <span className="text-[10px] text-muted-foreground text-right shrink-0 max-w-[40%] truncate" title={`Ya asignado en: ${currentGroupLabel}`}>
                      en {currentGroupLabel}
                    </span>
                  )}
                </label>
              )
            })
          )}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={commitDraft}
          disabled={!draftSupervisorId || draftSurveyorIds.size === 0}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar supervisor al grupo
        </Button>
      </div>
    </div>
  )
}
