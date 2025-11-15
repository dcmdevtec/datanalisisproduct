"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface EmailAutocompleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

const COMMON_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "aol.com", "icloud.com"]

export function EmailAutocompleteInput({ value, onChange, ...props }: EmailAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeSuggestion, setActiveSuggestion] = useState(0)

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
      {suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 w-full bg-background border border-t-0 rounded-b-md shadow-lg"
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
        </ul>
      )}
    </div>
  )
}