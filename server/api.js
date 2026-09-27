const { TRIGGER_TYPES, TRIGGER_TYPES_LABELS, DEVICE_TYPES } = require('./enums.js');
const { logEvent } = require('./logger.js');
const crypto = require('node:crypto');

// Limits shared by validation and the frontend (exposed through /api/meta).
const LIMITS = {
    brightness: { min: 0, max: 100 },
    // Pulse is the length of one on/off cycle in milliseconds. 0 means a solid light.
    pulse: { min: 0, max: 10000 },
    // How long an event keeps the light in its alert state, in seconds.
    eventLength: { min: 1, max: 3600 },
};

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const fail = (status, message) => {
    throw new ApiError(status, message);
};

/* ---------- value helpers ---------- */

// Colors are stored as 24-bit integers (0xRRGGBB) and returned as both the integer and a hex string.
function toHex(color) {
    if (color === null || color === undefined) return null;
    return `#${Number(color).toString(16).padStart(6, '0')}`;
}

function parseColor(value, field = 'Color') {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) return value;
    if (typeof value === 'string' && /^#?[0-9a-fA-F]{6}$/.test(value.trim())) {
        return parseInt(value.trim().replace('#', ''), 16);
    }
    return fail(400, `${field} must be a hex color like #ffaa00.`);
}

function parseIntInRange(value, { min, max }, field) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        return fail(400, `${field} must be a whole number from ${min} to ${max}.`);
    }
    return number;
}

function parseId(value, field = 'id') {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) return fail(400, `Invalid ${field}.`);
    return id;
}

function parseName(value, field, { min = 1, max = 150 } = {}) {
    const name = String(value ?? '').trim();
    if (name.length < min || name.length > max) return fail(400, `${field} must be ${min}-${max} characters.`);
    return name;
}

function parseHardwareId(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const id = String(value).trim();
    return id;
}

function lightState(row) {
    return {
        color: row.color,
        colorHex: toHex(row.color),
        brightness: row.brightness,
        pulse: row.pulse,
    };
}

function rgbColor(color) {
    return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function homeAssistantBrightness(brightness) {
    return Math.round((brightness / 100) * 255);
}

function homeAssistantUrl() {
    return String(process.env.HOME_ASSISTANT_URL || '').replace(/\/$/, '');
}

function hasTriggerApiKey(request) {
    const expected = process.env.TRIGGER_API_KEY;
    const authorization = request.headers.authorization || '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!expected || !supplied) return false;

    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function callHomeAssistant(entityId, state) {
    const url = homeAssistantUrl();
    const token = process.env.HOME_ASSISTANT_KEY;
    if (!url || !token) fail(503, 'Home Assistant integration is not configured.');

    logEvent('matter_api_request', {
        level: 'debug',
        method: 'POST',
        route: '/api/services/light/turn_on',
        entityId,
    });

    const response = await fetch(`${url}/api/services/light/turn_on`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            entity_id: entityId,
            rgb_color: rgbColor(state.color),
            brightness: homeAssistantBrightness(state.brightness),
        }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Home Assistant rejected ${entityId}: ${response.status} ${detail}`.trim());
    }
}

async function turnOffHomeAssistant(entityId) {
    const url = homeAssistantUrl();
    const token = process.env.HOME_ASSISTANT_KEY;
    if (!url || !token) fail(503, 'Home Assistant integration is not configured.');

    logEvent('matter_api_request', {
        level: 'debug',
        method: 'POST',
        route: '/api/services/light/turn_off',
        entityId,
    });

    const response = await fetch(`${url}/api/services/light/turn_off`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entity_id: entityId }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Home Assistant rejected turning off ${entityId}: ${response.status} ${detail}`.trim());
    }
}

async function listHomeAssistantLights() {
    const url = homeAssistantUrl();
    const token = process.env.HOME_ASSISTANT_KEY;
    if (!url || !token) fail(503, 'Home Assistant integration is not configured.');

    let response;
    try {
        response = await fetch(`${url}/api/states`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (_error) {
        fail(503, 'Could not reach Home Assistant.');
    }

    if (!response.ok) {
        fail(503, `Home Assistant rejected the request (${response.status}).`);
    }

    const states = await response.json().catch(() => null);
    if (!Array.isArray(states)) fail(503, 'Home Assistant returned an invalid light list.');

    return states
        .filter((state) => typeof state?.entity_id === 'string' && state.entity_id.startsWith('light.'))
        .map((state) => ({
            entityId: state.entity_id,
            name: String(state.attributes?.friendly_name || state.entity_id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function publicRoom(row) {
    return { id: Number(row.id), name: row.name, deviceCount: Number(row.device_count || 0) };
}

function publicEvent(row) {
    return {
        id: Number(row.id),
        name: row.name,
        trigger: row.trigger,
        triggerLabel: TRIGGER_TYPES_LABELS[row.trigger] || row.trigger,
        eventLength: row.event_length,
        ...lightState(row),
        deviceIds: (row.device_ids || []).map(Number),
    };
}

/* ---------- queries that return full, nested objects ---------- */

async function loadRooms(db, userId) {
    const result = await db.query(
        `SELECT room.id, room.name, COUNT(device.id) AS device_count
         FROM room
         LEFT JOIN device ON device.room_id = room.id
         WHERE room.user_id = $1
         GROUP BY room.id
         ORDER BY room.name`,
        [userId],
    );
    return result.rows.map(publicRoom);
}

async function loadDevices(db, userId, deviceId = null) {
    const devices = await db.query(
        `SELECT device.id, device.name, device.type, device.device_id AS hardware_id, device.created_at,
                room.id AS room_id, room.name AS room_name,
                ds.color, ds.brightness, ds.pulse, ds.id AS default_state_id
         FROM device
         JOIN room ON room.id = device.room_id
         LEFT JOIN LATERAL (
             SELECT id, color, brightness, pulse FROM default_state
             WHERE default_state.light_id = device.id
             ORDER BY id DESC LIMIT 1
         ) ds ON TRUE
         WHERE device.user_id = $1 AND ($2::BIGINT IS NULL OR device.id = $2)
         ORDER BY room.name, device.name`,
        [userId, deviceId],
    );

    const events = await db.query(
        `SELECT device_event.device_id, event.id, event.name, event.trigger, event.event_length,
                event.color, event.brightness, event.pulse
         FROM device_event
         JOIN event ON event.id = device_event.event_id
         WHERE event.user_id = $1 AND ($2::BIGINT IS NULL OR device_event.device_id = $2)
         ORDER BY event.trigger, event.id`,
        [userId, deviceId],
    );

    const eventsByDevice = new Map();
    for (const row of events.rows) {
        const key = Number(row.device_id);
        if (!eventsByDevice.has(key)) eventsByDevice.set(key, []);
        const { deviceIds: _ignored, ...event } = publicEvent({ ...row, device_ids: [] });
        eventsByDevice.get(key).push(event);
    }

    return devices.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        type: row.type,
        hardwareId: row.hardware_id,
        room: { id: Number(row.room_id), name: row.room_name },
        createdAt: row.created_at,
        defaultState: row.default_state_id ? lightState(row) : null,
        events: eventsByDevice.get(Number(row.id)) || [],
    }));
}

async function loadEvents(db, userId, eventId = null) {
    const result = await db.query(
        `SELECT event.*, COALESCE(ARRAY_AGG(device_event.device_id) FILTER (WHERE device_event.device_id IS NOT NULL), '{}') AS device_ids
         FROM event
         LEFT JOIN device_event ON device_event.event_id = event.id
         WHERE event.user_id = $1 AND ($2::BIGINT IS NULL OR event.id = $2)
         GROUP BY event.id
         ORDER BY event.trigger, event.id`,
        [userId, eventId],
    );
    return result.rows.map(publicEvent);
}

async function assertRoom(db, userId, roomId) {
    const result = await db.query('SELECT id FROM room WHERE id = $1 AND user_id = $2', [roomId, userId]);
    if (!result.rows[0]) fail(404, 'Room not found.');
}

async function assertLightIds(db, userId, deviceIds) {
    if (deviceIds.length === 0) return;
    const result = await db.query(`SELECT id, type FROM device WHERE user_id = $1 AND id = ANY($2::BIGINT[])`, [
        userId,
        deviceIds,
    ]);
    if (result.rows.length !== deviceIds.length) fail(400, 'One or more devices were not found.');
    if (result.rows.some((row) => row.type !== 'light')) fail(400, 'Events can only be linked to lights.');
}

function parseDeviceIds(value) {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return fail(400, 'deviceIds must be an array.');
    return [...new Set(value.map((id) => parseId(id, 'device id')))];
}

async function withTransaction(pool, work) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/* ---------- routes ---------- */

function registerApi(app, { pool, currentUser }) {
    const triggerRuns = new Map();

    // Latest saved default for a light, read fresh from the database.
    async function currentDefaultState(deviceId) {
        const result = await pool.query(
            'SELECT color, brightness, pulse FROM default_state WHERE light_id = $1 ORDER BY id DESC LIMIT 1',
            [deviceId],
        );
        return result.rows[0] ? lightState(result.rows[0]) : null;
    }

    // Pushes a light's default state to Home Assistant immediately.
    // If an alert is running on that light, it's left alone; the alert's timer
    // switches to the newest default when it ends.
    async function applyDefaultState(device) {
        if (!device.hardwareId) return { status: 'skipped', reason: 'no_hardware_id' };
        if (triggerRuns.has(device.hardwareId)) return { status: 'deferred', reason: 'alert_active' };

        try {
            if (device.defaultState) await callHomeAssistant(device.hardwareId, device.defaultState);
            else await turnOffHomeAssistant(device.hardwareId);
            return { status: 'applied' };
        } catch (error) {
            console.error(error);
            return { status: 'failed', reason: error.message };
        }
    }

    function cancelTriggerRun(hardwareId) {
        const run = triggerRuns.get(hardwareId);
        if (!run) return;

        run.cancelled = true;
        if (run.pulseTimer) clearTimeout(run.pulseTimer);
        if (run.expiryTimer) clearTimeout(run.expiryTimer);
        triggerRuns.delete(hardwareId);
    }

    async function startTriggerRun(command) {
        cancelTriggerRun(command.hardwareId);

        const run = { cancelled: false, pulseTimer: null, expiryTimer: null, pending: Promise.resolve() };
        triggerRuns.set(command.hardwareId, run);
        const isCurrent = () => triggerRuns.get(command.hardwareId) === run && !run.cancelled;

        try {
            await callHomeAssistant(command.hardwareId, command.alertState);
        } catch (error) {
            if (isCurrent()) {
                triggerRuns.delete(command.hardwareId);
            }
            throw error;
        }

        if (!isCurrent()) return;

        if (command.alertState.pulse > 0) {
            const halfCycle = Math.max(1, Math.floor(command.alertState.pulse / 2));
            const schedulePulse = (turnOn) => {
                if (!isCurrent()) return;

                run.pulseTimer = setTimeout(async () => {
                    run.pulseTimer = null;
                    if (!isCurrent()) return;

                    run.pending = run.pending.then(async () => {
                        if (!isCurrent()) return;
                        try {
                            if (turnOn) await callHomeAssistant(command.hardwareId, command.alertState);
                            else await turnOffHomeAssistant(command.hardwareId);
                        } catch (error) {
                            console.error(error);
                        }
                    });
                    await run.pending;

                    schedulePulse(!turnOn);
                }, halfCycle);
            };

            // The initial call above starts the light on; the first scheduled action turns it off.
            schedulePulse(false);
        }

        run.expiryTimer = setTimeout(async () => {
            if (!isCurrent()) return;

            run.cancelled = true;
            if (run.pulseTimer) clearTimeout(run.pulseTimer);

            try {
                await run.pending;
                // Read the default again so a default changed during the alert is respected.
                const revertTo = await currentDefaultState(command.deviceId);
                if (revertTo) {
                    await callHomeAssistant(command.hardwareId, revertTo);
                } else {
                    await turnOffHomeAssistant(command.hardwareId);
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (triggerRuns.get(command.hardwareId) === run) {
                    triggerRuns.delete(command.hardwareId);
                }
            }
        }, command.durationSeconds * 1000);
    }

    // Wraps a handler so it has a signed-in user and API errors become JSON responses.
    const route =
        (handler, { auth = true } = {}) =>
        async (request, response) => {
            try {
                const user = auth ? await currentUser(request) : null;
                if (auth && !user) return response.status(401).json({ error: 'You must be signed in.' });
                request.authenticatedUser = user;
                return await handler(request, response, user);
            } catch (error) {
                if (error instanceof ApiError) return response.status(error.status).json({ error: error.message });
                if (error.code === '23505') return response.status(409).json({ error: 'That already exists.' });
                console.error(error);
                return response.status(500).json({ error: 'Something went wrong on the server.' });
            }
        };

    app.get(
        '/api/meta',
        route(
            async (_request, response) =>
                response.json({
                    triggerTypes: TRIGGER_TYPES.map((value) => ({
                        value,
                        label: TRIGGER_TYPES_LABELS[value] || value,
                    })),
                    deviceTypes: DEVICE_TYPES,
                    limits: LIMITS,
                }),
            { auth: false },
        ),
    );

    /* Rooms */

    app.get(
        '/api/rooms',
        route(async (_request, response, user) => response.json({ rooms: await loadRooms(pool, user.id) })),
    );

    app.post(
        '/api/rooms',
        route(async (request, response, user) => {
            const name = parseName(request.body.name, 'Room name');
            const result = await pool.query('INSERT INTO room (user_id, name) VALUES ($1, $2) RETURNING id, name', [
                user.id,
                name,
            ]);
            logEvent('room_created', { userId: user.id, roomId: result.rows[0].id, name });
            return response.status(201).json({ room: publicRoom(result.rows[0]) });
        }),
    );

    app.patch(
        '/api/rooms/:id',
        route(async (request, response, user) => {
            const id = parseId(request.params.id, 'room');
            const name = parseName(request.body.name, 'Room name');
            const result = await pool.query('UPDATE room SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id', [
                name,
                id,
                user.id,
            ]);
            if (!result.rows[0]) fail(404, 'Room not found.');
            const room = (await loadRooms(pool, user.id)).find((item) => item.id === id);
            logEvent('room_updated', { userId: user.id, roomId: id, name });
            return response.json({ room });
        }),
    );

    app.delete(
        '/api/rooms/:id',
        route(async (request, response, user) => {
            const id = parseId(request.params.id, 'room');
            const used = await pool.query('SELECT COUNT(*) FROM device WHERE room_id = $1 AND user_id = $2', [
                id,
                user.id,
            ]);
            if (Number(used.rows[0].count) > 0) fail(409, 'Move or remove the devices in this room first.');
            await pool.query('DELETE FROM room WHERE id = $1 AND user_id = $2', [id, user.id]);
            logEvent('room_deleted', { userId: user.id, roomId: id });
            return response.status(204).end();
        }),
    );

    /* Devices */

    app.get(
        '/api/devices',
        route(async (_request, response, user) => response.json({ devices: await loadDevices(pool, user.id) })),
    );

    app.get(
        '/api/home-assistant/lights',
        route(async (_request, response) => response.json({ lights: await listHomeAssistantLights() })),
    );

    app.get(
        '/api/devices/:id',
        route(async (request, response, user) => {
            const [device] = await loadDevices(pool, user.id, parseId(request.params.id, 'device'));
            if (!device) fail(404, 'Device not found.');
            return response.json({ device });
        }),
    );

    app.post(
        '/api/devices',
        route(async (request, response, user) => {
            const name = parseName(request.body.name, 'Device name', { min: 2, max: 150 });
            const type = String(request.body.type || 'light');
            if (!DEVICE_TYPES.includes(type)) fail(400, `Device type must be one of: ${DEVICE_TYPES.join(', ')}.`);
            const roomId = parseId(request.body.roomId, 'room');
            const hardwareId = parseHardwareId(request.body.hardwareId);
            await assertRoom(pool, user.id, roomId);

            const result = await pool.query(
                `INSERT INTO device (user_id, name, type, room_id, device_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [user.id, name, type, roomId, hardwareId],
            );
            const [device] = await loadDevices(pool, user.id, result.rows[0].id);
            logEvent('device_created', {
                userId: user.id,
                deviceId: result.rows[0].id,
                name,
                type,
                roomId,
                hasHardwareId: Boolean(hardwareId),
            });
            return response.status(201).json({ device });
        }),
    );

    app.patch(
        '/api/devices/:id',
        route(async (request, response, user) => {
            const id = parseId(request.params.id, 'device');
            const [existing] = await loadDevices(pool, user.id, id);
            if (!existing) fail(404, 'Device not found.');

            const body = request.body;
            const name = body.name !== undefined ? parseName(body.name, 'Device name', { min: 2 }) : existing.name;
            const roomId = body.roomId !== undefined ? parseId(body.roomId, 'room') : existing.room.id;
            const hardwareId = body.hardwareId !== undefined ? parseHardwareId(body.hardwareId) : existing.hardwareId;
            if (body.roomId !== undefined) await assertRoom(pool, user.id, roomId);

            await pool.query(
                'UPDATE device SET name = $1, room_id = $2, device_id = $3 WHERE id = $4 AND user_id = $5',
                [name, roomId, hardwareId, id, user.id],
            );
            const [device] = await loadDevices(pool, user.id, id);
            logEvent('device_updated', {
                userId: user.id,
                deviceId: id,
                name,
                roomId,
                hasHardwareId: Boolean(hardwareId),
            });
            return response.json({ device });
        }),
    );

    app.delete(
        '/api/devices/:id',
        route(async (request, response, user) => {
            const id = parseId(request.params.id, 'device');
            await pool.query('DELETE FROM device WHERE id = $1 AND user_id = $2', [id, user.id]);
            logEvent('device_deleted', { userId: user.id, deviceId: id });
            return response.status(204).end();
        }),
    );

    /* Default state (one per light) */

    app.put(
        '/api/devices/:id/default-state',
        route(async (request, response, user) => {
            const id = parseId(request.params.id, 'device');
            const color = parseColor(request.body.color);
            const brightness = parseIntInRange(request.body.brightness, LIMITS.brightness, 'Brightness');
            const pulse = parseIntInRange(request.body.pulse ?? 0, LIMITS.pulse, 'Pulse');

            await withTransaction(pool, async (db) => {
                const found = await db.query('SELECT type FROM device WHERE id = $1 AND user_id = $2 FOR UPDATE', [
                    id,
                    user.id,
                ]);
                if (!found.rows[0]) fail(404, 'Device not found.');
                if (found.rows[0].type !== 'light') fail(400, 'Only lights have a default state.');
                // The table has no unique constraint on light_id, so replace any existing row.
                await db.query('DELETE FROM default_state WHERE light_id = $1', [id]);
                await db.query(
                    'INSERT INTO default_state (light_id, color, brightness, pulse) VALUES ($1, $2, $3, $4)',
                    [id, color, brightness, pulse],
                );
            });

            const [device] = await loadDevices(pool, user.id, id);
            const lightUpdate = await applyDefaultState(device);
            logEvent('device_default_state_updated', {
                userId: user.id,
                deviceId: id,
                lightUpdate: lightUpdate.status,
            });
            return response.json({ device, lightUpdate });
        }),
    );

    app.delete(
        '/api/devices/:id/default-state',
        route(async (request, response, user) => {
            const id = parseId(request.params.id, 'device');
            await pool.query(
                `DELETE FROM default_state USING device
                 WHERE default_state.light_id = device.id AND device.id = $1 AND device.user_id = $2`,
                [id, user.id],
            );
            const [device] = await loadDevices(pool, user.id, id);
            if (!device) fail(404, 'Device not found.');
            const lightUpdate = await applyDefaultState(device);
            logEvent('device_default_state_deleted', {
                userId: user.id,
                deviceId: id,
                lightUpdate: lightUpdate.status,
            });
            return response.json({ device, lightUpdate });
        }),
    );

    /* Events */

    function parseEventBody(body, existing = null) {
        const pick = (key, parse) => (body[key] !== undefined ? parse(body[key]) : existing?.[key]);
        const event = {
            name: pick('name', (value) => (String(value).trim() === '' ? null : parseName(value, 'Event name'))),
            trigger: pick('trigger', (value) => {
                if (!TRIGGER_TYPES.includes(value)) fail(400, `Trigger must be one of: ${TRIGGER_TYPES.join(', ')}.`);
                return value;
            }),
            eventLength: pick('eventLength', (value) => parseIntInRange(value, LIMITS.eventLength, 'Event length')),
            color: pick('color', (value) => parseColor(value)),
            brightness: pick('brightness', (value) => parseIntInRange(value, LIMITS.brightness, 'Brightness')),
            pulse: pick('pulse', (value) => parseIntInRange(value, LIMITS.pulse, 'Pulse')),
        };
        for (const key of ['trigger', 'eventLength', 'color', 'brightness', 'pulse']) {
            if (event[key] === undefined || event[key] === null) fail(400, `${key} is required.`);
        }
        return event;
    }

    app.get(
        '/api/events',
        route(async (_request, response, user) => response.json({ events: await loadEvents(pool, user.id) })),
    );

    app.post(
        '/api/events',
        route(async (request, response, user) => {
            const event = parseEventBody(request.body);
            const deviceIds = parseDeviceIds(request.body.deviceIds) || [];
            await assertLightIds(pool, user.id, deviceIds);

            const id = await withTransaction(pool, async (db) => {
                const result = await db.query(
                    `INSERT INTO event (user_id, name, trigger, event_length, color, brightness, pulse)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [user.id, event.name, event.trigger, event.eventLength, event.color, event.brightness, event.pulse],
                );
                const eventId = result.rows[0].id;
                for (const deviceId of deviceIds) {
                    await db.query('INSERT INTO device_event (device_id, event_id) VALUES ($1, $2)', [
                        deviceId,
                        eventId,
                    ]);
                }
                return eventId;
            });

            const [created] = await loadEvents(pool, user.id, id);
            logEvent('event_created', {
                userId: user.id,
                eventId: id,
                trigger: event.trigger,
                deviceCount: deviceIds.length,
            });
            return response.status(201).json({ event: created });
        }),
    );

    app.patch(
        '/api/events/:id',
        route(async (request, response, user) => {
            const id = parseId(request.params.id, 'event');
            const [existing] = await loadEvents(pool, user.id, id);
            if (!existing) fail(404, 'Event not found.');
            const event = parseEventBody(request.body, existing);
            const deviceIds = parseDeviceIds(request.body.deviceIds);
            if (deviceIds) await assertLightIds(pool, user.id, deviceIds);

            await withTransaction(pool, async (db) => {
                await db.query(
                    `UPDATE event SET name = $1, trigger = $2, event_length = $3, color = $4, brightness = $5, pulse = $6
                     WHERE id = $7 AND user_id = $8`,
                    [
                        event.name,
                        event.trigger,
                        event.eventLength,
                        event.color,
                        event.brightness,
                        event.pulse,
                        id,
                        user.id,
                    ],
                );
                if (deviceIds) {
                    await db.query('DELETE FROM device_event WHERE event_id = $1', [id]);
                    for (const deviceId of deviceIds) {
                        await db.query('INSERT INTO device_event (device_id, event_id) VALUES ($1, $2)', [
                            deviceId,
                            id,
                        ]);
                    }
                }
            });

            const [updated] = await loadEvents(pool, user.id, id);
            logEvent('event_updated', {
                userId: user.id,
                eventId: id,
                trigger: event.trigger,
                deviceCount: deviceIds?.length,
            });
            return response.json({ event: updated });
        }),
    );

    app.delete(
        '/api/events/:id',
        route(async (request, response, user) => {
            const id = parseId(request.params.id, 'event');
            await pool.query('DELETE FROM event WHERE id = $1 AND user_id = $2', [id, user.id]);
            logEvent('event_deleted', { userId: user.id, eventId: id });
            return response.status(204).end();
        }),
    );

    /*
     * Trigger resolution. Given a detected sound, sends each linked light its alert state
     * through Home Assistant, holds it for the event length, then returns the light to its
     * current default state (or turns it off if it has none).
     */
    app.post(
        '/api/triggers/:trigger',
        route(
            async (request, response) => {
                const apiKeyAuthorized = hasTriggerApiKey(request);
                const user = apiKeyAuthorized ? null : await currentUser(request);
                if (!apiKeyAuthorized && !user) return response.status(401).json({ error: 'You must be signed in.' });
                request.authenticatedUser = user;

                const trigger = request.params.trigger;
                if (!TRIGGER_TYPES.includes(trigger)) fail(404, 'Unknown trigger.');

                const result = await pool.query(
                    `SELECT event.id AS event_id, event.name AS event_name, event.event_length,
                        event.color, event.brightness, event.pulse,
                        device.id AS device_id, device.name AS device_name, device.device_id AS hardware_id,
                        ds.color AS ds_color, ds.brightness AS ds_brightness, ds.pulse AS ds_pulse
                 FROM event
                 JOIN device_event ON device_event.event_id = event.id
                 JOIN device ON device.id = device_event.device_id
                 LEFT JOIN LATERAL (
                     SELECT color, brightness, pulse FROM default_state
                     WHERE default_state.light_id = device.id ORDER BY id DESC LIMIT 1
                 ) ds ON TRUE
                  WHERE ($1::BIGINT IS NULL OR event.user_id = $1) AND event.trigger = $2
                  ORDER BY device.id, event.id`,
                    [user?.id || null, trigger],
                );

                const commands = result.rows.map((row) => ({
                    deviceId: Number(row.device_id),
                    deviceName: row.device_name,
                    hardwareId: row.hardware_id,
                    eventId: Number(row.event_id),
                    eventName: row.event_name,
                    durationSeconds: row.event_length,
                    alertState: lightState(row),
                    revertTo:
                        row.ds_color === null && row.ds_brightness === null
                            ? null
                            : lightState({ color: row.ds_color, brightness: row.ds_brightness, pulse: row.ds_pulse }),
                }));

                if (result.rows.some((row) => !row.hardware_id)) {
                    fail(400, 'Every affected light must have a Home Assistant entity ID.');
                }

                const commandsByHardwareId = new Map();
                for (const command of commands) commandsByHardwareId.set(command.hardwareId, command);

                await Promise.all([...commandsByHardwareId.values()].map((command) => startTriggerRun(command)));

                logEvent('trigger_executed', {
                    userId: user?.id || null,
                    trigger,
                    commandCount: commands.length,
                    authorization: apiKeyAuthorized ? 'trigger_api_key' : 'session',
                });

                return response.json({
                    trigger,
                    triggerLabel: TRIGGER_TYPES_LABELS[trigger] || trigger,
                    commands,
                });
            },
            { auth: false },
        ),
    );

    // Anything else under /api is a JSON 404 rather than the React index page.
    app.use('/api', (_request, response) => response.status(404).json({ error: 'Not found.' }));
}

module.exports = { registerApi, LIMITS, parseColor, toHex };
