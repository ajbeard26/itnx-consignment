import { COMMISSION_TIERS, type CommissionTier } from "@/lib/commission";

export default function CommissionTable({
  active,
  staff = false,
}: {
  active?: CommissionTier | null;
  staff?: boolean;
}) {
  const you = staff ? "Consignor receives" : "You receive";
  return (
    <div className="rate-wrap">
      <table className="rate-table">
        <thead>
          <tr>
            <th>Final sale price</th>
            <th>ITNX commission</th>
            <th>{you}</th>
            <th>After 12.5% auction fee*</th>
          </tr>
        </thead>
        <tbody>
          {COMMISSION_TIERS.map((tier) => (
            <tr key={tier.label} className={active?.label === tier.label ? "on" : undefined}>
              <td>{tier.label}</td>
              <td>{tier.consigneePercent}%</td>
              <td>
                <b>{tier.consignorPercent}%</b>
              </td>
              <td>{tier.effectiveAfterFee}% effective to ITNX</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted rate-note">
        *Typical GovDeals / auction fee is 12.5% of the final sale price. NXRENT LLC eats that fee. Example: on a $400
        sale the consignor still receives 50% ($200). ITNX’s 50% commission is $200, the $50 auction fee comes out of
        that, and ITNX nets $150 (37.5%).
      </p>
    </div>
  );
}
