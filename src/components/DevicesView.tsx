import { FormEvent, useMemo, useState } from 'react';
import { FiCamera, FiMic, FiPlus, FiSpeaker, FiSun } from 'react-icons/fi';
import { IconType } from 'react-icons';
import { api } from '../api';
import { describeLength, describePulse, describeState } from '../lightFormat';
import { Device, DeviceEvent, DeviceType, LightDraft, LightState, Meta, Room } from '../types';
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
const FALLBACK_DEFAULT: LightDraft = { colorHex: '#ffd9a0', brightness: 60, pulse: 0 };

export type Preview = { state: LightState; label: string };

type DialogState = { kind: 'add' } | { kind: 'details'; deviceId: number } | { kind: 'default'; device: Device } | null;

type Props = {
    meta: Meta;
    rooms: Room[];
    devices: Device[];
    previews: Record<number, Preview>;
    onPreview: (deviceId: number, event: DeviceEvent) => void;
    onChanged: () => Promise<void>;
    onGoToEvents: () => void;
};

export default function DevicesView({ meta, rooms, devices, previews, onPreview, onChanged, onGoToEvents }: Props) {
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

    const detailsDevice = dialog?.kind === 'details' ? devices.find((device) => device.id === dialog.deviceId) : null;

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
                                onPreview={(event) => onPreview(device.id, event)}
                                onEdit={() => setDialog({ kind: 'details', deviceId: device.id })}
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
                            <p>Add a light and pick the room it lives in. You can set its resting color right after.</p>
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
                        setDialog(device.type === 'light' ? { kind: 'default', device } : null);
                    }}
                />
            )}

            {detailsDevice && (
                <DeviceDialog
                    device={detailsDevice}
                    preview={previews[detailsDevice.id]}
                    onPreview={(event) => onPreview(detailsDevice.id, event)}
                    onEditDefault={() => setDialog({ kind: 'default', device: detailsDevice })}
                    onGoToEvents={() => {
                        setDialog(null);
                        onGoToEvents();
                    }}
                    onClose={() => setDialog(null)}
                    onRemoved={async () => {
                        setDialog(null);
                        await onChanged();
                    }}
                />
            )}

            {dialog?.kind === 'default' && (
                <DefaultStateDialog
                    meta={meta}
                    device={dialog.device}
                    onClose={() => setDialog(null)}
                    onSaved={async () => {
                        setDialog(null);
                        await onChanged();
                    }}
                />
            )}
        </section>
    );
}

/* ---------- Table row ---------- */

type RowProps = {
    device: Device;
    preview?: Preview;
    onPreview: (event: DeviceEvent) => void;
    onEdit: () => void;
};

function DeviceRow({ device, preview, onPreview, onEdit }: RowProps) {
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
                            label={preview ? `Showing ${preview.label}` : 'Resting state'}
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
                            <button
                                key={event.id}
                                type="button"
                                className="event-link"
                                onClick={() => onPreview(event)}
                                title={`Preview on ${device.name}`}
                            >
                                <span className="color-dot" style={{ background: event.colorHex }} />
                                {event.name || event.triggerLabel}
                            </button>
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

/* ---------- Device details (the "Edit" dialog) ---------- */

function DeviceDialog({
    device,
    preview,
    onPreview,
    onEditDefault,
    onGoToEvents,
    onClose,
    onRemoved,
}: {
    device: Device;
    preview?: Preview;
    onPreview: (event: DeviceEvent) => void;
    onEditDefault: () => void;
    onGoToEvents: () => void;
    onClose: () => void;
    onRemoved: () => Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const isLight = device.type === 'light';

    const remove = async () => {
        if (!window.confirm(`Remove ${device.name}? Its default state and event links are removed too.`)) return;
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
        <Dialog title={device.name} onClose={onClose} wide={isLight}>
            <div className="device-summary">
                {isLight ? (
                    <LightOrb
                        state={preview?.state ?? device.defaultState}
                        alerting={Boolean(preview)}
                        label={preview ? `Showing ${preview.label}` : 'Resting state'}
                    />
                ) : (
                    <span className="type-icon">
                        <Icon icon={TYPE_ICONS[device.type]} />
                    </span>
                )}
                <dl>
                    <dt>Type</dt>
                    <dd>{TYPE_NAMES[device.type]}</dd>
                    <dt>Room</dt>
                    <dd>{device.room.name}</dd>
                    <dt>Hardware ID</dt>
                    <dd>{device.hardwareId ?? 'Not set'}</dd>
                    {preview && (
                        <>
                            <dt>Now showing</dt>
                            <dd aria-live="polite">{preview.label}</dd>
                        </>
                    )}
                </dl>
            </div>

            {isLight ? (
                <>
                    <div className="dialog-section">
                        <h3 className="dialog-section-title">Resting light</h3>
                        {device.defaultState ? (
                            <p className="state-line">
                                <span className="color-dot" style={{ background: device.defaultState.colorHex }} />
                                {describeState(device.defaultState)}
                            </p>
                        ) : (
                            <p className="field-hint state-line">Not set. The light stays off between alerts.</p>
                        )}
                        <button className="btn btn-secondary btn-sm" type="button" onClick={onEditDefault}>
                            {device.defaultState ? 'Change resting light' : 'Set resting light'}
                        </button>
                    </div>

                    <div className="dialog-section">
                        <h3 className="dialog-section-title">When a sound is detected</h3>
                        {device.events.length === 0 ? (
                            <p className="field-hint">
                                No events linked yet.{' '}
                                <button className="text-button" type="button" onClick={onGoToEvents}>
                                    Link one on the Events tab
                                </button>
                            </p>
                        ) : (
                            <ul className="preview-list">
                                {device.events.map((event) => (
                                    <li key={event.id} className="preview-item">
                                        <span className="color-dot" style={{ background: event.colorHex }} />
                                        <span className="preview-item-text">
                                            <strong>{event.name || event.triggerLabel}</strong>
                                            <small>
                                                {event.colorHex.toUpperCase()}, {event.brightness}%,{' '}
                                                {describePulse(event.pulse).toLowerCase()}, for{' '}
                                                {describeLength(event.eventLength)}
                                            </small>
                                        </span>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            type="button"
                                            onClick={() => onPreview(event)}
                                        >
                                            Preview
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : (
                <p className="field-hint">
                    {TYPE_NAMES[device.type]}s don't have a light state. Beacon uses them to hear or capture events.
                </p>
            )}

            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            <div className="dialog-actions">
                <button className="btn btn-danger" type="button" onClick={remove} disabled={busy}>
                    {busy ? 'Removing…' : 'Remove device'}
                </button>
                <span className="spacer" />
                <button className="btn btn-primary" type="button" onClick={onClose}>
                    Done
                </button>
            </div>
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
                        {busy ? 'Adding…' : type === 'light' ? 'Next: choose its color' : 'Add device'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

/* ---------- Resting (default) light state ---------- */

function DefaultStateDialog({
    meta,
    device,
    onClose,
    onSaved,
}: {
    meta: Meta;
    device: Device;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [draft, setDraft] = useState<LightDraft>(
        device.defaultState
            ? {
                  colorHex: device.defaultState.colorHex,
                  brightness: device.defaultState.brightness,
                  pulse: device.defaultState.pulse,
              }
            : FALLBACK_DEFAULT,
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await onSaved();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not save the resting light.');
            setBusy(false);
        }
    };

    return (
        <Dialog title={`Resting light for ${device.name}`} onClose={onClose} wide>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    run(() => api.setDefaultState(device.id, draft));
                }}
            >
                <p className="dialog-intro">
                    This is how the light looks when nothing is happening, and what it returns to after an alert ends.
                </p>
                <LightStateFields value={draft} onChange={setDraft} limits={meta.limits} idPrefix="default" />
                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    {device.defaultState && (
                        <button
                            className="btn btn-danger"
                            type="button"
                            disabled={busy}
                            onClick={() => run(() => api.clearDefaultState(device.id))}
                        >
                            Turn off resting light
                        </button>
                    )}
                    <span className="spacer" />
                    <button className="btn btn-secondary" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
