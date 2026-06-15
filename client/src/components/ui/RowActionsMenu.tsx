import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cls } from "../../lib/styles";

export interface RowActionsMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Optional color: 'danger' (red), 'success' (emerald), default (gray). */
  variant?: "default" | "danger" | "success";
}

const MENU_WIDTH = 144; // matches Tailwind w-36

/**
 * Three-dot row action menu used in list pages.
 *
 * Renders the dropdown into a React portal at <body> so it can escape
 * the table's `overflow-x-auto` wrapper (which would otherwise clip
 * the menu). The menu is positioned with `position: fixed` from the
 * trigger button's bounding rect; it closes on outside click, scroll,
 * or resize so it doesn't float when the page state changes underneath.
 */
export default function RowActionsMenu({ items }: { items: RowActionsMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Right-align under the trigger; clamp so the menu doesn't fall off-screen.
      let left = rect.right - MENU_WIDTH;
      if (left < 8) left = 8;
      if (left + MENU_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - MENU_WIDTH - 8;
      }
      setPos({ top: rect.bottom + 4, left });
    }
    setOpen((v) => !v);
  };

  const variantClass = (v?: string) => {
    if (v === "danger") return "text-red-600 hover:bg-red-50";
    if (v === "success") return "text-emerald-600 hover:bg-emerald-50";
    return "text-gray-700 hover:bg-gray-50";
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={cls.btnIcon}
        title="More actions"
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-36 rounded-md bg-white py-1 text-[13px] shadow-lg ring-1 ring-gray-200"
            style={{ top: pos.top, left: pos.left }}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${variantClass(item.variant)}`}
                >
                  <Icon
                    size={13}
                    className={
                      item.variant === "danger"
                        ? "text-red-600"
                        : item.variant === "success"
                          ? "text-emerald-600"
                          : "text-gray-500"
                    }
                  />
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
