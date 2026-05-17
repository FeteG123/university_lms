import type { ReactNode } from "react";

type Props = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function CardSection({ title, action, children }: Props) {
  return (
    <div className="card card-section">
      <div className="card-section__header">
        <h2 className="card-section__title">{title}</h2>
        {action ? <div className="card-section__actions">{action}</div> : null}
      </div>
      <div className="card-section__body">{children}</div>
    </div>
  );
}
