"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ComboboxProps {
  options: { value: string; label: string }[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  searchPlaceholder?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron resultados.",
  searchPlaceholder = "Buscar...",
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = value ? options.find((option) => option.value === value) : null
  const displayText = selectedOption?.label || placeholder

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-transparent text-left px-3 py-2 h-auto min-h-[40px]"
          disabled={disabled}
        >
          <span className="truncate flex-1 text-left pr-2" title={displayText}>
            {displayText}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="combobox-popover w-[var(--radix-popover-trigger-width)] p-0 z-[100]" 
        align="start"
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-[200px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label} // Use label for search value
                  onSelect={() => {
                    // Directly use option.value for onValueChange
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                  className="cursor-pointer px-2 py-2"
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate flex-1" title={option.label}>
                    {option.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
