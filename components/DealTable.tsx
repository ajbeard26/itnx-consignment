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
  createdAt: Date;
  acceptedAt?: Date | null;
  salePriceCents: number;
  askingPriceCents: number;
  status: Status;
  paid: boolean;
  payoutReference?: string | null;
  photo?: string | null;
};

export default function DealTable({ rows, hideCustomer = false }: { rows: DealRow[]; hideCustomer?: boolean }) {
  return (
    <div className={`deal-table${hideCustomer ? " no-who" : ""}`} role="table">
      <div className="deal-table-head" role="row">
        <span />
        <span>Deal</span>
        {hideCustomer ? null : <span>Customer</span>}
        <span>Opened</span>
        <span>Signed</span>
        <span className="num">Sale</span>
        <span className="end">Status</span>
      </div>
      {rows.map((x) => (
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
          {hideCustomer ? null : <span className="deal-table-who">{x.customerName}</span>}
          <span className="when">{shortDate(x.createdAt)}</span>
          <span className="when">{shortDate(x.acceptedAt)}</span>
          <span className="num">{money(x.salePriceCents || x.askingPriceCents)}</span>
          <span className="end">
            {x.paid ? (
              <span className="badge badge-ok">{x.payoutReference ? `Check ${x.payoutReference}` : "Paid"}</span>
            ) : (
              <StatusBadge status={x.status} />
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function toDealRow(x: {
  id: string;
  reference: string;
  title: string;
  createdAt: Date;
  acceptedAt?: Date | null;
  salePriceCents: number;
  askingPriceCents: number;
  status: Status;
  paid: boolean;
  payoutReference?: string | null;
  customer?: { name: string };
  images?: { path: string }[];
}): DealRow {
  return {
    id: x.id,
    reference: x.reference,
    title: x.title,
    customerName: x.customer?.name || "",
    createdAt: x.createdAt,
    acceptedAt: x.acceptedAt,
    salePriceCents: x.salePriceCents,
    askingPriceCents: x.askingPriceCents,
    status: x.status,
    paid: x.paid,
    payoutReference: x.payoutReference,
    photo: x.images?.[0]?.path || null,
  };
}
