"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { createPortal } from "react-dom"

interface EmailAutocompleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  domainSelector?: boolean
}

const COMMON_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "proton.me",
  "yahoo.es",
  "gmail.com.co",
  "hotmail.es",
  "outlook.es",
]

export function EmailAutocompleteInput({ value, onChange, domainSelector = false, ...props }: EmailAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dropdownStyles, setDropdownStyles] = useState<React.CSSProperties | null>(null)
  const portalRef = useRef<HTMLElement | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused || !value) {
      setSuggestions([])
      return
    }

    if (value.includes("@")) {
      // Usuario escribió "@" — filtrar por lo que escribió después
      const atIdx = value.indexOf("@")
      const localPart = value.substring(0, atIdx)
      const domainPart = value.substring(atIdx + 1)

      if (!localPart) {
        setSuggestions([])
        return
      }

      const filtered = domainPart.length > 0
        ? COMMON_DOMAINS.filter(d => d.startsWith(domainPart))
        : COMMON_DOMAINS

      setSuggestions(filtered.map(d => `${localPart}@${d}`))
    } else if (value.length >= 2) {
      // Usuario escribe la parte local — sugerir con todos los dominios
      setSuggestions(COMMON_DOMAINS.map(d => `${value}@${d}`))
    } else {
      setSuggestions([])
    }
    setActiveSuggestion(0)
  }, [value, isFocused])

  // Create or reuse a portal container on mount
  useEffect(() => {
    if (typeof document === "undefined") return
    let container = document.getElementById("email-autocomplete-portal") as HTMLElement | null
    if (!container) {
      container = document.createElement("div")
      container.id = "email-autocomplete-portal"
      document.body.appendChild(container)
    }
    portalRef.current = container

    return () => {
      // keep container (other instances might use it); do not remove
      portalRef.current = null
    }
  }, [])

  // Position the dropdown relative to the input using getBoundingClientRect
  const updateDropdownPosition = () => {
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropdownStyles({
      position: "absolute",
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      zIndex: 9999,
    })
  }

  useEffect(() => {
    if (suggestions.length === 0) {
      setDropdownStyles(null)
      return
    }
    updateDropdownPosition()
    window.addEventListener("resize", updateDropdownPosition)
    window.addEventListener("scroll", updateDropdownPosition, true)
    return () => {
      window.removeEventListener("resize", updateDropdownPosition)
      window.removeEventListener("scroll", updateDropdownPosition, true)
    }
  }, [suggestions])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (!inputRef.current) return
      if (portalRef.current && portalRef.current.contains(target)) {
        // clicked inside portal
        return
      }
      if (inputRef.current.contains(target)) return
      setSuggestions([])
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

  const handleSuggestionClick = (suggestion: string) => {
    const syntheticEvent = {
      target: { value: suggestion, name: props.name || "email" },
    } as React.ChangeEvent<HTMLInputElement>
    onChange(syntheticEvent)
    setSuggestions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveSuggestion(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveSuggestion(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[activeSuggestion]) {
        e.preventDefault()
        handleSuggestionClick(suggestions[activeSuggestion])
      }
    } else if (e.key === "Escape") {
      setSuggestions([])
    }
  }

  const listboxId = "email-suggestions"

  return (
    <div className="relative">
      <div className={`flex ${domainSelector ? 'items-stretch' : ''}`}>
        <Input
          ref={inputRef}
          type="text"
          inputMode="email"
          autoComplete="off"
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Pequeño delay para permitir el click en la sugerencia
            setTimeout(() => setIsFocused(false), 150)
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={`suggestion-${activeSuggestion}`}
          {...props}
        />
        {domainSelector && (
          <select
            className="border-l px-2 bg-white text-sm"
            onChange={(e) => {
              const domain = e.target.value
              if (!domain) return
              const local = value.includes('@') ? value.split('@')[0] : value
              const syntheticEvent = { target: { value: `${local}@${domain}`, name: props.name || 'email' } } as React.ChangeEvent<HTMLInputElement>
              onChange(syntheticEvent)
            }}
            value={""}
          >
            <option value="">@dominio</option>
            {COMMON_DOMAINS.map((d) => (
              <option key={d} value={d}>@{d}</option>
            ))}
          </select>
        )}
      </div>

      {portalRef.current && suggestions.length > 0 && dropdownStyles
        ? createPortal(
            <ul
              id={listboxId}
              role="listbox"
              style={dropdownStyles}
              className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-auto py-1"
            >
              {suggestions.map((suggestion, index) => {
                // Resaltar la parte del dominio visualmente
                const atIdx = suggestion.indexOf("@")
                const local = suggestion.substring(0, atIdx + 1)
                const domain = suggestion.substring(atIdx + 1)
                return (
                  <li
                    key={suggestion}
                    id={`suggestion-${index}`}
                    role="option"
                    aria-selected={index === activeSuggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    className={`px-3 py-2 cursor-pointer text-sm flex items-center gap-0 transition-colors ${
                      index === activeSuggestion
                        ? "bg-teal-50 text-teal-900"
                        : "hover:bg-gray-50 text-gray-800"
                    }`}
                  >
                    <span className="text-gray-500">{local}</span>
                    <span className={`font-semibold ${index === activeSuggestion ? "text-teal-700" : "text-gray-700"}`}>
                      {domain}
                    </span>
                  </li>
                )
              })}
            </ul>,
            portalRef.current,
          )
        : null}
    </div>
  )
}