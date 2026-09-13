"use client";

import AddressFields from "@/components/AddressFields";
import { METHOD_HINT, METHOD_LABEL } from "@/lib/labels";

export default function PayoutMethodFields({
  method = "CHECK",
  checkPayableTo = "",
  bankName = "",
  accountLast4 = "",
  street = "",
  city = "",
  state = "",
  zip = "",
  alreadyVerified = false,
}: {
  method?: string;
  checkPayableTo?: string;
  bankName?: string;
  accountLast4?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  alreadyVerified?: boolean;
}) {
  const how = method === "ACH" || method === "CASH" ? method : "CHECK";

  return (
    <div className="payout-block">
      <input type="hidden" name="payoutMethod" value={how} />
      <div className={`payout-callout ${how.toLowerCase()}`}>
        <strong>{METHOD_LABEL[how]}</strong>
        <p>{METHOD_HINT[how]}</p>
      </div>

      {how === "CHECK" ? (
        <div className="field">
          <label>Name on the check</label>
          <input
            name="checkPayableTo"
            required
            defaultValue={checkPayableTo}
            placeholder="Exactly as it should be printed"
          />
          <small className="muted">This is the payable-to line on the check we mail.</small>
        </div>
      ) : (
        <input type="hidden" name="checkPayableTo" value={checkPayableTo} />
      )}

      {how === "ACH" ? (
        <>
          <div className="field">
            <label>Bank name</label>
            <input name="bankName" defaultValue={bankName} />
          </div>
          <div className="field">
            <label>Account last 4</label>
            <input
              name="accountLast4"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]{4}"
              defaultValue={accountLast4}
              placeholder="1234"
            />
            <small className="muted">Never enter a full routing or account number here.</small>
          </div>
        </>
      ) : null}

      {how === "CASH" ? (
        <p className="muted">Confirm your contact details above so we can arrange the cash payout.</p>
      ) : (
        <>
          <h3>{how === "CHECK" ? "Mailing address" : "Address"}</h3>
          <AddressFields
            names={{
              street: "payoutAddress",
              city: "payoutCity",
              state: "payoutState",
              zip: "payoutZip",
              verified: "payoutVerified",
            }}
            street={street}
            city={city}
            state={state}
            zip={zip}
            alreadyVerified={alreadyVerified}
            required={how === "CHECK"}
            hint={
              how === "CHECK"
                ? "This is where the check is mailed. You can save even if the map cannot confirm the building."
                : "Optional. Confirm the building and city if you want this marked verified."
            }
          />
        </>
      )}
    </div>
  );
}
