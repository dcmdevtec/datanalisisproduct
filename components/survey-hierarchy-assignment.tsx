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
// sistema. Se agregó Coordinador/Supervisor porque el mismo encuestador
// puede caer bajo un supervisor distinto según la encuesta ("pueden haber
// coordinadores en otra encuesta con otros supervisores y otros
// encuestadores"). El coordinador/supervisor elegidos acá se guardan junto
// con cada encuestador seleccionado (ver
// survey_surveyor_zones.coordinator_id/supervisor_id en migration.sql).
//
// Ajuste 08/09/2026: al principio Coordinador/Supervisor FILTRABAN la
// cascada usando el organigrama global de cada usuario
// (surveyors.supervisor_id / users.coordinator_id, el que se fija al
// crear/editar el usuario en Usuarios/Encuestadores) — elegir un
// coordinador solo mostraba los supervisores ya ligados a él desde su
// creación, y elegir un supervisor solo mostraba los encuestadores ya
// ligados a él. Si alguien no se había asociado a otro al crearse (o se
// quería una combinación distinta para ESTA encuesta/proyecto en
// particular), nunca aparecía como opción — justo lo que se pidió evitar:
// "no quiero que se asocien los usuarios a otro [al crearlos], quiero que
// en la creación solo se le asigne el rol, y que al asignar salgan todos
// los supervisores/coordinadores/encuestadores para poder escoger el que
// sea". Ahora Coordinador y Supervisor son selects independientes (todas
// las opciones siempre) que solo quedan como ETIQUETA de referencia junto
// a cada encuestador marcado — no restringen qué encuestadores se pueden
// ver ni elegir.

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

  // Pedido explícito (08/09/2026): la jerarquía global de un usuario
  // (surveyors.supervisor_id / users.coordinator_id, la que se fija al
  // crearlo en Usuarios/Encuestadores) NO debe restringir a quién se puede
  // asignar acá. Antes, elegir un coordinador solo mostraba los supervisores
  // que YA tenían ese coordinador asignado desde su creación, y elegir un
  // supervisor solo mostraba los encuestadores YA ligados a él — si alguien
  // no se había asociado a otro al crearse (o se quería reasignar distinto
  // para ESTA encuesta/proyecto), nunca aparecía como opción. Ahora salen
  // TODOS los supervisores y TODOS los encuestadores siempre, sin importar
  // su jerarquía global — se puede escoger cualquiera para esta encuesta en
  // particular. La jerarquía global sigue precargando el filtro SOLO como
  // atajo cuando existe (ver supervisorsForCoordinator/surveyorsForSupervisor
  // más abajo, ya no filtran, solo listan todo).
  const supervisorsForCoordinator = supervisors
  const surveyorsForSupervisor = surveyors

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

      {/* Coordinador / Supervisor: ahora son solo la ETIQUETA que se guarda
          junto a los encuestadores marcados abajo (para esta encuesta en
          particular) — ya no filtran ni se bloquean entre sí. Se puede
          elegir cualquier combinación, o ninguna. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select
          value={coordinatorId}
          onValueChange={setCoordinatorId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Coordinador (opcional)..." />
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
        >
          <SelectTrigger>
            <SelectValue placeholder="Supervisor (opcional)..." />
          </SelectTrigger>
          <SelectContent>
            {supervisorsForCoordinator.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Sin supervisores registrados</div>
            )}
            {supervisorsForCoordinator.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name || "Sin nombre"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Encuestadores — TODOS, sin importar de quién dependan globalmente;
          marcar uno lo asigna a esta encuesta con el coordinador/supervisor
          elegidos arriba (si se eligió alguno) como referencia. */}
      <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
        {surveyorsForSupervisor.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-3">No hay encuestadores registrados.</p>
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
    </div>
  )
}
