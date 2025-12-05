"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getNeighborhoods, type Neighborhood } from "@/lib/get-neighborhoods"

interface NeighborhoodComboboxProps {
    selectedNeighborhoods: string[]
    onNeighborhoodSelect: (neighborhoods: string[]) => void
    placeholder?: string
}

export function NeighborhoodCombobox({
    selectedNeighborhoods,
    onNeighborhoodSelect,
    placeholder = "Buscar barrio...",
}: NeighborhoodComboboxProps) {
    const [searchValue, setSearchValue] = React.useState("")
    const [showDropdown, setShowDropdown] = React.useState(false)
    const neighborhoods = React.useMemo(() => getNeighborhoods(), [])
    const inputRef = React.useRef<HTMLInputElement>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    const handleSelect = (neighborhoodName: string) => {
        const isSelected = selectedNeighborhoods.includes(neighborhoodName)

        if (isSelected) {
            // Deseleccionar
            onNeighborhoodSelect(selectedNeighborhoods.filter((n) => n !== neighborhoodName))
        } else {
            // Seleccionar
            onNeighborhoodSelect([...selectedNeighborhoods, neighborhoodName])
        }

        // Limpiar búsqueda y mantener foco
        setSearchValue("")
        inputRef.current?.focus()
    }

    const filteredNeighborhoods = React.useMemo(() => {
        if (!searchValue) return neighborhoods.slice(0, 50) // Mostrar solo primeros 50 si no hay búsqueda

        const search = searchValue.toLowerCase()
        return neighborhoods.filter(
            (n) =>
                n.nombre.toLowerCase().includes(search) ||
                n.localidad.toLowerCase().includes(search)
        ).slice(0, 50) // Limitar resultados
    }, [neighborhoods, searchValue])

    // Cerrar dropdown al hacer click fuera
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className="relative w-full">
            <Input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                className="w-full"
            />

            {showDropdown && (
                <div
                    ref={dropdownRef}
                    className="absolute z-[9999] w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-hidden"
                >
                    <ScrollArea className="h-full max-h-[300px]">
                        {filteredNeighborhoods.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                                No se encontraron barrios
                            </div>
                        ) : (
                            <div className="p-1">
                                {filteredNeighborhoods.map((neighborhood) => {
                                    const isSelected = selectedNeighborhoods.includes(neighborhood.nombre)

                                    return (
                                        <div
                                            key={neighborhood.nombre}
                                            onClick={() => handleSelect(neighborhood.nombre)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 cursor-pointer rounded-sm hover:bg-accent transition-colors",
                                                isSelected && "bg-accent/50"
                                            )}
                                        >
                                            <div className="flex items-center justify-center w-4 h-4">
                                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <span className="font-medium text-sm">{neighborhood.nombre}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {neighborhood.localidad}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            )}
        </div>
    )
}
