# Owl Hacks 2026

React website and username/password backend for Owl Hacks 2026.

## Development

```bash
npm install
npm start
```

Build the production bundle with `npm run build`.

## Local backend

Start PostgreSQL, then set the connection string and session secret:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/owlhacks
export SESSION_SECRET=replace-this-with-a-long-random-value
npm run prod
```

The backend creates its tables on startup and serves the React build on port 3000. Authentication is available under `/api/auth` and uses an HTTP-only
session cookie.
