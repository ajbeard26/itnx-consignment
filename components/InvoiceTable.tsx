import Link from "next/link";
import type { InvoiceStatus } from "@prisma/client";
import { money } from "@/lib/money";
import { shortDate } from "@/lib/dates";
import { INVOICE_STATUS_LABEL, invoiceStatusClass } from "@/lib/invoice-shared";

export type InvoiceRow = {
  id: string;
  reference: string;
  status: InvoiceStatus;
  totalCents: number;
  createdAt: Date;
  dueAt: Date | null;
  customer?: { id: string; name: string } | null;
  consignment?: { id: string; reference: string; title: string } | null;
};

export default function InvoiceTable({
  rows,
  hideCustomer = false,
  hideDeal = false,
}: {
  rows: InvoiceRow[];
  hideCustomer?: boolean;
  hideDeal?: boolean;
}) {
  return (
    <div className="deal-table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Invoice</th>
            {hideCustomer ? null : <th>Customer</th>}
            {hideDeal ? null : <th>Consignment</th>}
            <th>Status</th>
            <th>Total</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="text-link" href={`/invoices/${row.id}`}>
                  {row.reference}
                </Link>
                <div className="muted">{shortDate(row.createdAt)}</div>
              </td>
              {hideCustomer ? null : (
                <td>
                  {row.customer ? (
                    <Link className="text-link" href={`/customers/${row.customer.id}`}>
                      {row.customer.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              {hideDeal ? null : (
                <td>
                  {row.consignment ? (
                    <Link className="text-link" href={`/consignments/${row.consignment.id}?tab=charges`}>
                      {row.consignment.reference}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td>
                <span className={invoiceStatusClass(row.status)}>{INVOICE_STATUS_LABEL[row.status]}</span>
              </td>
              <td className="num">{money(row.totalCents)}</td>
              <td>{row.status === "OPEN" || row.status === "PAID" ? shortDate(row.dueAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
