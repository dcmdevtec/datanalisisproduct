"use client"

import { useEffect, useRef, useState } from "react"

const COMMON_DOMAINS = [
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
  "icloud.com", "proton.me", "live.com", "aol.com"
]

export default function EmailAutocompleteInput({
  value,
  onChange,
  placeholder = "",
  className = ""
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [show, setShow] = useState(false)
  const [filtered, setFiltered] = useState<string[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hoveringDropdown = useRef(false)

  // --- Maneja escribir en el input
  const handleInput = (v: string) => {
    onChange(v)

    const atIdx = v.indexOf("@")

    if (atIdx === -1) {
      setShow(false)
      return
    }

    const domainPart = v.slice(atIdx + 1).toLowerCase()

    const list = COMMON_DOMAINS.filter((d) =>
      d.startsWith(domainPart)
    )

    setFiltered(list)
    setShow(true)
  }

  // --- Clic fuera → cerrar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShow(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // --- Blur: NO cerrar si el mouse está sobre el dropdown
  const handleBlur = () => {
    setTimeout(() => {
      if (!hoveringDropdown.current) {
        setShow(false)
      }
    }, 120)
  }

  const applyDomain = (domain: string) => {
    const atIdx = value.indexOf("@")
    if (atIdx === -1) return

    const local = value.slice(0, atIdx)
    onChange(`${local}@${domain}`)
    setShow(false)

    // devolver el foco al input
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={handleBlur}
        className="w-full border rounded-md p-2"
      />

      {show && filtered.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white shadow-lg rounded-md border z-50"
          onMouseEnter={() => (hoveringDropdown.current = true)}
          onMouseLeave={() => (hoveringDropdown.current = false)}
        >
          {filtered.map((domain) => (
            <div
              key={domain}
              onClick={() => applyDomain(domain)}
              className="p-2 cursor-pointer hover:bg-gray-200"
            >
              {value.split("@")[0]}@{domain}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
