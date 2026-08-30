"use client"

import * as React from "react"
import { Users, X } from "lucide-react"
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
// sistema. Ahora la asignación va en cascada Coordinador -> Supervisor ->
// Encuestadores, porque el mismo encuestador puede caer bajo un supervisor
// distinto según la encuesta ("pueden haber coordinadores en otra encuesta
// con otros supervisores y otros encuestadores"). El coordinador/supervisor
// elegidos acá se guardan junto con cada encuestador seleccionado (ver
// survey_surveyor_zones.coordinator_id/supervisor_id en migration.sql), sin
// tocar el organigrama global de cada usuario (surveyors.supervisor_id /
// users.coordinator_id), que solo se usa para PRECARGAR el filtro.

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

export function SurveyHierarchyAssignment({
  title = "Encuestadores Generales",
  description = "Encuestadores con acceso a todas las zonas seleccionadas",
  coordinators,
  supervisors,
  surveyors,
  assignments,
  onChange,
}: SurveyHierarchyAssignmentProps) {
  const [coordinatorId, setCoordinatorId] = React.useState<string>("")
  const [supervisorId, setSupervisorId] = React.useState<string>("")

  const supervisorsForCoordinator = coordinatorId
    ? supervisors.filter((s) => s.coordinatorId === coordinatorId)
    : []

  const surveyorsForSupervisor = supervisorId
    ? surveyors.filter((s) => s.supervisorId === supervisorId)
    : []

  const assignedIds = new Set(assignments.map((a) => a.surveyorId))

  const toggleSurveyor = (surveyorId: string, checked: boolean) => {
    if (checked) {
      onChange([...assignments, { surveyorId, coordinatorId: coordinatorId || null, supervisorId: supervisorId || null }])
    } else {
      onChange(assignments.filter((a) => a.surveyorId !== surveyorId))
    }
  }

  const removeAssignment = (surveyorId: string) => {
    onChange(assignments.filter((a) => a.surveyorId !== surveyorId))
  }

  const surveyorById = new Map(surveyors.map((s) => [s.id, s]))
  const supervisorById = new Map(supervisors.map((s) => [s.id, s]))

  return (
    <div className="border rounded-md p-4 space-y-3 bg-background">
      <h4 className="text-md font-semibold flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-primary">{title}</span>
      </h4>
      <p className="text-sm text-muted-foreground">{description}</p>

      {/* Ya asignados — agrupados visualmente por chip, sin importar bajo
          qué coordinador/supervisor se hayan agregado */}
      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assignments.map((a) => {
            const surveyor = surveyorById.get(a.surveyorId)
            const supervisor = a.supervisorId ? supervisorById.get(a.supervisorId) : null
            return (
              <Badge key={a.surveyorId} variant="secondary" className="gap-1 pr-1">
                {surveyor?.name || surveyor?.email || a.surveyorId}
                {supervisor?.name && <span className="text-muted-foreground/70">· {supervisor.name}</span>}
                <button
                  type="button"
                  onClick={() => removeAssignment(a.surveyorId)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {/* Cascada: Coordinador -> Supervisor -> Encuestadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select
          value={coordinatorId}
          onValueChange={(v) => { setCoordinatorId(v); setSupervisorId("") }}
        >
          <SelectTrigger>
            <SelectValue placeholder="1. Elegir coordinador..." />
          </SelectTrigger>
          <SelectContent>
            {coordinators.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Sin coordinadores registrados</div>
            )}
            {coordinators.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name || "Sin nombre"}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={supervisorId}
          onValueChange={setSupervisorId}
          disabled={!coordinatorId}
        >
          <SelectTrigger>
            <SelectValue placeholder="2. Elegir supervisor..." />
          </SelectTrigger>
          <SelectContent>
            {coordinatorId && supervisorsForCoordinator.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Este coordinador no tiene supervisores</div>
            )}
            {supervisorsForCoordinator.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name || "Sin nombre"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Encuestadores del supervisor elegido */}
      {supervisorId && (
        <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
          {surveyorsForSupervisor.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-3">Este supervisor no tiene encuestadores a cargo.</p>
          ) : (
            surveyorsForSupervisor.map((s) => (
              <label key={s.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40">
                <Checkbox
                  checked={assignedIds.has(s.id)}
                  onCheckedChange={(checked) => toggleSurveyor(s.id, checked === true)}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name || "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                </div>
              </label>
            ))
          )}
        </div>
      )}

      {!coordinatorId && (
        <p className="text-xs text-muted-foreground italic">
          Elegí un coordinador y un supervisor para ver sus encuestadores.
        </p>
      )}
    </div>
  )
}
