"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Surveyor {
  id: string
  name: string | null
  email: string
}

interface ZoneSurveyorAssignmentProps {
  zoneId: string
  zoneName: string
  allSurveyors: Surveyor[]
  assignedSurveyorIds: string[]
  onAssignmentChange: (zoneId: string, newAssignedSurveyorIds: string[]) => void
}

export function ZoneSurveyorAssignment({
  zoneId,
  zoneName,
  allSurveyors,
  assignedSurveyorIds,
  onAssignmentChange,
}: ZoneSurveyorAssignmentProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedSurveyors, setSelectedSurveyors] = React.useState<string[]>(assignedSurveyorIds)
  const [searchTerm, setSearchTerm] = React.useState("")

  React.useEffect(() => {
    setSelectedSurveyors(assignedSurveyorIds)
  }, [assignedSurveyorIds])

  const handleSelect = (surveyorId: string) => {
    let newSelection: string[]
    if (selectedSurveyors.includes(surveyorId)) {
      newSelection = selectedSurveyors.filter((id) => id !== surveyorId)
    } else {
      newSelection = [...selectedSurveyors, surveyorId]
    }
    setSelectedSurveyors(newSelection)
    onAssignmentChange(zoneId, newSelection)
  }

  const filteredSurveyors = allSurveyors.filter(
    (surveyor) =>
      surveyor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      surveyor.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const displaySelectedSurveyors = selectedSurveyors
    .map((id) => allSurveyors.find((s) => s.id === id)?.name || allSurveyors.find((s) => s.id === id)?.email)
    .filter(Boolean) as string[]

  return (
    <div className="border rounded-md p-4 space-y-3 bg-background">
      <h4 className="text-md font-semibold flex items-center gap-2">
        <span className="text-primary">Zona:</span> {zoneName}
      </h4>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[40px] flex-wrap bg-transparent"
          >
            {selectedSurveyors.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {displaySelectedSurveyors.map((name, index) => (
                  <Badge key={index} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            ) : (
              "Asignar encuestadores..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar encuestador..." value={searchTerm} onValueChange={setSearchTerm} />
            <CommandList>
              <CommandEmpty>No se encontraron encuestadores.</CommandEmpty>
              <CommandGroup>
                {filteredSurveyors.map((surveyor) => (
                  <CommandItem
                    key={surveyor.id}
                    value={surveyor.name || surveyor.email}
                    onSelect={() => handleSelect(surveyor.id)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSurveyors.includes(surveyor.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        {surveyor.name
                          ? surveyor.name.substring(0, 2).toUpperCase()
                          : surveyor.email.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{surveyor.name || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">{surveyor.email}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
