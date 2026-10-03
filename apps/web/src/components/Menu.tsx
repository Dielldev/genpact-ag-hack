import { useEffect, useRef, useState, type ReactNode } from "react";

interface MenuProps {
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  placement?: "down" | "up";
  className?: string;
}

export function Menu({ trigger, children, align = "right", placement = "down", className = "" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="menu-anchor" ref={ref}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && <div className={`menu menu-${align} menu-${placement} ${className}`} role="menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}
