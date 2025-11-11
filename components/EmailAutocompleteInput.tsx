import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

const EMAIL_DOMAINS = [
  "@gmail.com",
  "@outlook.com",
  "@yahoo.com",
  "@hotmail.com",
  "@icloud.com",
  "@protonmail.com",
  "@live.com",
  "@outlook.es",
  "@gmail.es",
  "@yahoo.es",
  "@aol.com",
  "@zoho.com",
  "@yandex.com",
  "@gmx.com",
  "@mail.com",
  "@inbox.com",
  "@educator.com",
  "@usa.com",
  "@asia.com",
  "@europe.com",
  "@dr.com",
  "@engineer.com",
  "@post.com",
  "@consultant.com",
  "@accountant.com",
  "@contractor.com",
  "@cheerful.com",
  "@email.com",
  "@myself.com",
  "@wow.com",
  "@email.net",
  "@email.org",
  "@email.co",
  "@email.info",
  "@email.biz",
  "@email.me",
  "@email.us",
  "@email.ca",
  "@email.eu",
  "@email.asia",
  "@email.uk",
  "@email.de",
  "@email.fr",
  "@email.it",
  "@email.jp",
  "@email.cn",
  "@email.in",
  "@email.ru",
  "@email.br",
  "@email.mx",
  "@email.au",
  "@email.nz",
  "@email.za",
  "@email.ch",
  "@email.se",
  "@email.no",
  "@email.dk",
  "@email.fi",
  "@email.nl",
  "@email.be",
  "@email.at",
  "@email.pl",
  "@email.cz",
  "@email.hu",
  "@email.gr",
  "@email.pt",
  "@email.ie",
  "@email.sg",
  "@email.hk",
  "@email.tw",
  "@email.kr",
  "@email.ph",
  "@email.my",
  "@email.id",
  "@email.vn",
  "@email.th",
  "@email.ae",
  "@email.sa",
  "@email.eg",
  "@email.ng",
  "@email.co.uk",
  "@email.com.au",
  "@email.com.mx",
  "@email.com.br",
  "@email.com.ar",
  "@email.com.co",
  "@email.com.ve",
  "@email.com.pe",
  "@email.com.cl",
  "@email.com.ec",
  "@email.com.gt",
  "@email.com.cr",
  "@email.com.pa",
  "@email.com.uy",
  "@email.com.py",
  "@email.com.bo",
  "@email.com.do",
  "@email.com.sv",
  "@email.com.hn",
  "@email.com.ni",
  "@email.com.cu",
  "@email.com.pr",
  "@email.com.jm",
  "@email.com.tt",
  "@email.com.bb",
  "@email.com.bs",
  "@email.com.bz",
  "@email.com.gd",
  "@email.com.lc",
  "@email.com.vc",
  "@email.com.ag",
  "@email.com.dm",
  "@email.com.kn",
  "@email.com.ai",
  "@email.com.ms",
  "@email.com.vg",
  "@email.com.ky",
  "@email.com.bm",
  "@email.com.tc",
  "@email.com.gp",
  "@email.com.mq",
  "@email.com.gf",
  "@email.com.bl",
  "@email.com.mf",
  "@email.com.sx",
  "@email.com.cw",
  "@email.com.aw",
  "@email.com.sr",
  "@email.com.gy",
  "@email.com.fk",
  "@email.com.sh",
  "@email.com.pm",
  "@email.com.gl",
  "@email.com.fo",
  "@email.com.is",
  "@email.com.je",
  "@email.com.gg",
  "@email.com.im",
  "@email.com.li",
  "@email.com.mc",
  "@email.com.sm",
  "@email.com.va",
  "@email.com.ad",
  "@email.com.mt",
  "@email.com.cy",
  "@email.com.lu",
  "@email.com.ee",
  "@email.com.lv",
  "@email.com.lt",
  "@email.com.bg",
  "@email.com.ro",
  "@email.com.md",
  "@email.com.ua",
  "@email.com.by",
  "@email.com.ge",
  "@email.com.az",
  "@email.com.am",
  "@email.com.kz",
  "@email.com.kg",
  "@email.com.tj",
  "@email.com.tm",
  "@email.com.uz",
  "@email.com.af",
  "@email.com.pk",
  "@email.com.bd",
  "@email.com.lk",
  "@email.com.mv",
  "@email.com.np",
  "@email.com.bt",
  "@email.com.mm",
  "@email.com.la",
  "@email.com.kh",
  "@email.com.vn",
  "@email.com.bn",
  "@email.com.sg",
  "@email.com.tl",
  "@email.com.pg",
  "@email.com.sb",
  "@email.com.vu",
  "@email.com.nc",
  "@email.com.fj",
  "@email.com.ws",
  "@email.com.to",
  "@email.com.nu",
  "@email.com.nr",
  "@email.com.ki",
  "@email.com.mh",
  "@email.com.fm",
  "@email.com.pw",
  "@email.com.gu",
  "@email.com.mp",
  "@email.com.um",
  "@email.com.vi",
  "@email.com.as",
  "@email.com.ck",
  "@email.com.tk",
  "@email.com.tv",
  "@email.com.wf",
  "@email.com.pf",
  "@email.com.pn",
  "@email.com.nf",
  "@email.com.hm",
  "@email.com.gs",
  "@email.com.aq",
  "@email.com.bv",
  "@email.com.tf",
  "@email.com.io",
  "@email.com.cx",
  "@email.com.cc",
];

interface EmailAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const validateEmail = (email: string): boolean => {
  // Expresión regular para validar el formato de email
  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

export const EmailAutocompleteInput: React.FC<EmailAutocompleteInputProps> = ({
  value,
  onChange,
  placeholder,
  className = "",
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hovered, setHovered] = useState(-1);
  const [isValid, setIsValid] = useState(true); // Nuevo estado para la validación

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null); // Ref para el dropdown

  const atIdx = value.indexOf("@");
  const user = atIdx === -1 ? value : value.slice(0, atIdx);
  const domainPart = atIdx === -1 ? "" : value.slice(atIdx);

  // Filtrar sugerencias solo si hay un "@" y se está escribiendo el dominio
  const filtered =
    atIdx !== -1
      ? EMAIL_DOMAINS.filter((d) => d.startsWith(domainPart)).map((d) => user + d)
      : [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log("EmailAutocompleteInput: handleInputChange - newValue:", newValue); // Nuevo log
    onChange(newValue);
    setIsValid(validateEmail(newValue));
    setShowSuggestions(true);
    setHovered(-1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setIsValid(validateEmail(suggestion));
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
      handleSuggestionClick(filtered[hovered]);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      e.preventDefault();
    }
  };

  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      setDropdownRect(inputRef.current.getBoundingClientRect());
    }
  }, [showSuggestions, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  console.log("EmailAutocompleteInput: Render - value:", value, "filtered.length:", filtered.length, "showSuggestions:", showSuggestions); // Nuevo log

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="email"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          setShowSuggestions(true);
          console.log("EmailAutocompleteInput: onFocus - showSuggestions set to true"); // Nuevo log
        }}
        onBlur={() => {
          setTimeout(() => {
            if (dropdownRef.current && !dropdownRef.current.contains(document.activeElement)) {
              setShowSuggestions(false);
              console.log("EmailAutocompleteInput: onBlur - showSuggestions set to false"); // Nuevo log
            }
          }, 100);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-4 py-3 border rounded-lg outline-none transition-all duration-200
          ${isValid ? "border-gray-300 focus:ring-2 focus:ring-blue-500" : "border-red-500 focus:ring-2 focus:ring-red-500"}
          bg-white text-gray-900 shadow-sm
        `}
        autoComplete="off"
      />
      {!isValid && value.length > 0 && (
        <p className="mt-1 text-sm text-red-600">Por favor, introduce un email válido.</p>
      )}

      {showSuggestions && filtered.length > 0 && dropdownRect && typeof window !== "undefined"
        ? createPortal(
            <ul
              ref={dropdownRef}
              className="fixed z-[99999] bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm py-1"
              style={{
                left: dropdownRect.left,
                top: dropdownRect.bottom + window.scrollY + 5,
                width: dropdownRect.width,
              }}
            >
              {filtered.map((suggestion, i) => (
                <li
                  key={suggestion}
                  className={`px-4 py-2 cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150
                    ${hovered === i ? "bg-blue-50 text-blue-700" : "text-gray-800"}
                  `}
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
