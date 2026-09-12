import Link from "next/link";

export type LogItem = {
  id: string;
  tone: "in" | "out" | "fail";
  kicker: string;
  title: string;
  body?: string;
  meta: string;
  href?: string | null;
};

export default function MessageLog({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: LogItem[];
}) {
  return (
    <section className="card panel log-card">
      <div className="section-head">
        <h2>{title}</h2>
        <span className="muted">{items.length ? `${items.length} recent` : ""}</span>
      </div>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="msg-log">
          {items.map((item) => (
            <article key={item.id} className={`msg-row ${item.tone}`}>
              <span className={`badge ${item.tone === "fail" ? "badge-warn" : item.tone === "in" ? "badge-info" : "badge-ok"}`}>
                {item.kicker}
              </span>
              <div className="msg-copy">
                <div className="msg-title">
                  {item.href ? (
                    <Link className="text-link" href={item.href}>
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </div>
                {item.body ? <p>{item.body}</p> : null}
                <small>{item.meta}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
