# ITNX Consignment Portal — A service of NXRENT LLC

Next.js starter for co.itnx.tech.

## Features
- First-load staff login setup (email and password stored in the database)
- Admin dashboard and consignment list
- SQLite via Prisma (swap to PostgreSQL in `prisma/schema.prisma` for production)
- Configurable default split
- Per-deal split override: 50/50, 60/40, 70/30, etc.
- Customer payout + ITNX gross/net calculations
- Selling/platform fee tracking
- Cash, ACH, and check payout recording
- Secure customer acceptance/signature link
- Mobile-friendly customer payout page

## Install
1. Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Run:
   npm install
   npx prisma generate
   npm run db:push
   npm run dev
4. Open the home screen and create your staff email and password.
5. Set `NEXT_PUBLIC_APP_URL=https://co.itnx.tech` in production.

## Important before public launch
Set a strong `AUTH_SECRET` in production.
For ACH, do not store raw routing/account numbers. Integrate a payment provider/tokenized bank onboarding.
For automated text/email acceptance links, connect an SMS/email provider.
Have your final consignment agreement/acceptance wording reviewed for your business and jurisdiction.
