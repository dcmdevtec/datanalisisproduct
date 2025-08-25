"use client"

import * as React from "react"
import { Check, ChevronDown, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Zone {
  id: string
  name: string
}

interface MultiSelectZonesProps {
  zones: Zone[]
  selectedZoneIds: string[]
  onSelectionChange: (selectedIds: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export function MultiSelectZones({
  zones,
  selectedZoneIds,
  onSelectionChange,
  placeholder = "Seleccionar zonas...",
  disabled = false,
}: MultiSelectZonesProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")

  const handleSelect = (zoneId: string) => {
    const isSelected = selectedZoneIds.includes(zoneId)
    let newSelection: string[]

    if (isSelected) {
      newSelection = selectedZoneIds.filter((id) => id !== zoneId)
    } else {
      newSelection = [...selectedZoneIds, zoneId]
    }
    onSelectionChange(newSelection)
  }

  const handleRemove = (zoneId: string) => {
    const newSelection = selectedZoneIds.filter((id) => id !== zoneId)
    onSelectionChange(newSelection)
  }

  const selectedZones = zones.filter((zone) => selectedZoneIds.includes(zone.id))
  const filteredZones = zones.filter((zone) => zone.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-[40px] flex-wrap bg-transparent"
        >
          {selectedZones.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedZones.map((zone) => (
                <Badge key={zone.id} variant="secondary" className="flex items-center gap-1">
                  {zone.name}
                  <XCircle
                    className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(zone.id)
                    }}
                  />
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Buscar zona..." value={searchTerm} onValueChange={setSearchTerm} />
          <CommandEmpty>No se encontraron zonas.</CommandEmpty>
          <CommandList>
            <ScrollArea className="h-[200px]">
              <CommandGroup>
                {filteredZones.map((zone) => (
                  <CommandItem
                    key={zone.id}
                    value={zone.name}
                    onSelect={() => {
                      handleSelect(zone.id)
                      setSearchTerm("") // Clear search after selection
                    }}
                    className="flex items-center justify-between"
                  >
                    {zone.name}
                    <Check
                      className={cn("ml-auto h-4 w-4", selectedZoneIds.includes(zone.id) ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
