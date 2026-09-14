import Link from "next/link";
import type { Status } from "@prisma/client";
import StatusBadge from "@/components/StatusBadge";
import { shortDate } from "@/lib/dates";
import { money } from "@/lib/money";

export type DealRow = {
  id: string;
  reference: string;
  title: string;
  customerName: string;
  customerReference?: string | null;
  createdAt: Date;
  listedAt?: Date | null;
  acceptedAt?: Date | null;
  completedAt?: Date | null;
  salePriceCents: number;
  askingPriceCents: number;
  status: Status;
  paid: boolean;
  payoutReference?: string | null;
  photo?: string | null;
};

function dateBits(x: DealRow) {
  const extra = [
    x.completedAt ? { label: "Completed", at: x.completedAt } : null,
    x.acceptedAt ? { label: "Signed", at: x.acceptedAt } : null,
    x.listedAt ? { label: "Listed", at: x.listedAt } : null,
  ].filter(Boolean) as { label: string; at: Date }[];
  const primary = extra[0] || { label: "Opened", at: x.createdAt };
  const rest = extra.length ? [...extra.slice(1), { label: "Opened", at: x.createdAt }] : [];
  return { primary, rest };
}

export default function DealTable({ rows, hideCustomer = false }: { rows: DealRow[]; hideCustomer?: boolean }) {
  return (
    <div className={`deal-table${hideCustomer ? " no-who" : ""}`} role="table">
      <div className="deal-table-head" role="row">
        <span />
        <span>Deal</span>
        {hideCustomer ? null : <span>Customer</span>}
        <span>Dates</span>
        <span className="num">Sale</span>
        <span className="end">Status</span>
      </div>
      {rows.map((x) => {
        const dates = dateBits(x);
        return (
          <Link key={x.id} href={`/consignments/${x.id}`} className="deal-table-row" role="row">
            {x.photo ? (
              <img src={x.photo} alt="" className="deal-thumb" />
            ) : (
              <div className="deal-thumb placeholder">—</div>
            )}
            <div className="deal-table-deal">
              <span className="deal-id-line">{x.reference}</span>
              <strong>{x.title}</strong>
            </div>
            {hideCustomer ? null : (
              <span className="deal-table-who">
                {x.customerReference ? <span className="deal-id-line">{x.customerReference}</span> : null}
                <strong>{x.customerName}</strong>
              </span>
            )}
            <span className="deal-dates">
              <span className="lbl">{dates.primary.label}</span>
              <strong>{shortDate(dates.primary.at)}</strong>
              {dates.rest.length ? (
                <span className="more">
                  {dates.rest.map((item) => `${item.label} ${shortDate(item.at)}`).join(" · ")}
                </span>
              ) : null}
            </span>
            <span className="num">{money(x.salePriceCents || x.askingPriceCents)}</span>
            <span className="end">
              {x.paid ? (
                <span className="badge badge-ok">{x.payoutReference ? `Check ${x.payoutReference}` : "Paid"}</span>
              ) : (
                <StatusBadge status={x.status} />
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function toDealRow(x: {
  id: string;
  reference: string;
  title: string;
  createdAt: Date;
  listedAt?: Date | null;
  acceptedAt?: Date | null;
  completedAt?: Date | null;
  salePriceCents: number;
  askingPriceCents: number;
  status: Status;
  paid: boolean;
  payoutReference?: string | null;
  customer?: { name: string; reference?: string | null };
  images?: { path: string }[];
}): DealRow {
  return {
    id: x.id,
    reference: x.reference,
    title: x.title,
    customerName: x.customer?.name || "",
    customerReference: x.customer?.reference || null,
    createdAt: x.createdAt,
    listedAt: x.listedAt,
    acceptedAt: x.acceptedAt,
    completedAt: x.completedAt,
    salePriceCents: x.salePriceCents,
    askingPriceCents: x.askingPriceCents,
    status: x.status,
    paid: x.paid,
    payoutReference: x.payoutReference,
    photo: x.images?.[0]?.path || null,
  };
}
