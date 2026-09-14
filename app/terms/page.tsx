import LegalShell from "@/components/LegalShell";
import { publicBrand } from "@/lib/brand";

export const metadata = { title: "Terms of Service" };

export default async function Page() {
  const s = await publicBrand();
  const brand = s.brand;
  const legal = s.legal;

  return (
    <LegalShell brand={brand} legal={legal} title="Terms of Service" updated="September 13, 2026">
      <p>
        These Terms of Service (“Terms”) govern use of the {brand} portal at co.itnx.tech, a service of {legal}{" "}
        (“Consignee,” “we,” “us”). By opening a staff account, a private customer link, or otherwise using the portal,
        you agree to these Terms and to the{" "}
        <a href="/consignment-agreement">Consignment Agreement</a>.
      </p>

      <h3>1. The service</h3>
      <p>
        The portal is an operations tool for consignment: customer records, listings, photos, payout details, SMS,
        email, and electronic acceptance of a consignment payout. It is not a bank, auction house, or payment
        processor. Sales may be made on GovDeals or other marketplaces we select, or by direct sale.
      </p>

      <h3>2. Staff accounts</h3>
      <p>
        Staff logins are for authorized personnel of {legal} only. You are responsible for keeping credentials
        confidential. We may suspend access if we believe an account is misused.
      </p>

      <h3>3. Customer links</h3>
      <p>
        Consignors receive private links to add mailing / check information and to review and sign a payout. Those
        links are not public listings. Do not share a link that is not yours. Submitting payout details or signing is
        an electronic signature under the Michigan Uniform Electronic Transactions Act and other applicable e-sign law.
      </p>

      <h3>4. Consignment relationship</h3>
      <p>
        The legal terms that control commission, third-party selling fees, payment timing, and how we sell property
        are in the <a href="/consignment-agreement">Consignment Agreement</a>. If these Terms and that Agreement
        conflict on commission or payout, the Consignment Agreement controls.
      </p>

      <h3>5. Payouts</h3>
      <p>
        Default payout is a mailed check. We do not collect full bank routing or account numbers on this portal. We
        may ask you to confirm payable-to name and mailing address before we issue a check.
      </p>
      <p>
        Payment is issued only after we have received cleared buyer funds and the transaction is considered complete.
        Our consignment commission is applied to the final sale price before your payment is calculated, as set out in
        the Consignment Agreement. Auction and platform fees are our expense and are shown on the payment record; they
        do not reduce your agreed share unless we agree otherwise in writing.
      </p>
      <p>
        After a sale is finalized, checks are normally processed on this cycle: sales finalized from the 1st through
        the 14th are processed on the 15th of that month; sales finalized from the 15th through the end of the month
        are processed on the 1st of the following month. That is ordinary practice, not a promise that a check will be
        issued or will arrive on that exact date. Weekends, bank holidays, delayed buyer payment, refunds,
        chargebacks, or auction or marketplace disputes may move the issue or delivery date.
      </p>
      <p>
        We keep a payment record showing the sale price, deductions, consignor proceeds, check number, and payment
        date. The <a href="/consignment-agreement">Consignment Agreement</a> controls if these Terms and that
        Agreement differ on commission or payout.
      </p>

      <h3>6. Messages</h3>
      <p>
        If you opt in, we may text or email you about your consignment and payout. Message and data rates may apply.
        Reply STOP to opt out of SMS. Email unsubscribe or a reply to staff will stop marketing-style notes; we may
        still send transactional payout notices.
      </p>

      <h3>7. Acceptable use</h3>
      <p>
        You may not attempt to break, scrape, or overload the portal; submit false identity or payout information; or
        use the service for any unlawful purpose.
      </p>

      <h3>8. Disclaimer</h3>
      <p>
        The portal is provided “as is.” Marketplace results, timing of a sale, and third-party platform rules are
        outside our full control. We do not warrant uninterrupted access.
      </p>

      <h3>9. Limitation of liability</h3>
      <p>
        To the fullest extent permitted by law, {legal} is not liable for indirect, incidental, or consequential
        damages. Our total liability arising out of the portal is limited to the consignment commission we actually
        received on the item that gave rise to the claim.
      </p>

      <h3>10. Changes</h3>
      <p>
        We may update these Terms by posting a new version on this page. Continued use after the update means you
        accept the revised Terms.
      </p>

      <h3>11. Governing law</h3>
      <p>
        These Terms are governed by the laws of the State of Michigan, without regard to conflict-of-law rules.
        Exclusive venue is the state or federal courts located in Michigan.
      </p>

      <h3>12. Contact</h3>
      <p>
        {legal}
        {s.address ? `, ${s.address}` : ""}
        {s.contactEmail ? `. ${s.contactEmail}` : ""}
        {s.contactPhone ? `. ${s.contactPhone}` : ""}.
      </p>
    </LegalShell>
  );
}
