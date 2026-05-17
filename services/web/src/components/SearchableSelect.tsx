import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

type Props = {
  id?: string;
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export function SearchableSelect({
  id: idProp,
  label,
  options,
  value,
  onChange,
  placeholder = "Type to search...",
  emptyLabel = "No matches",
  disabled = false,
  required = false,
  className,
}: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (selected) {
      setQuery(selected.label);
    } else if (!value) {
      setQuery("");
    }
  }, [selected, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(opt: SelectOption) {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  }

  function onInputChange(next: string) {
    setQuery(next);
    setOpen(true);
    if (!next.trim()) {
      onChange("");
      return;
    }
    const match = options.find((o) => o.label.toLowerCase() === next.trim().toLowerCase());
    if (match) {
      onChange(match.value);
    } else if (value) {
      onChange("");
    }
  }

  return (
    <div className={`field searchable-select${className ? ` ${className}` : ""}`} ref={rootRef}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => {
          if (!disabled) {
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        required={required && !value}
        autoComplete="off"
      />
      {open && !disabled ? (
        <ul id={listId} className="searchable-select__list" role="listbox">
          {filtered.length === 0 ? (
            <li className="searchable-select__empty">{emptyLabel}</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`searchable-select__option${o.value === value ? " searchable-select__option--active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function userSelectOptions(users: { id: number; full_name: string; email: string }[]): SelectOption[] {
  return users.map((u) => ({
    value: String(u.id),
    label: `${u.full_name} (${u.email})`,
  }));
}
