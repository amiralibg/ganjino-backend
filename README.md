# Ganjino Backend API

REST API for Ganjino (گنجینو), a savings and goal-tracking platform. This service handles authentication, profile management, savings logs, gold pricing, admin operations, and scheduled background jobs.

## Highlights

- JWT-based authentication with refresh token support
- Goal and savings log APIs for user progress tracking
- Profile and session-aware account management
- Gold price and gold history endpoints
- Admin-only moderation and platform insight endpoints
- Request logging, centralized error handling, and validation middleware
- Cron jobs for recurring background tasks and startup gold-price persistence
- Swagger documentation for local API exploration

## Tech Stack

- Node.js
- Express 5
- TypeScript
- MongoDB with Mongoose
- JSON Web Tokens
- express-validator
- Swagger UI / swagger-jsdoc
- node-cron

## Project Structure

```text
.
├── src/
│   ├── config/          # Environment, database, and Swagger setup
│   ├── constants/       # Shared roles and response messages
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Auth, validation, rate limiting, logging, errors
│   ├── models/          # Mongoose models
│   ├── routes/          # Express route modules
│   ├── scripts/         # Local maintenance and seed scripts
│   ├── services/        # Gold pricing and cron job services
│   ├── utils/           # JWT and domain helpers
│   └── index.ts         # Application bootstrap
├── .env.example
├── package.json
└── README.md
```

## API Surface

The server mounts these route groups:

- `/api/auth`
- `/api/goals`
- `/api/profile`
- `/api/gold`
- `/api/logs`
- `/api/gold-history`
- `/api/admin`

It also exposes:

- `/health` for service health checks
- `/api-docs` for Swagger UI

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- MongoDB 6 or newer
- A valid gold price API key for environments where live gold data is required

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Configure environment variables.

Minimum local setup:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ganjino
JWT_SECRET=replace-this-with-a-secure-value
NODE_ENV=development
GOLD_API_KEY=your-gold-api-key
```

4. Start the development server:

```bash
npm run dev
```

The API will start on `http://localhost:3000`.

## Available Scripts

```bash
npm run dev
npm run build
npm start
npm run seed:default
npm run typecheck
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Environment Variables

The service reads configuration from `.env`. The currently documented variables are:

| Variable | Description |
| --- | --- |
| `PORT` | HTTP server port |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign access and refresh tokens |
| `NODE_ENV` | Runtime mode (`development` or `production`) |
| `GOLD_API_KEY` | API key for the external gold price provider |
| `GOLD_API_URL` | Base URL for the external gold price provider |
| `CORS_ORIGIN` | Comma-separated allowlist for browser clients |
| `SEED_SUPER_ADMIN_EMAIL` | Seeded super admin email |
| `SEED_SUPER_ADMIN_PASSWORD` | Seeded super admin password |
| `SEED_SUPER_ADMIN_NAME` | Seeded super admin display name |
| `SEED_ADMIN_EMAIL` | Seeded admin email |
| `SEED_ADMIN_PASSWORD` | Seeded admin password |
| `SEED_ADMIN_NAME` | Seeded admin display name |

## Seed Data

Use the seed command to create a default working dataset for local development:

```bash
npm run seed:default
```

This script is intended to provision baseline admin accounts and sample data for testing flows across the mobile app and admin dashboard.

## Operational Behavior

### Startup

On boot, the service:

- Connects to MongoDB
- Initializes cron jobs
- Attempts to persist the current day’s gold price
- Starts the HTTP server

### Shutdown

The server listens for `SIGINT` and `SIGTERM`, stops cron jobs, closes the HTTP server, and disconnects from MongoDB before exit.

## Development Notes

- Route composition happens in `src/index.ts`.
- Environment parsing is centralized in `src/config/env.ts`.
- Admin auth and role checks live in `src/middleware/adminAuth.ts`.

## Related Projects

- Mobile client: [github.com/amiralibg/ganjino-app](https://github.com/amiralibg/ganjino-app)
- Admin dashboard: [github.com/amiralibg/ganjino-admin](https://github.com/amiralibg/ganjino-admin)

## Contributing

For maintainable contributions:

- Keep API changes backward compatible when possible
- Update Swagger docs or route docs alongside endpoint changes
- Include migration notes for schema or auth changes
- Run `lint` and `typecheck` before opening a PR

## License

This project is currently marked as `ISC` in `package.json`.
