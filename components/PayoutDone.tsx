import type { Method } from "@prisma/client";
import { money } from "@/lib/money";
import { METHOD_LABEL } from "@/lib/labels";
import { checkRunLabelForSale, mailingLines, payableTo, type ConsignorMailing } from "@/lib/payout";
import { prettyPhone } from "@/lib/phone";

function when(value?: Date | string | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Detroit",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PayoutDone({
  reference,
  title,
  method,
  paid,
  payoutReference,
  acceptedAt,
  acceptedName,
  amountCents,
  consignor,
}: {
  reference: string;
  title: string;
  method: Method;
  paid: boolean;
  payoutReference?: string | null;
  acceptedAt?: Date | string | null;
  acceptedName?: string | null;
  amountCents: number;
  consignor: ConsignorMailing & { payoutPhone?: string | null; phone?: string | null };
}) {
  const how = method === "ACH" || method === "CASH" ? method : "CHECK";
  const processOn = checkRunLabelForSale(acceptedAt);
  const mail = mailingLines(consignor);
  const payee = payableTo(consignor);
  const phone = prettyPhone(consignor.payoutPhone || consignor.phone);
  const sentLabel = how === "CHECK" ? "Sent" : how === "ACH" ? "Sent" : "Paid";
  const headline = paid
    ? how === "CHECK"
      ? "Your check is on the way"
      : how === "ACH"
        ? "Your transfer is on the way"
        : "You’re paid"
    : "You’re all set";
  const kicker = paid ? sentLabel : "Signed";
  const lead = paid
    ? how === "CHECK"
      ? payoutReference
        ? `Check ${payoutReference} has been issued for this payout.`
        : "Your check has been issued and is on the way."
      : how === "ACH"
        ? "The bank transfer for this payout has been sent."
        : "This payout was recorded as paid in cash."
    : acceptedName
      ? `Thanks, ${acceptedName.split(" ")[0]}. Your payout authorization is on file.`
      : "Your payout authorization is on file.";

  const steps = [
    {
      label: "Signed",
      detail: when(acceptedAt) || "Authorization recorded",
      on: true,
    },
    how === "CASH"
      ? {
          label: paid ? "Paid" : "Pickup",
          detail: paid ? "Cash payout recorded" : "Paid in person when you collect",
          on: paid,
        }
      : {
          label: paid ? "Processed" : "Scheduled",
          detail: paid ? processOn : `Normally processed ${processOn}`,
          on: paid,
        },
    how === "CASH"
      ? null
      : {
          label: sentLabel,
          detail: paid
            ? how === "CHECK"
              ? payoutReference
                ? `Check ${payoutReference}`
                : "Check mailed"
              : payoutReference
                ? `ACH ${payoutReference}`
                : "Transfer sent"
            : how === "CHECK"
              ? "We’ll mark this sent when the check is mailed"
              : "We’ll mark this sent when the transfer goes out",
          on: paid,
        },
  ].filter(Boolean) as Array<{ label: string; detail: string; on: boolean }>;

  return (
    <div className="portal-done">
      <div className="portal-title">
        <div>
          <p className="kicker">{kicker}</p>
          <h1>{headline}</h1>
        </div>
        <span className="portal-id">ID# {reference}</span>
      </div>
      <p className="portal-lead">{lead}</p>

      <div className="payout-receive">
        <span>You receive</span>
        <b>{money(amountCents)}</b>
        <small>
          {METHOD_LABEL[how]}
          {!paid && how === "CHECK" ? ` · ${processOn}` : ""}
        </small>
      </div>

      <ol className="payout-steps">
        {steps.map((step) => (
          <li key={step.label} className={step.on ? "on" : undefined}>
            <span className="payout-dot" aria-hidden />
            <div>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
          </li>
        ))}
      </ol>

      {title ? <p className="payout-item">{title}</p> : null}

      {how === "CHECK" && (payee || mail.length) ? (
        <p className="payout-mail">
          <strong>Mail to</strong>
          {payee}
          {mail.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {phone ? <span>{phone}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
