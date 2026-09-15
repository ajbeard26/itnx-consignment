import Link from "next/link";
import type { Method } from "@prisma/client";
import { paid } from "@/app/consignments/[id]/actions";
import { METHOD_LABEL, PAY_REF } from "@/lib/labels";
import { money } from "@/lib/money";
import { shortDate } from "@/lib/dates";
import { bankLine, mailingLines, payableTo, payoutReadyFor, checkRunLabelForSale, type ConsignorMailing } from "@/lib/payout";

function PrintActions({
  id,
  how,
  ghost = false,
}: {
  id: string;
  how: Method;
  ghost?: boolean;
}) {
  const printHref = `/consignments/${id}/check`;
  const stockHref = `/consignments/${id}/stock`;
  if (how === "CHECK") {
    return (
      <>
        <Link className={ghost ? "button ghost" : "button"} href={stockHref}>
          Print check
        </Link>
        <Link className="button ghost" href={printHref}>
          Print statement
        </Link>
      </>
    );
  }
  return (
    <Link className={ghost ? "button ghost" : "button"} href={printHref}>
      Print payout slip
    </Link>
  );
}

export default function PayConsignor({
  id,
  amountCents,
  method,
  paid: isPaid,
  payoutReference,
  consignor,
  finalizedAt,
  completedAt,
}: {
  id: string;
  amountCents: number;
  method: Method;
  paid: boolean;
  payoutReference?: string | null;
  consignor: ConsignorMailing;
  finalizedAt?: Date | string | null;
  completedAt?: Date | string | null;
}) {
  const how = method === "ACH" || method === "CASH" ? method : "CHECK";
  const payee = payableTo(consignor);
  const mail = mailingLines(consignor);
  const bank = bankLine(consignor);
  const ready = payoutReadyFor(how, consignor);
  const ref = PAY_REF[how];
  const mailOn = how === "CHECK" ? checkRunLabelForSale(finalizedAt) : "";
  const paidRef =
    payoutReference
      ? how === "CHECK"
        ? `Check ${payoutReference}`
        : how === "ACH"
          ? `ACH ${payoutReference}`
          : payoutReference
      : "";
  const summary = isPaid
    ? [paidRef || METHOD_LABEL[how], payee, completedAt ? `Completed ${shortDate(completedAt)}` : ""]
        .filter(Boolean)
        .join(" · ")
    : [METHOD_LABEL[how], payee || "Needs payee", how === "CHECK" && mailOn ? `Process ${mailOn}` : ""]
        .filter(Boolean)
        .join(" · ");
  const markLabel = how === "CHECK" ? "Mark check sent" : how === "ACH" ? "Mark transfer sent" : "Mark paid";

  return (
    <section className={`pay-board${isPaid ? " is-paid" : " is-due"}`}>
      <div className="pay-board-head">
        <div>
          <span className="pay-flag">{isPaid ? "Paid" : "To pay"}</span>
          <p className="pay-amt">{money(amountCents)}</p>
          <p className="pay-line">{summary}</p>
        </div>
        {!isPaid ? (
          <div className="pay-board-actions">
            <PrintActions id={id} how={how} />
          </div>
        ) : null}
      </div>

      <dl className="pay-details">
        <div>
          <dt>{how === "CHECK" ? "Pay to the order of" : "Pay to"}</dt>
          <dd>{payee || "—"}</dd>
        </div>
        {how === "CHECK" ? (
          <div>
            <dt>Mail to</dt>
            <dd>
              {mail.length
                ? mail.map((line) => (
                    <span key={line} className="addr-line">
                      {line}
                    </span>
                  ))
                : "—"}
            </dd>
          </div>
        ) : null}
        {how === "ACH" ? (
          <div>
            <dt>Bank</dt>
            <dd>{bank || "—"}</dd>
          </div>
        ) : null}
        {how === "CASH" ? (
          <div>
            <dt>Pickup</dt>
            <dd>In person</dd>
          </div>
        ) : null}
        {isPaid ? (
          <div>
            <dt>Completed</dt>
            <dd>{shortDate(completedAt)}</dd>
          </div>
        ) : how === "CHECK" && mailOn ? (
          <div>
            <dt>Process on</dt>
            <dd>{mailOn}</dd>
          </div>
        ) : null}
        {isPaid && paidRef ? (
          <div>
            <dt>{how === "CHECK" ? "Check number" : how === "ACH" ? "Confirmation" : "Note"}</dt>
            <dd>{paidRef.replace(/^(Check|ACH)\s/, "")}</dd>
          </div>
        ) : null}
      </dl>

      {!ready && how === "CHECK" ? (
        <p className="form-error">Mailing is incomplete. Send the payout page so they can add the address.</p>
      ) : null}
      {how === "ACH" && !bank ? (
        <p className="form-error">Bank details are missing. Send the payout page so they can add them.</p>
      ) : null}

      {!isPaid ? (
        <form action={paid.bind(null, id)} className="pay-mark">
          <div className="field">
            <label>{ref.label}</label>
            <input name="ref" placeholder={ref.placeholder} />
          </div>
          <button className="button" type="submit">
            {markLabel}
          </button>
          {how !== "CASH" ? (
            <p className="muted pay-mark-note">Emails them that the payout is on the way.</p>
          ) : null}
        </form>
      ) : (
        <details className="pay-reissue">
          <summary>Reissue / reprint</summary>
          <div className="pay-board-actions">
            <PrintActions id={id} how={how} ghost />
          </div>
        </details>
      )}
    </section>
  );
}
