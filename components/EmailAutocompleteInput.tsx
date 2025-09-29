import React, { useState } from "react";
import { createPortal } from "react-dom";

const EMAIL_DOMAINS = [
  "@gmail.com",
  "@outlook.com",
  "@yahoo.com",
  "@hotmail.com",
  "@icloud.com",
  "@protonmail.com",
  "@live.com",
];

interface EmailAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const EmailAutocompleteInput: React.FC<EmailAutocompleteInputProps> = ({
  value,
  onChange,
  placeholder,
  className = "",
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hovered, setHovered] = useState(-1);

  const atIdx = value.indexOf("@");
  const user = atIdx === -1 ? value : value.slice(0, atIdx);
  const domainPart = atIdx === -1 ? "" : value.slice(atIdx);

  const filtered =
    user && !domainPart
      ? EMAIL_DOMAINS.map((d) => user + d)
      : EMAIL_DOMAINS.filter((d) => d.startsWith(domainPart)).map((d) => user + d);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
    setHovered(-1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      setHovered((h) => (h + 1) % filtered.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHovered((h) => (h - 1 + filtered.length) % filtered.length);
      e.preventDefault();
    } else if (e.key === "Enter" && hovered >= 0) {
      onChange(filtered[hovered]);
      setShowSuggestions(false);
      e.preventDefault();
    }
  };

  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (showSuggestions && inputRef.current) {
      setDropdownRect(inputRef.current.getBoundingClientRect());
    }
  }, [showSuggestions, value]);

  return (
    <div className={`relative ${className}`}> 
      <input
        ref={inputRef}
        type="email"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded outline-none focus:ring"
  autoComplete="new-password"
      />
      {showSuggestions && filtered.length > 0 && dropdownRect && typeof window !== "undefined"
        ? createPortal(
            <ul
              className="fixed z-[99999] bg-white border rounded shadow max-h-40 overflow-auto text-sm"
              style={{
                left: dropdownRect.left,
                top: dropdownRect.bottom + window.scrollY,
                width: dropdownRect.width,
              }}
            >
              {filtered.map((suggestion, i) => (
                <li
                  key={suggestion}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${hovered === i ? "bg-gray-100" : ""}`}
                  onMouseDown={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setHovered(i)}
                >
                  {suggestion}
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
};
