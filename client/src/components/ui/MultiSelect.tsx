import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
}

/**
 * Compact checkbox dropdown for multi-select filters.
 * Shows "All" / "<label>" / "N selected" in the trigger.
 */
export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Any",
  searchable = false,
  className = "",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Track both mousedown and touchstart — some mobile WebViews don't
    // fire a synthetic mousedown reliably when the tap lands on a
    // scrollable ancestor, leaving the dropdown stuck open.
    const onDoc = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  // When the dropdown opens inside a scrollable ancestor (e.g. the ticket
  // filter modal's overflow-y-auto body), the menu can extend past the
  // scroller's clip box and become unreachable. Nudge the scroll so the
  // full menu is visible.
  useEffect(() => {
    if (!open || !menuRef.current) return;
    requestAnimationFrame(() => {
      menuRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const label = useMemo(() => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) {
      const o = options.find((o) => o.value === value[0]);
      return o ? o.label : "1 selected";
    }
    return `${value.length} selected`;
  }, [value, options, placeholder]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-left text-[12px] text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          value.length > 0 ? "border-primary-300 bg-primary-50/40 text-primary-700" : ""
        }`}
      >
        <span className="truncate">{label}</span>
        <span className="flex items-center gap-1">
          {value.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13} className="text-gray-400" />
        </span>
      </button>

      {open && (
        <div ref={menuRef} className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          {searchable && (
            <div className="border-b border-gray-100 p-1.5">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded border border-gray-200 py-1 pl-6 pr-2 text-[11px] focus:border-primary-400 focus:outline-none"
                />
              </div>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-400">No options</div>
            ) : (
              filtered.map((o) => {
                const checked = value.includes(o.value);
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-gray-50 ${
                      checked ? "bg-primary-50/60 text-primary-700" : "text-gray-700"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-primary-600 bg-primary-600 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {checked && <Check size={9} strokeWidth={4} />}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {value.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-2 py-1.5">
              <span className="text-[10px] text-gray-500">{value.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-medium text-primary-600 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
