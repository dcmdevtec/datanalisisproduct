"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { createPortal } from "react-dom"

interface EmailAutocompleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

const COMMON_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "aol.com", "icloud.com"]

export function EmailAutocompleteInput({ value, onChange, ...props }: EmailAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dropdownStyles, setDropdownStyles] = useState<React.CSSProperties | null>(null)
  const portalRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (value.includes("@")) {
      const [localPart, domainPart] = value.split("@")
      if (domainPart) {
        const filteredDomains = COMMON_DOMAINS.filter(domain =>
          domain.startsWith(domainPart)
        )
        setSuggestions(filteredDomains.map(domain => `${localPart}@${domain}`))
      } else {
        setSuggestions(COMMON_DOMAINS.map(domain => `${localPart}@${domain}`))
      }
    } else {
      setSuggestions([])
    }
    setActiveSuggestion(0)
  }, [value])

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
      <Input
        ref={inputRef}
        type="email"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={`suggestion-${activeSuggestion}`}
        {...props}
      />

      {portalRef.current && suggestions.length > 0 && dropdownStyles
        ? createPortal(
            <ul
              id={listboxId}
              role="listbox"
              style={dropdownStyles}
              className="bg-background border rounded-b-md shadow-lg max-h-60 overflow-auto"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  id={`suggestion-${index}`}
                  role="option"
                  aria-selected={index === activeSuggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setActiveSuggestion(index)}
                  className={`p-2 cursor-pointer hover:bg-muted ${
                    index === activeSuggestion ? "bg-muted" : ""
                  }`}
                >
                  {suggestion}
                </li>
              ))}
            </ul>,
            portalRef.current,
          )
        : null}
    </div>
  )
}