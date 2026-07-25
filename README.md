# Sliik Backend

NestJS REST + WebSocket API for **Sliik**, a two-sided mobile marketplace connecting customers with local beauty and grooming service providers (hairdressers, barbers, nail techs, lash artists). Customers discover, book, and pay for appointments; providers manage their services, availability, portfolio, and payouts. Built Nigeria-first, using Paystack for payments.

Serves the [`sliik-mobile`](../sliik-mobile) Expo client. This repo owns all business logic; the mobile app is a thin client.

## Tech Stack

- **Framework**: NestJS 11 (TypeScript)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Passport (JWT, Google OAuth, Apple Sign-In), bcrypt
- **Realtime**: Socket.IO (chat gateway)
- **Payments**: Paystack
- **File uploads**: Cloudinary
- **Mail**: Nodemailer + React Email (SMTP)
- **Push notifications**: Expo Server SDK
- **Validation**: class-validator / class-transformer

## Project Structure

```
src/
├── main.ts              # global prefix "api", ValidationPipe, GlobalExceptionFilter, CORS
├── config/               # configuration.ts (namespaced env) + env.validation.ts (fail-fast boot)
├── db/
│   ├── index.ts          # global DbModule, Drizzle injection token DRIZZLE
│   ├── schema/            # one file per table (users, bookings, chat, payments, ...)
│   └── migrations/        # Drizzle-generated SQL migrations
├── common/
│   ├── filters/           # GlobalExceptionFilter
│   ├── guards/
│   ├── interceptors/
│   ├── decorators/
│   ├── utils/             # response.helper.ts (successResponse/errorResponse/paginatedResponse)
│   └── interfaces/        # ApiResponse, PaginatedResponse
└── modules/               # one folder per domain: auth, users, customers, providers,
                            # services, availability, bookings, offers, deals, favorites,
                            # chat, payments, payouts, portfolio, reviews, reports,
                            # notifications, mail, uploads
```

## Getting Started

Prerequisites: Node.js, npm, a local PostgreSQL instance.

```bash
npm install
cp .env.example .env    # fill in the values described below
npm run db:migrate      # apply database migrations
npm run start:dev       # start the dev server with watch mode
```

## Environment Variables

All config is read from environment variables via `ConfigService` (see `.env.example` for the full template). Nothing is ever hardcoded.

| Variable | Purpose |
|---|---|
| `PORT` | Server port (optional, defaults to 3000) |
| `ALLOWED_ORIGINS` | CORS allow-list |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` / `JWT_EXPIRY` | Auth token signing secret and expiry |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Apple Sign-In |
| `PAYSTACK_SECRET_KEY` | Payments |
| `PAYMENT_SUCCESS_URL` / `PAYMENT_CANCEL_URL` | Deep-link redirect URLs after payment |
| `PLATFORM_COMMISSION_PERCENT` | Platform's cut per booking (optional, defaults to 10) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | File uploads |
| `MAX_UPLOAD_SIZE_MB` | Upload size limit (optional, defaults to 5) |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` / `MAIL_USER` / `MAIL_PASSWORD` / `MAIL_FROM_NAME` / `MAIL_FROM_ADDRESS` | SMTP (Gmail App Password, not the account password) |
| `PASSWORD_RESET_CODE_EXPIRY_MINUTES` / `PASSWORD_RESET_MAX_ATTEMPTS` / `PASSWORD_RESET_RESEND_COOLDOWN_SECONDS` | Password reset OTP flow |
| `EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES` / `EMAIL_VERIFICATION_MAX_ATTEMPTS` / `EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS` | Signup email verification OTP flow |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT` | Rate limiting on password-reset endpoints |

## Database

Schema lives in `src/db/schema/`, migrations in `src/db/migrations/`.

```bash
npm run db:generate   # generate a migration from schema changes
npm run db:migrate    # apply pending migrations
npm run db:push       # push schema directly to the DB (use --force in non-TTY)
npm run db:studio     # open Drizzle Studio
```

## Scripts

| Script | Description |
|---|---|
| `npm run start` | Start the server |
| `npm run start:dev` | Start with watch mode |
| `npm run start:debug` | Start with debugger + watch mode |
| `npm run start:prod` | Run the production build (`dist/main`) |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | Lint + autofix |
| `npm run format` | Format with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:cov` | Run unit tests with coverage |
| `npm run test:e2e` | Run end-to-end tests |

## License

Private, unlicensed portfolio project.
