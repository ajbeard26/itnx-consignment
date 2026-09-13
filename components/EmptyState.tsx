import Link from "next/link";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export default function EmptyState({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden><Inbox size={22} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {href && action ? (
        <Link className="button" href={href}>
          {action}
        </Link>
      ) : null}
    </div>
  );
}
