import Shell from "@/components/Shell";
import AddressFields from "@/components/AddressFields";
import { createCustomer } from "../actions";

export const metadata = { title: "New customer" };

export default function Page() {
  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">People</p>
          <h1>New customer</h1>
          <p className="muted">Save contact and a verified mailing address. They can add payout details on their private link later.</p>
        </div>
      </div>
      <form action={createCustomer} className="card panel">
        <div className="form">
          <div className="field">
            <label>Full name</label>
            <input name="name" required placeholder="Jane Smith" />
          </div>
          <div className="field">
            <label>Company</label>
            <input name="company" placeholder="Optional" />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" placeholder="name@email.com" />
          </div>
          <div className="field">
            <label>Phone</label>
            <input name="phone" placeholder="(555) 555-5555" />
          </div>
        </div>
        <h3>Mailing address</h3>
        <AddressFields required={false} />
        <div className="form-actions" style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginRight: "auto" }}>
            Customer ID is assigned on save.
          </p>
          <button className="button" type="submit">
            Save customer
          </button>
        </div>
      </form>
    </Shell>
  );
}