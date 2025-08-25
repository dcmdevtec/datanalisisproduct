"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import type { Surveyor } from "@/types/surveyor"
import { supabase } from "@/lib/supabase/browser"





type AssignSurveyorsModalProps = {
  isOpen: boolean
  onClose: () => void
  currentAssignedSurveyorIds: string[] // Array of UUID strings
  onSave: (assignedIds: string[]) => void
}

export function AssignSurveyorsModal({
  isOpen,
  onClose,
  currentAssignedSurveyorIds,
  onSave,
}: AssignSurveyorsModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [allSurveyors, setAllSurveyors] = React.useState<Surveyor[]>([])
  const [selectedSurveyorIds, setSelectedSurveyorIds] = React.useState<string[]>(currentAssignedSurveyorIds)
  const [popoverOpen, setPopoverOpen] = React.useState(false)

 // Initialize browser Supabase client

  React.useEffect(() => {
    const fetchSurveyors = async () => {
      setLoading(true)
      try {
        // Fetch directly from Supabase client-side, as this is a client component
        const { data, error } = await supabase.from("surveyors").select("id, name, email")
        if (error) {
          throw new Error(error.message || "Error al cargar los encuestadores.")
        }
        setAllSurveyors(data)
      } catch (error: any) {
        console.error("Error fetching all surveyors:", error)
        toast({
          title: "Error",
          description: error.message || "No se pudieron cargar los encuestadores disponibles.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (isOpen) {
      fetchSurveyors()
      setSelectedSurveyorIds(currentAssignedSurveyorIds) // Ensure state is synced when modal opens
    }
  }, [isOpen, toast, supabase, currentAssignedSurveyorIds]) // Added supabase and currentAssignedSurveyorIds to dependencies

  const handleSelectSurveyor = (surveyorId: string) => {
    setSelectedSurveyorIds((prev) =>
      prev.includes(surveyorId) ? prev.filter((id) => id !== surveyorId) : [...prev, surveyorId],
    )
  }

  const handleSave = () => {
    onSave(selectedSurveyorIds)
    onClose()
  }

  const getSelectedSurveyorNames = () => {
    return allSurveyors
      .filter((s) => selectedSurveyorIds.includes(s.id))
      .map((s) => s.name)
      .join(", ")
  }

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Cargando encuestadores...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
 <Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Asignar Encuestadores</DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      <Label htmlFor="surveyors">Encuestadores</Label>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={popoverOpen}
            className="w-full justify-between bg-transparent"
          >
            {selectedSurveyorIds.length > 0
              ? getSelectedSurveyorNames() || "Seleccionar encuestador(es)..."
              : "Seleccionar encuestador(es)..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 max-h-[300px] overflow-y-auto">
          <Command>
            <CommandInput placeholder="Buscar encuestador..." />
            <CommandList>
              <CommandEmpty>No se encontraron encuestadores.</CommandEmpty>
              <CommandGroup>
                {allSurveyors.map((surveyor) => (
                  <CommandItem
                    key={surveyor.id}
                    value={surveyor.name}
                    onSelect={() => handleSelectSurveyor(surveyor.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSurveyorIds.includes(surveyor.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {surveyor.name} ({surveyor.email})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>
        Cancelar
      </Button>
      <Button onClick={handleSave}>Guardar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


  )
}
