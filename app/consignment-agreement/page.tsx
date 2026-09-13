import LegalShell from "@/components/LegalShell";
import CommissionTable from "@/components/CommissionTable";
import { publicBrand } from "@/lib/brand";

export const metadata = { title: "Consignment Agreement" };

export default async function Page() {
  const s = await publicBrand();
  const brand = s.brand;
  const legal = s.legal;

  return (
    <LegalShell brand={brand} legal={legal} title="Consignment Agreement" updated="September 13, 2026">
      <p>
        This Consignment Agreement (“Agreement”) is between the person or entity consigning property (“Consignor,”
        “you”) and <b>{legal}</b>, doing business as {brand} (“Consignee,” “we”). By delivering property for sale,
        submitting payout information, or signing a payout authorization, you agree to this Agreement.
      </p>

      <h3>1. Appointment</h3>
      <p>
        Consignor appoints Consignee as agent to market and sell the consigned property. Consignee may select the
        method and platform, including GovDeals, other online auction or marketplace platforms, or direct sale, unless
        the parties agree otherwise in writing.
      </p>

      <h3>2. Title and authority</h3>
      <p>
        Consignor represents that Consignor owns the property or is otherwise authorized to consign it, and that the
        property is free of undisclosed liens or claims. Title remains with Consignor until a sale is completed.
        Consignee does not guarantee that an item will sell, or sell by a particular date.
      </p>

      <h3>3. Commission schedule</h3>
      <p>
        Unless the parties agree in writing to a different split before the property is offered for sale, commission
        is set from the <b>final sale price</b> as follows. “You receive” is the Consignor’s share of that final sale
        price. ITNX’s listed commission is a <b>gross commission</b>.
      </p>
      <CommissionTable />

      <h3>4. Commission and third-party selling fees</h3>
      <p>
        The Consignor and Consignee shall agree in writing to a consignment commission of{" "}
        <b>thirty percent (30%), forty percent (40%), or fifty percent (50%)</b> of the final sale price prior to the
        property being offered for sale. The schedule in Section 3 is that written agreement unless a different
        percentage is confirmed on the consignment record.
      </p>
      <p>
        The Consignor shall be entitled to the remaining portion of the final sale price based upon the agreed
        commission percentage.
      </p>
      <p>
        <b>Third-Party Fees.</b> Any auction fees, marketplace fees, payment-processing charges, listing fees, or
        other ordinary third-party selling fees incurred in connection with the sale of the consigned property shall
        be the responsibility of the Consignee. Such fees shall be paid from the Consignee’s commission and{" "}
        <b>shall not be deducted from or otherwise reduce the Consignor’s agreed share of the final sale price.</b>
      </p>
      <p>
        The Consignee shall have the discretion to select the appropriate method and platform for marketing and
        selling the property, including GovDeals, other online auction or marketplace platforms, or direct sale,
        unless otherwise agreed to in writing.
      </p>
      <p>
        The Consignor’s payment shall be calculated based upon the final sale price and the commission percentage
        agreed upon by the parties. Payment shall become due after the purchaser’s funds have cleared and the
        Consignee has received the proceeds of the sale.
      </p>
      <p>
        For purposes of this Agreement, the Consignee’s commission is a <b>gross commission</b>. Any third-party
        selling fees paid by the Consignee shall be considered an expense of the Consignee and shall not alter the
        amount otherwise payable to the Consignor.
      </p>

      <h3>5. How you are paid</h3>
      <p>
        Default payout is a check, mailed to the address you provide, payable to the name you specify. Consignee does
        not collect full bank routing or account numbers on this portal. You agree that an electronic signature on the
        payout authorization is your written acceptance of the sale price, your share, and this Agreement.
      </p>

      <h3>6. Unsold or withdrawn property</h3>
      <p>
        If property does not sell, or Consignor requests return before a binding sale, Consignee may require pickup
        within a reasonable time. Consignee is not obligated to store property indefinitely. Risk of loss remains with
        Consignor except for Consignee’s gross negligence or willful misconduct.
      </p>

      <h3>7. Photos and listings</h3>
      <p>
        Consignee may photograph the property and use those images, descriptions, and serial numbers on marketplaces
        and in this portal.
      </p>

      <h3>8. Limitation of liability</h3>
      <p>
        Consignee’s liability related to a consignment is limited to the commission actually received on that item,
        except in cases of gross negligence or willful misconduct. Marketplace outages, buyer default, and shipping
        carriers are third parties.
      </p>

      <h3>9. Governing law</h3>
      <p>
        This Agreement is governed by the laws of the State of Michigan, without regard to conflict-of-law rules.
        Exclusive venue is the state or federal courts located in Michigan.
      </p>

      <h3>10. Entire agreement</h3>
      <p>
        This Agreement, the consignment record in the portal, and any written change both parties confirm, are the
        entire agreement on commission and payout. The <a href="/terms">Terms of Service</a> and{" "}
        <a href="/privacy">Privacy Policy</a> also apply to use of the portal.
      </p>

      <p className="muted">
        {legal}
        {s.address ? ` · ${s.address}` : ""}
        {s.contactEmail ? ` · ${s.contactEmail}` : ""}
      </p>
    </LegalShell>
  );
}
