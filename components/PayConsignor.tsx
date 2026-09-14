import Link from "next/link";
import type { Method } from "@prisma/client";
import { paid } from "@/app/consignments/[id]/actions";
import { METHOD_HINT, METHOD_LABEL, PAY_REF } from "@/lib/labels";
import { money } from "@/lib/money";
import { bankLine, mailingLines, mailingReady, payableTo, payoutReadyFor, checkRunLabelForSale, type ConsignorMailing } from "@/lib/payout";

export default function PayConsignor({
  id,
  amountCents,
  method,
  paid: isPaid,
  payoutReference,
  consignor,
  finalizedAt,
}: {
  id: string;
  amountCents: number;
  method: Method;
  paid: boolean;
  payoutReference?: string | null;
  consignor: ConsignorMailing;
  finalizedAt?: Date | string | null;
}) {
  const how = method === "ACH" || method === "CASH" ? method : "CHECK";
  const payee = payableTo(consignor);
  const mail = mailingLines(consignor);
  const bank = bankLine(consignor);
  const ready = payoutReadyFor(how, consignor);
  const ref = PAY_REF[how];
  const printHref = `/consignments/${id}/check`;
  const printLabel = how === "CHECK" ? "Print check request" : "Print payout slip";
  const mailOn = how === "CHECK" ? checkRunLabelForSale(finalizedAt) : "";

  return (
    <section className="account-section">
      <div className="account-section-head">
        <div>
          <h2>Pay consignor {money(amountCents)}</h2>
          <p className="muted">{METHOD_HINT[how]}</p>
        </div>
        <Link className="edit-btn" href={printHref}>
          {printLabel}
        </Link>
      </div>

      <div className={`payout-callout ${how.toLowerCase()}`}>
        <strong>{METHOD_LABEL[how]}</strong>
        <p>
          {how === "CHECK"
            ? ready
              ? `Normally processed ${mailOn}. Print the request for the bank. Arrival can move for weekends, holidays, or uncleared funds.`
              : "Need a payable-to name and mailing address before you take this to the bank."
            : how === "ACH"
              ? ready
                ? "Confirm the bank name and last four, then record the ACH confirmation."
                : "Need bank name and account last 4 on file."
              : "Paid in person. Record who received the cash."}
        </p>
      </div>

      <dl className="fact-grid pay-facts">
        <div className="full">
          <dt>{how === "CHECK" ? "Pay to the order of" : "Pay to"}</dt>
          <dd>{payee || "—"}</dd>
        </div>
        {how === "CHECK" ? (
          <>
            <div>
              <dt>Process on</dt>
              <dd>{mailOn}</dd>
            </div>
            <div className="full">
              <dt>Mail to</dt>
              <dd>
                {mail.length ? (
                  mail.map((line) => (
                    <span key={line} className="addr-line">
                      {line}
                    </span>
                  ))
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </>
        ) : null}
        {how === "ACH" ? (
          <div className="full">
            <dt>Bank</dt>
            <dd>{bank || "—"}</dd>
          </div>
        ) : null}
        {how === "CASH" ? (
          <div className="full">
            <dt>Pickup</dt>
            <dd>In person. No check is mailed.</dd>
          </div>
        ) : null}
      </dl>

      {!mailingReady(consignor) && how === "CHECK" ? (
        <p className="form-error">Mailing is incomplete. Send the payout page so they can add the address.</p>
      ) : null}
      {how === "ACH" && !bank ? (
        <p className="form-error">Bank details are missing. Send the payout page so they can add them.</p>
      ) : null}

      {!isPaid ? (
        <form action={paid.bind(null, id)}>
          <div className="field">
            <label>{ref.label}</label>
            <input name="ref" placeholder={ref.placeholder} />
          </div>
          <div className="form-actions wrap">
            <button className="button" type="submit">
              Mark paid
            </button>
            <Link className="button ghost" href={printHref}>
              {printLabel}
            </Link>
          </div>
        </form>
      ) : (
        <>
          <p className="muted">
            Paid
            {payoutReference
              ? how === "CHECK"
                ? ` · Check ${payoutReference}`
                : how === "ACH"
                  ? ` · ACH ${payoutReference}`
                  : ` · ${payoutReference}`
              : ""}
            . This deal is archived. Change the status to move it back to Active.
          </p>
          <div className="form-actions">
            <Link className="button ghost" href={printHref}>
              {printLabel}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
