import type { ReactNode } from "react";
import { CollapsibleCard } from "./CollapsibleCard";

type Props = {
  title: string;
  badge?: string | number;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Course block: flat section for students, collapsible for staff. */
export function CourseSection({
  title,
  badge,
  actions,
  collapsible = true,
  defaultOpen = false,
  children,
}: Props) {
  if (collapsible) {
    return (
      <CollapsibleCard title={title} badge={badge} defaultOpen={defaultOpen} actions={actions}>
        {children}
      </CollapsibleCard>
    );
  }

  return (
    <div className="card course-section">
      <div className="course-section__header">
        <div className="course-section__heading">
          <h2 className="course-section__title">{title}</h2>
          {badge !== undefined ? <span className="collapsible-badge">{badge}</span> : null}
        </div>
        {actions ? <div className="course-section__actions">{actions}</div> : null}
      </div>
      <div className="course-section__body">{children}</div>
    </div>
  );
}
