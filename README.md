# Ganjino Backend API

RESTful API for Ganjino (گنجینو) - A savings goal tracking application built with Node.js, Express, TypeScript, and MongoDB.

## Features

- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Products**: CRUD operations for savings goals/products
- **Profile**: User profile management with monthly salary tracking
- **Wishlist**: Toggle and filter wishlisted products
- **API Documentation**: Swagger/OpenAPI documentation at `/api-docs`

## Tech Stack

- Node.js with Express
- TypeScript
- MongoDB with Mongoose
- JWT for authentication
- Bcrypt for password hashing
- Swagger for API documentation
- Express Validator for request validation

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ganjino
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

## Development

Start the development server with hot reloading:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Building for Production

Build the TypeScript code:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Documentation

Once the server is running, visit:
```
http://localhost:3000/api-docs
```

This will open the Swagger UI with interactive API documentation.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/signin` - Sign in an existing user
- `GET /api/auth/me` - Get current user information (requires auth)

### Products
- `GET /api/products` - Get all products (requires auth)
- `GET /api/products/wishlisted` - Get wishlisted products (requires auth)
- `GET /api/products/:id` - Get a product by ID (requires auth)
- `POST /api/products` - Create a new product (requires auth)
- `PUT /api/products/:id` - Update a product (requires auth)
- `DELETE /api/products/:id` - Delete a product (requires auth)
- `PATCH /api/products/:id/wishlist` - Toggle wishlist status (requires auth)

### Profile
- `GET /api/profile` - Get user profile (requires auth)
- `PUT /api/profile` - Update user profile (requires auth)

### Health Check
- `GET /health` - API health check

## Authentication

Protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

After signing up or signing in, you'll receive a token in the response. Include this token in subsequent requests to protected endpoints.

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files (database, swagger)
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware (auth, error handling)
│   ├── models/          # Mongoose models
│   ├── routes/          # Route definitions
│   ├── utils/           # Utility functions (JWT)
│   └── index.ts         # Application entry point
├── .env.example         # Example environment variables
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run seed:default` - Seed default dataset (super admin, admin, sample users, goals, logs, gold history)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/ganjino |
| JWT_SECRET | Secret key for JWT signing | - |
| NODE_ENV | Environment (development/production) | development |
| GOLD_API_KEY | API key for gold price source | - |
| CORS_ORIGIN | Comma-separated allowed origins | - |
| SEED_SUPER_ADMIN_EMAIL | Seeded super admin email | superadmin@ganjino.local |
| SEED_SUPER_ADMIN_PASSWORD | Seeded super admin password | SuperAdmin123! |
| SEED_ADMIN_EMAIL | Seeded admin email | admin@ganjino.local |
| SEED_ADMIN_PASSWORD | Seeded admin password | Admin123! |

## Admin Roles

- `super_admin`: Full admin dashboard access, including sensitive role and user status changes.
- `admin`: Read/security insights access in admin dashboard, without privileged mutation actions.
