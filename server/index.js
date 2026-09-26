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

function publicLight(light) {
    return {
        id: light.id,
        name: light.name,
        room: light.room,
        deviceId: light.device_id,
        isOnline: light.is_online,
        createdAt: light.created_at,
    };
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

app.get('/api/lights', async (request, response) => {
    const user = await currentUser(request);
    if (!user) return response.status(401).json({ error: 'You must be signed in.' });

    const result = await pool.query(
        `SELECT id, name, room, device_id, is_online, created_at
     FROM smart_lights
     WHERE user_id = $1
     ORDER BY created_at DESC`,
        [user.id],
    );
    return response.json({ lights: result.rows.map(publicLight) });
});

app.post('/api/lights', async (request, response) => {
    const user = await currentUser(request);
    if (!user) return response.status(401).json({ error: 'You must be signed in.' });

    const name = String(request.body.name || '').trim();
    const room = String(request.body.room || '').trim();
    const deviceId = String(request.body.deviceId || '').trim();
    if (name.length < 2 || name.length > 64)
        return response.status(400).json({ error: 'Light name must be between 2 and 64 characters.' });
    if (room.length < 2 || room.length > 64)
        return response.status(400).json({ error: 'Room must be between 2 and 64 characters.' });
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(deviceId))
        return response.status(400).json({ error: 'Device ID must use letters, numbers, hyphens, or underscores.' });

    try {
        const result = await pool.query(
            `INSERT INTO smart_lights (user_id, name, room, device_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, room, device_id, is_online, created_at`,
            [user.id, name, room, deviceId],
        );
        return response.status(201).json({ light: publicLight(result.rows[0]) });
    } catch (error) {
        if (error.code === '23505') return response.status(409).json({ error: 'That device is already connected.' });
        console.error(error);
        return response.status(500).json({ error: 'Unable to add this light.' });
    }
});

app.delete('/api/lights/:id', async (request, response) => {
    const user = await currentUser(request);
    if (!user) return response.status(401).json({ error: 'You must be signed in.' });

    const lightId = Number(request.params.id);
    if (!Number.isSafeInteger(lightId)) return response.status(400).json({ error: 'Invalid light.' });
    await pool.query('DELETE FROM smart_lights WHERE id = $1 AND user_id = $2', [lightId, user.id]);
    return response.status(204).end();
});

app.use(express.static(path.join(__dirname, '..', 'build')));
app.use((request, response, next) => {
    if (request.path.startsWith('/api/')) return next();
    return response.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

async function start() {
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
    CREATE TABLE IF NOT EXISTS smart_lights (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(64) NOT NULL,
      room VARCHAR(64) NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      is_online BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, device_id)
    );
    CREATE INDEX IF NOT EXISTS smart_lights_user_id_idx ON smart_lights(user_id);
  `);

    await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    app.listen(port, () => console.log(`Owl Hacks server listening on port ${port}`));
}

start().catch((error) => {
    console.error(error);
    process.exit(1);
});
