# Owl Hacks 2026

Beacon is a React dashboard and username/password backend for a smart-light
alert system designed for deaf and hard-of-hearing users.

## Development

```bash
cp .env.example .env
npm install
npm run db:up
npm run dev
```

This starts PostgreSQL in Docker and runs the React development server and API
server natively. The React server is available at `http://localhost:3000` and
proxies `/api` requests to the backend at `http://localhost:3001`.

The backend port is configured with `API_PORT` in `.env`; do not use the
generic `PORT` variable because Create React App uses it for the frontend.

Frontend changes hot reload through React. Backend changes automatically restart
the API through Node's watch mode. Restart `npm run dev` after changing `.env`.

Stop PostgreSQL without deleting its data:

```bash
npm run db:down
```

Reset the local database and delete all local users:

```bash
npm run db:reset
```

Build the production bundle with `npm run build`.

## Local backend

The backend creates its tables on startup. You can verify that it is running
without opening the frontend:

```bash
curl http://localhost:3001/api/health
```

Test registration and login from a terminal. The cookie file keeps the session
between requests:

```bash
curl -i -c /tmp/owlhacks-cookies.txt \
    -H 'Content-Type: application/json' \
    -d '{"username":"test_builder","password":"password123"}' \
    http://localhost:3001/api/auth/register

curl -i -b /tmp/owlhacks-cookies.txt http://localhost:3001/api/auth/me

curl -i -X POST -b /tmp/owlhacks-cookies.txt http://localhost:3001/api/auth/logout
```

Authentication is available under `/api/auth` and uses an HTTP-only session
cookie. Signed-in users can manage their saved smart lights through
`/api/lights`; each light has a name, room, device ID, and connection status.
For a production-style local server, use `npm run prod` after setting the
variables in `.env`.
