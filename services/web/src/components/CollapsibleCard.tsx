import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
};

export function CollapsibleCard({ title, badge, defaultOpen = false, actions, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card">
      <button
        type="button"
        className="collapsible-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapsible-trigger__left">
          <span className={`collapsible-chevron${open ? " collapsible-chevron--open" : ""}`} aria-hidden>
            ▶
          </span>
          <span className="collapsible-trigger__title">{title}</span>
          {badge !== undefined ? <span className="collapsible-badge">{badge}</span> : null}
        </span>
        {actions ? (
          <span className="collapsible-trigger__actions" onClick={(e) => e.stopPropagation()}>
            {actions}
          </span>
        ) : null}
      </button>
      {open ? <div className="collapsible-body">{children}</div> : null}
    </div>
  );
}
