const { TRIGGER_TYPES, DEVICE_TYPES } = require('./enums.js');
const { registerApi } = require('./api.js');
const crypto = require('node:crypto');
const path = require('node:path');

const bcrypt = require('bcryptjs');
require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.API_PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
}

if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const sessionCookie = 'owlhacks_session';
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30;

function hashSession(token) {
    return crypto
        .createHmac('sha256', sessionSecret || 'development-session-secret')
        .update(token)
        .digest('hex');
}

function setSessionCookie(res, token) {
    const attributes = [
        `${sessionCookie}=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${sessionDurationMs / 1000}`,
    ];

    if (isProduction) attributes.push('Secure');
    res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res) {
    const attributes = [`${sessionCookie}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
    if (isProduction) attributes.push('Secure');
    res.setHeader('Set-Cookie', attributes.join('; '));
}

function readCookie(request, name) {
    const cookies = request.headers.cookie?.split(';') || [];
    const cookie = cookies.find((value) => value.trim().startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.trim().slice(name.length + 1)) : null;
}

function publicUser(user) {
    return { id: user.id, username: user.username };
}

async function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
        `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [hashSession(token), userId],
    );
    return token;
}

async function currentUser(request) {
    const token = readCookie(request, sessionCookie);
    if (!token) return null;

    const result = await pool.query(
        `SELECT users.id, users.username
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
        [hashSession(token)],
    );

    return result.rows[0] || null;
}

async function ensureEnum(pool, name, values) {
    const quote = (v) => `'${v.replace(/'/g, "''")}'`;

    await pool.query(`
        DO $$ BEGIN
        CREATE TYPE ${name} AS ENUM (${values.map(quote).join(', ')});
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    `);

    for (const v of values) {
        await pool.query(`ALTER TYPE ${name} ADD VALUE IF NOT EXISTS ${quote(v)}`);
    }
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
});

app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', async (_request, response) => {
    try {
        await pool.query('SELECT 1');
        response.json({ status: 'ok' });
    } catch (_error) {
        response.status(503).json({ status: 'unavailable' });
    }
});

app.post('/api/auth/register', authLimiter, async (request, response) => {
    const username = String(request.body.username || '').trim();
    const password = String(request.body.password || '');

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
        return response.status(400).json({ error: 'Username must be 3-32 letters, numbers, or underscores.' });
    }

    if (password.length < 8 || password.length > 128) {
        return response.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            `INSERT INTO users (username, password_hash)
       VALUES (LOWER($1), $2)
       RETURNING id, username`,
            [username, passwordHash],
        );
        const token = await createSession(result.rows[0].id);
        setSessionCookie(response, token);
        return response.status(201).json({ user: publicUser(result.rows[0]) });
    } catch (error) {
        if (error.code === '23505') {
            return response.status(409).json({ error: 'That username is already taken.' });
        }
        console.error(error);
        return response.status(500).json({ error: 'Unable to create account.' });
    }
});

app.post('/api/auth/login', authLimiter, async (request, response) => {
    const username = String(request.body.username || '')
        .trim()
        .toLowerCase();
    const password = String(request.body.password || '');
    const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = LOWER($1)', [
        username,
    ]);
    const user = result.rows[0];
    const valid = user && (await bcrypt.compare(password, user.password_hash));

    if (!valid) return response.status(401).json({ error: 'Invalid username or password.' });

    const token = await createSession(user.id);
    setSessionCookie(response, token);
    return response.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', async (request, response) => {
    const token = readCookie(request, sessionCookie);
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashSession(token)]);
    clearSessionCookie(response);
    response.status(204).end();
});

app.get('/api/auth/me', async (request, response) => {
    const user = await currentUser(request);
    response.json({ user: user ? publicUser(user) : null });
});

registerApi(app, { pool, currentUser });

app.use(express.static(path.join(__dirname, '..', 'build')));
app.use((request, response, next) => {
    if (request.path.startsWith('/api/')) return next();
    return response.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

async function start() {
    await ensureEnum(pool, 'trigger_type', TRIGGER_TYPES);
    await ensureEnum(pool, 'device_type', DEVICE_TYPES);
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(32) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS room (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS device (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        type device_type NOT NULL,
        room_id BIGINT NOT NULL REFERENCES room(id),
        device_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS default_state (
        id BIGSERIAL PRIMARY KEY,
        light_id BIGINT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
        color INT,
        brightness INT,
        pulse INT
    );
    CREATE TABLE IF NOT EXISTS event (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(150),
        trigger trigger_type NOT NULL,
        event_length INT NOT NULL,
        color INT NOT NULL,
        brightness INT NOT NULL,
        pulse INT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS device_event (
        device_id BIGINT NOT NULL REFERENCES device(id) ON DELETE CASCADE,
        event_id BIGINT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
        PRIMARY KEY (device_id, event_id)
    );
    CREATE INDEX IF NOT EXISTS room_user_id_idx ON room(user_id);
    CREATE INDEX IF NOT EXISTS device_user_id_idx ON device(user_id);
    CREATE INDEX IF NOT EXISTS device_room_id_idx ON device(room_id);
    CREATE INDEX IF NOT EXISTS default_state_light_id_idx ON default_state(light_id);
    CREATE INDEX IF NOT EXISTS event_user_id_idx ON event(user_id);
    CREATE INDEX IF NOT EXISTS device_event_event_id_idx ON device_event(event_id);
  `);

    await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    app.listen(port, () => console.log(`Owl Hacks server listening on port ${port}`));
}

start().catch((error) => {
    console.error(error);
    process.exit(1);
});
