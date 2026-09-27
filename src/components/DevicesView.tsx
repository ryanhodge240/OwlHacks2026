import { FormEvent, useMemo, useState } from 'react';
import { FiCamera, FiMic, FiPlus, FiSpeaker, FiSun } from 'react-icons/fi';
import { IconType } from 'react-icons';
import { api } from '../api';
import { describeLength, describePulse } from '../lightFormat';
import { BeaconEvent, Device, DeviceType, LightDraft, LightState, Meta, Room } from '../types';
import ConfirmDialog from './ConfirmDialog';
import Dialog from './Dialog';
import Icon from './Icon';
import LightOrb from './LightOrb';
import LightStateFields from './LightStateFields';

const TYPE_ICONS: Record<DeviceType, IconType> = {
    light: FiSun,
    microphone: FiMic,
    speaker: FiSpeaker,
    camera: FiCamera,
};
const TYPE_NAMES: Record<DeviceType, string> = {
    light: 'Light',
    microphone: 'Microphone',
    speaker: 'Speaker',
    camera: 'Camera',
};
const NEW_ROOM = 'new';
/** A light's everyday look is always solid (pulse 0). */
const FALLBACK_LOOK: LightDraft = { colorHex: '#ffd9a0', brightness: 60, pulse: 0 };

/** What a light is showing during a "Test a sound" run. */
export type Preview = { state: LightState; label: string };

/** Which pop-up is open. `isNew` shows a short welcome line after adding a light. */
type DialogState = { kind: 'add' } | { kind: 'edit'; device: Device; isNew?: boolean } | null;

type Props = {
    meta: Meta;
    rooms: Room[];
    devices: Device[];
    events: BeaconEvent[];
    previews: Record<number, Preview>;
    onChanged: () => Promise<void>;
    onGoToEvents: () => void;
};

export default function DevicesView({ meta, rooms, devices, events, previews, onChanged, onGoToEvents }: Props) {
    const [query, setQuery] = useState('');
    const [trigger, setTrigger] = useState('');
    const [roomId, setRoomId] = useState('');
    const [dialog, setDialog] = useState<DialogState>(null);

    const shown = useMemo(() => {
        const text = query.trim().toLowerCase();
        return devices
            .filter((device) => !text || device.name.toLowerCase().includes(text))
            .filter((device) => !trigger || device.events.some((event) => event.trigger === trigger))
            .filter((device) => !roomId || device.room.id === Number(roomId))
            .sort((a, b) => a.room.name.localeCompare(b.room.name) || a.name.localeCompare(b.name));
    }, [devices, query, trigger, roomId]);

    const filtering = Boolean(query || trigger || roomId);
    const clearFilters = () => {
        setQuery('');
        setTrigger('');
        setRoomId('');
    };

    // Always edit the freshest copy of the device (it changes after saves and refreshes).
    const editing =
        dialog?.kind === 'edit' ? (devices.find((device) => device.id === dialog.device.id) ?? dialog.device) : null;

    return (
        <section aria-label="Devices">
            <div className="toolbar">
                <div className="field">
                    <label className="field-label" htmlFor="device-filter-name">
                        Device Name
                    </label>
                    <input
                        id="device-filter-name"
                        className="input"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <div className="field">
                    <label className="field-label" htmlFor="device-filter-event">
                        Event Type
                    </label>
                    <select
                        id="device-filter-event"
                        className="input"
                        value={trigger}
                        onChange={(event) => setTrigger(event.target.value)}
                    >
                        <option value="">All Events</option>
                        {meta.triggerTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label className="field-label" htmlFor="device-filter-room">
                        Room
                    </label>
                    <select
                        id="device-filter-room"
                        className="input"
                        value={roomId}
                        onChange={(event) => setRoomId(event.target.value)}
                    >
                        <option value="">All Rooms</option>
                        {rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                                {room.name}
                            </option>
                        ))}
                    </select>
                </div>
                <button
                    className="btn btn-primary toolbar-add"
                    type="button"
                    onClick={() => setDialog({ kind: 'add' })}
                >
                    New Device <Icon icon={FiPlus} />
                </button>
            </div>

            <div className="table-frame">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Room</th>
                            <th scope="col">Events</th>
                            <th scope="col" className="col-actions">
                                <span className="visually-hidden">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((device) => (
                            <DeviceRow
                                key={device.id}
                                device={device}
                                preview={previews[device.id]}
                                onEdit={() => setDialog({ kind: 'edit', device })}
                            />
                        ))}
                    </tbody>
                </table>

                {shown.length === 0 &&
                    (filtering ? (
                        <div className="table-empty">
                            <h3>No devices match</h3>
                            <p>Try a different name, event or room.</p>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={clearFilters}>
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <div className="table-empty">
                            <h3>No devices yet</h3>
                            <button
                                className="btn btn-primary"
                                type="button"
                                onClick={() => setDialog({ kind: 'add' })}
                            >
                                Add your first device
                            </button>
                        </div>
                    ))}
            </div>

            {dialog?.kind === 'add' && (
                <AddDeviceDialog
                    meta={meta}
                    rooms={rooms}
                    onClose={() => setDialog(null)}
                    onAdded={async (device) => {
                        await onChanged();
                        // Lights go straight to their settings; other devices are done.
                        setDialog(device.type === 'light' ? { kind: 'edit', device, isNew: true } : null);
                    }}
                />
            )}

            {editing &&
                (editing.type === 'light' ? (
                    <LightSettingsDialog
                        meta={meta}
                        device={editing}
                        events={events}
                        isNew={dialog?.kind === 'edit' && Boolean(dialog.isNew)}
                        onGoToEvents={() => {
                            setDialog(null);
                            onGoToEvents();
                        }}
                        onClose={() => setDialog(null)}
                        onSaved={async () => {
                            setDialog(null);
                            await onChanged();
                        }}
                    />
                ) : (
                    <OtherDeviceDialog
                        device={editing}
                        onClose={() => setDialog(null)}
                        onRemoved={async () => {
                            setDialog(null);
                            await onChanged();
                        }}
                    />
                ))}
        </section>
    );
}

/* ---------- Table row ---------- */

type RowProps = {
    device: Device;
    preview?: Preview;
    onEdit: () => void;
};

function DeviceRow({ device, preview, onEdit }: RowProps) {
    const isLight = device.type === 'light';

    return (
        <tr className={preview ? 'is-previewing' : undefined}>
            <td>
                <div className="cell-main">
                    {isLight ? (
                        <LightOrb
                            state={preview?.state ?? device.defaultState}
                            size="small"
                            alerting={Boolean(preview)}
                            label={preview ? `Showing ${preview.label}` : 'Everyday look'}
                        />
                    ) : (
                        <span className="type-icon">
                            <Icon icon={TYPE_ICONS[device.type]} />
                        </span>
                    )}
                    <div>
                        <strong>{device.name}</strong>
                        <span className="cell-sub" aria-live="polite">
                            {preview ? `Showing ${preview.label}` : TYPE_NAMES[device.type]}
                        </span>
                    </div>
                </div>
            </td>
            <td>{device.room.name}</td>
            <td>
                {!isLight ? (
                    <span className="cell-muted">Listens for sounds</span>
                ) : device.events.length === 0 ? (
                    <span className="cell-muted">No events</span>
                ) : (
                    <div className="event-links">
                        {device.events.map((event) => (
                            <span key={event.id} className="event-link">
                                <span className="color-dot" style={{ background: event.colorHex }} />
                                {event.name || event.triggerLabel}
                            </span>
                        ))}
                    </div>
                )}
            </td>
            <td className="col-actions">
                <button className="btn btn-primary btn-sm" type="button" onClick={onEdit}>
                    Edit
                </button>
            </td>
        </tr>
    );
}

/* ---------- Light settings: everyday look + which events it reacts to ---------- */

function LightSettingsDialog({
    meta,
    device,
    events,
    isNew,
    onGoToEvents,
    onClose,
    onSaved,
}: {
    meta: Meta;
    device: Device;
    events: BeaconEvent[];
    isNew: boolean;
    onGoToEvents: () => void;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const saved = device.defaultState;
    // New lights start "on" so the colour picker is the first thing you see.
    const [staysOn, setStaysOn] = useState(isNew || Boolean(saved));
    const [look, setLook] = useState<LightDraft>(
        saved ? { colorHex: saved.colorHex, brightness: saved.brightness, pulse: 0 } : FALLBACK_LOOK,
    );
    const initiallyLinked = useMemo(
        () => events.filter((event) => event.deviceIds.includes(device.id)).map((event) => event.id),
        [events, device.id],
    );
    const [linked, setLinked] = useState<number[]>(initiallyLinked);
    const [confirmingRemove, setConfirmingRemove] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const toggleEvent = (id: number) =>
        setLinked((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

    const save = async (formEvent: FormEvent<HTMLFormElement>) => {
        formEvent.preventDefault();
        setBusy(true);
        setError('');
        try {
            // 1. Everyday look: always solid
            if (staysOn) await api.setDefaultState(device.id, { ...look, pulse: 0 });
            else if (saved) await api.clearDefaultState(device.id);

            // 2. Events: only update the ones whose link to this light changed
            const changed = events.filter((event) => linked.includes(event.id) !== initiallyLinked.includes(event.id));
            for (const event of changed) {
                const deviceIds = linked.includes(event.id)
                    ? [...event.deviceIds, device.id]
                    : event.deviceIds.filter((id) => id !== device.id);
                await api.updateEvent(event.id, {
                    name: event.name ?? '',
                    trigger: event.trigger,
                    eventLength: event.eventLength,
                    colorHex: event.colorHex,
                    brightness: event.brightness,
                    pulse: event.pulse,
                    deviceIds,
                });
            }

            await onSaved();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not save the light.');
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        setError('');
        try {
            await api.deleteDevice(device.id);
            await onSaved();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not remove the device.');
            setBusy(false);
        }
    };

    return (
        <Dialog title={isNew ? `Set up ${device.name}` : device.name} onClose={onClose} wide>
            <form onSubmit={save}>
                <p className="dialog-intro">
                    {isNew ? `${device.name} was added to ${device.room.name}. ` : `Light in ${device.room.name}. `}
                    Choose how it looks day to day, and which sounds make it flash.
                </p>
                <p className="field-hint">
                    Hardware ID: <span>{device.hardwareId ?? 'Not set'}</span>
                </p>

                {/* ---- 1. Everyday look ---- */}
                <section className="settings-step" aria-labelledby="step-look">
                    <div className="settings-step-head">
                        <span className="step-number">1</span>
                        <div>
                            <h3 id="step-look" className="dialog-section-title">
                                When it's quiet
                            </h3>
                            <p className="field-hint">
                                A solid colour the light shows normally, and goes back to after an alert.
                            </p>
                        </div>
                    </div>

                    <div className="choice-row" role="radiogroup" aria-labelledby="step-look">
                        <label className={`choice${staysOn ? ' is-selected' : ''}`}>
                            <input type="radio" checked={staysOn} onChange={() => setStaysOn(true)} />
                            <span>
                                <strong>Stay on</strong>
                                <small>Glow in a colour you pick</small>
                            </span>
                        </label>
                        <label className={`choice${!staysOn ? ' is-selected' : ''}`}>
                            <input type="radio" checked={!staysOn} onChange={() => setStaysOn(false)} />
                            <span>
                                <strong>Stay off</strong>
                                <small>Only light up for alerts</small>
                            </span>
                        </label>
                    </div>

                    {staysOn && (
                        <div className="settings-step-body">
                            <LightStateFields
                                value={look}
                                onChange={setLook}
                                limits={meta.limits}
                                idPrefix="everyday"
                                showPulse={false}
                            />
                            <p className="field-hint">
                                {look.colorHex.toUpperCase()}, {look.brightness}%,{' '}
                                {describePulse(look.pulse).toLowerCase()}
                            </p>
                        </div>
                    )}
                </section>

                {/* ---- 2. Events ---- */}
                <section className="settings-step" aria-labelledby="step-events">
                    <div className="settings-step-head">
                        <span className="step-number">2</span>
                        <div>
                            <h3 id="step-events" className="dialog-section-title">
                                When a sound is heard
                            </h3>
                            <p className="field-hint">Tick the events this light should react to.</p>
                        </div>
                    </div>

                    {events.length === 0 ? (
                        <p className="field-hint">
                            You don't have any events yet.{' '}
                            <button className="text-button" type="button" onClick={onGoToEvents}>
                                Create one on the Events tab
                            </button>
                        </p>
                    ) : (
                        <ul className="event-pick-list">
                            {events.map((event) => {
                                const isOn = linked.includes(event.id);
                                return (
                                    <li key={event.id} className={`event-pick${isOn ? ' is-selected' : ''}`}>
                                        <label className="event-pick-main">
                                            <input
                                                type="checkbox"
                                                checked={isOn}
                                                onChange={() => toggleEvent(event.id)}
                                            />
                                            <LightOrb state={event} size="small" />
                                            <span className="event-pick-text">
                                                <strong>{event.name || event.triggerLabel}</strong>
                                                <small>
                                                    {event.name ? `${event.triggerLabel} · ` : ''}
                                                    {event.colorHex.toUpperCase()}, {event.brightness}%,{' '}
                                                    {describePulse(event.pulse).toLowerCase()}, for{' '}
                                                    {describeLength(event.eventLength)}
                                                </small>
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                {error && !confirmingRemove && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => setConfirmingRemove(true)}
                        disabled={busy}
                    >
                        Remove device
                    </button>
                    <span className="spacer" />
                    <button className="btn btn-secondary" type="button" onClick={onClose}>
                        {isNew ? 'Skip for now' : 'Cancel'}
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>

            {confirmingRemove && (
                <ConfirmDialog
                    title="Remove device?"
                    message={
                        <>
                            Are you sure you want to remove <strong>{device.name}</strong>? Its settings and event links
                            are removed too.
                        </>
                    }
                    confirmLabel="Remove"
                    busyLabel="Removing…"
                    busy={busy}
                    error={error}
                    onConfirm={remove}
                    onCancel={() => {
                        setConfirmingRemove(false);
                        setError('');
                    }}
                />
            )}
        </Dialog>
    );
}

/* ---------- Microphones, speakers, cameras: nothing to set, just details ---------- */

function OtherDeviceDialog({
    device,
    onClose,
    onRemoved,
}: {
    device: Device;
    onClose: () => void;
    onRemoved: () => Promise<void>;
}) {
    const [confirmingRemove, setConfirmingRemove] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const remove = async () => {
        setBusy(true);
        setError('');
        try {
            await api.deleteDevice(device.id);
            await onRemoved();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not remove the device.');
            setBusy(false);
        }
    };

    return (
        <Dialog title={device.name} onClose={onClose}>
            <div className="device-summary">
                <span className="type-icon">
                    <Icon icon={TYPE_ICONS[device.type]} />
                </span>
                <dl>
                    <dt>Type</dt>
                    <dd>{TYPE_NAMES[device.type]}</dd>
                    <dt>Room</dt>
                    <dd>{device.room.name}</dd>
                    <dt>Hardware ID</dt>
                    <dd>{device.hardwareId ?? 'Not set'}</dd>
                </dl>
            </div>
            <p className="field-hint">
                {TYPE_NAMES[device.type]}s don't light up. Beacon uses them to hear or capture sounds.
            </p>

            <div className="dialog-actions">
                <button className="btn btn-danger" type="button" onClick={() => setConfirmingRemove(true)}>
                    Remove device
                </button>
                <span className="spacer" />
                <button className="btn btn-primary" type="button" onClick={onClose}>
                    Done
                </button>
            </div>

            {confirmingRemove && (
                <ConfirmDialog
                    title="Remove device?"
                    message={
                        <>
                            Are you sure you want to remove <strong>{device.name}</strong>?
                        </>
                    }
                    confirmLabel="Remove"
                    busyLabel="Removing…"
                    busy={busy}
                    error={error}
                    onConfirm={remove}
                    onCancel={() => {
                        setConfirmingRemove(false);
                        setError('');
                    }}
                />
            )}
        </Dialog>
    );
}

/* ---------- Add device ---------- */

function AddDeviceDialog({
    meta,
    rooms,
    onClose,
    onAdded,
}: {
    meta: Meta;
    rooms: Room[];
    onClose: () => void;
    onAdded: (device: Device) => Promise<void>;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<DeviceType>('light');
    const [roomChoice, setRoomChoice] = useState(rooms[0] ? String(rooms[0].id) : NEW_ROOM);
    const [newRoom, setNewRoom] = useState('');
    const [hardwareId, setHardwareId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const roomId = roomChoice === NEW_ROOM ? (await api.createRoom(newRoom)).id : Number(roomChoice);
            const device = await api.createDevice({ name, type, roomId, hardwareId });
            await onAdded(device);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not add the device.');
            setBusy(false);
        }
    };

    return (
        <Dialog title="New device" onClose={onClose}>
            <form className="dialog-form" onSubmit={submit}>
                <div className="field">
                    <label className="field-label" htmlFor="device-name">
                        Name
                    </label>
                    <input
                        id="device-name"
                        className="input"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        minLength={2}
                        maxLength={150}
                        required
                        placeholder="Bedside lamp"
                    />
                </div>

                <div className="field">
                    <label className="field-label" htmlFor="device-type">
                        Type
                    </label>
                    <select
                        id="device-type"
                        className="input"
                        value={type}
                        onChange={(event) => setType(event.target.value as DeviceType)}
                    >
                        {meta.deviceTypes.map((value) => (
                            <option key={value} value={value}>
                                {TYPE_NAMES[value]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="field">
                    <label className="field-label" htmlFor="device-room">
                        Room
                    </label>
                    <select
                        id="device-room"
                        className="input"
                        value={roomChoice}
                        onChange={(event) => setRoomChoice(event.target.value)}
                    >
                        {rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                                {room.name}
                            </option>
                        ))}
                        <option value={NEW_ROOM}>New room…</option>
                    </select>
                    {roomChoice === NEW_ROOM && (
                        <input
                            className="input"
                            aria-label="New room name"
                            value={newRoom}
                            onChange={(event) => setNewRoom(event.target.value)}
                            required
                            maxLength={150}
                            placeholder="Bedroom"
                        />
                    )}
                </div>

                <div className="field">
                    <label className="field-label" htmlFor="device-hardware">
                        Hardware ID <span className="optional">optional</span>
                    </label>
                    <input
                        id="device-hardware"
                        className="input"
                        value={hardwareId}
                        onChange={(event) => setHardwareId(event.target.value)}
                        maxLength={64}
                        placeholder="beacon-001"
                    />
                    <p className="field-hint">
                        The ID the physical device reports, used when Beacon sends it commands.
                    </p>
                </div>

                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    <button className="btn btn-secondary" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                        {busy ? 'Adding…' : type === 'light' ? 'Next: set up the light' : 'Add device'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
