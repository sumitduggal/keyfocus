import { useEffect, useRef, useState } from "react";
import { ICONS } from "../icons";

interface IconPickerProps {
  icon: string;
  label: string;
  onChange: (icon: string) => void;
}

// A small button showing the icon. Clicking it opens a grid of icons to pick from.
export function IconPicker({ icon, label, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    popupRef.current?.focus();
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <span className="habit-more-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="icon-button"
        aria-label={`Change icon for ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
      </button>
      {open && (
        <div
          ref={popupRef}
          className="habit-popup icon-popup"
          role="dialog"
          aria-label="Choose an icon"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            // Close the popup without also sending the global Escape to the command bar.
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            buttonRef.current?.focus();
          }}
        >
          {ICONS.map((option) => (
            <button
              key={option}
              type="button"
              className={option === icon ? "is-selected" : undefined}
              aria-label={`Use ${option}`}
              aria-pressed={option === icon}
              onClick={() => {
                onChange(option);
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
