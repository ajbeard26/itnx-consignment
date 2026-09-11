# ITNX Consignment Portal — A service of NXRENT LLC

Next.js + PostgreSQL starter for co.itnx.tech.

## Features
- Admin dashboard and consignment list
- PostgreSQL via Prisma
- Configurable default split
- Per-deal split override: 50/50, 60/40, 70/30, etc.
- Customer payout + ITNX gross/net calculations
- Selling/platform fee tracking
- Cash, ACH, and check payout recording
- Secure customer acceptance/signature link
- Mobile-friendly customer payout page

## Install
1. Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`.
4. Run:
   npm install
   npx prisma generate
   npm run db:push
   npm run dev
5. Set `NEXT_PUBLIC_APP_URL=https://co.itnx.tech` in production.

## Important before public launch
This starter intentionally does NOT include admin login/authentication yet. Add authentication before exposing the admin routes publicly.
For ACH, do not store raw routing/account numbers. Integrate a payment provider/tokenized bank onboarding.
For automated text/email acceptance links, connect an SMS/email provider.
Have your final consignment agreement/acceptance wording reviewed for your business and jurisdiction.
