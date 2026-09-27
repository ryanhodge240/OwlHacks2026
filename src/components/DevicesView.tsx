import React, { FormEvent, useState } from 'react';
import { FiCamera, FiMic, FiPlus, FiSpeaker, FiSun, FiTrash2 } from 'react-icons/fi';
import { IconType } from 'react-icons';
import { api } from '../api';
import { describeLength, describePulse } from '../lightFormat';
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
    const [adding, setAdding] = useState(false);
    const [editingDefault, setEditingDefault] = useState<Device | null>(null);
    const [error, setError] = useState('');

    const remove = async (device: Device) => {
        if (!window.confirm(`Remove ${device.name}? Its default state and event links are removed too.`)) return;
        try {
            await api.deleteDevice(device.id);
            await onChanged();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not remove the device.');
        }
    };

    const byRoom = rooms
        .map((room) => ({ room, devices: devices.filter((device) => device.room.id === room.id) }))
        .filter((group) => group.devices.length > 0);

    return (
        <section aria-labelledby="devices-heading">
            <div className="view-head">
                <div>
                    <h1 id="devices-heading">Devices</h1>
                    <p>Each light has a resting state and changes when a sound it listens for is detected.</p>
                </div>
                <button className="primary-button compact" type="button" onClick={() => setAdding(true)}>
                    <Icon icon={FiPlus} /> Add device
                </button>
            </div>

            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}

            {devices.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">
                        <Icon icon={FiSun} />
                    </span>
                    <h3>No devices yet</h3>
                    <p>Add a light and pick the room it lives in. You can set its default color right after.</p>
                    <button className="primary-button compact" type="button" onClick={() => setAdding(true)}>
                        Add your first device
                    </button>
                </div>
            ) : (
                byRoom.map(({ room, devices: roomDevices }) => (
                    <div className="room-group" key={room.id}>
                        <h2 className="room-name">
                            {room.name} <span>{roomDevices.length}</span>
                        </h2>
                        {roomDevices.map((device) => (
                            <DeviceRow
                                key={device.id}
                                device={device}
                                preview={previews[device.id]}
                                onPreview={(event) => onPreview(device.id, event)}
                                onEditDefault={() => setEditingDefault(device)}
                                onRemove={() => remove(device)}
                                onGoToEvents={onGoToEvents}
                            />
                        ))}
                    </div>
                ))
            )}

            {adding && (
                <AddDeviceDialog
                    meta={meta}
                    rooms={rooms}
                    onClose={() => setAdding(false)}
                    onAdded={async (device) => {
                        setAdding(false);
                        await onChanged();
                        if (device.type === 'light') setEditingDefault(device);
                    }}
                />
            )}

            {editingDefault && (
                <DefaultStateDialog
                    meta={meta}
                    device={editingDefault}
                    onClose={() => setEditingDefault(null)}
                    onSaved={async () => {
                        setEditingDefault(null);
                        await onChanged();
                    }}
                />
            )}
        </section>
    );
}

type RowProps = {
    device: Device;
    preview?: Preview;
    onPreview: (event: DeviceEvent) => void;
    onEditDefault: () => void;
    onRemove: () => void;
    onGoToEvents: () => void;
};

function DeviceRow({ device, preview, onPreview, onEditDefault, onRemove, onGoToEvents }: RowProps) {
    const isLight = device.type === 'light';
    const shown = preview?.state ?? device.defaultState;

    return (
        <article className={`device-row${preview ? ' is-previewing' : ''}`} aria-label={device.name}>
            <div className="device-visual">
                {isLight ? (
                    <LightOrb
                        state={shown}
                        alerting={Boolean(preview)}
                        label={preview ? `Showing ${preview.label}` : 'Default state'}
                    />
                ) : (
                    <span className="device-type-icon">
                        <Icon icon={TYPE_ICONS[device.type]} />
                    </span>
                )}
                <span className="device-visual-caption" aria-live="polite">
                    {preview ? preview.label : isLight ? 'Resting' : TYPE_NAMES[device.type]}
                </span>
            </div>

            <div className="device-main">
                <div className="device-title">
                    <h3>{device.name}</h3>
                    {device.hardwareId && <code>{device.hardwareId}</code>}
                    <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remove ${device.name}`}
                        onClick={onRemove}
                    >
                        <Icon icon={FiTrash2} />
                    </button>
                </div>

                {isLight ? (
                    <div className="device-states">
                        <div className="state-block">
                            <h4>Default</h4>
                            {device.defaultState ? (
                                <p className="state-line">
                                    <span className="dot" style={{ background: device.defaultState.colorHex }} />
                                    <span>
                                        {device.defaultState.colorHex.toUpperCase()}, {device.defaultState.brightness}%,{' '}
                                        {describePulse(device.defaultState.pulse).toLowerCase()}
                                    </span>
                                </p>
                            ) : (
                                <p className="state-line muted">Not set. The light stays off between alerts.</p>
                            )}
                            <button className="text-button" type="button" onClick={onEditDefault}>
                                {device.defaultState ? 'Change default' : 'Set default'}
                            </button>
                        </div>

                        <div className="state-block">
                            <h4>When a sound is detected</h4>
                            {device.events.length === 0 ? (
                                <p className="state-line muted">
                                    No events linked.{' '}
                                    <button className="text-button" type="button" onClick={onGoToEvents}>
                                        Link one
                                    </button>
                                </p>
                            ) : (
                                <ul className="event-chips">
                                    {device.events.map((event) => (
                                        <li key={event.id}>
                                            <button
                                                type="button"
                                                className="event-chip"
                                                onClick={() => onPreview(event)}
                                                title="Preview on this light"
                                            >
                                                <span className="dot" style={{ background: event.colorHex }} />
                                                <span className="event-chip-text">
                                                    <strong>{event.name || event.triggerLabel}</strong>
                                                    <small>
                                                        {event.colorHex.toUpperCase()}, {event.brightness}%,{' '}
                                                        {describePulse(event.pulse).toLowerCase()}, for{' '}
                                                        {describeLength(event.eventLength)}
                                                    </small>
                                                </span>
                                                <span className="event-chip-action">Preview</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="state-line muted">
                        {TYPE_NAMES[device.type]}s don't have a light state. Beacon uses them to hear or capture events.
                    </p>
                )}
            </div>
        </article>
    );
}

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
        <Dialog title="Add a device" onClose={onClose}>
            <form className="stack-form" onSubmit={submit}>
                <label htmlFor="device-name">Name</label>
                <input
                    id="device-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    minLength={2}
                    maxLength={150}
                    required
                    placeholder="Bedside lamp"
                />

                <label htmlFor="device-type">Type</label>
                <select id="device-type" value={type} onChange={(event) => setType(event.target.value as DeviceType)}>
                    {meta.deviceTypes.map((value) => (
                        <option key={value} value={value}>
                            {TYPE_NAMES[value]}
                        </option>
                    ))}
                </select>

                <label htmlFor="device-room">Room</label>
                <select id="device-room" value={roomChoice} onChange={(event) => setRoomChoice(event.target.value)}>
                    {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                            {room.name}
                        </option>
                    ))}
                    <option value={NEW_ROOM}>New room…</option>
                </select>
                {roomChoice === NEW_ROOM && (
                    <input
                        aria-label="New room name"
                        value={newRoom}
                        onChange={(event) => setNewRoom(event.target.value)}
                        required
                        maxLength={150}
                        placeholder="Bedroom"
                    />
                )}

                <label htmlFor="device-hardware">
                    Hardware ID <span className="optional">optional</span>
                </label>
                <input
                    id="device-hardware"
                    value={hardwareId}
                    onChange={(event) => setHardwareId(event.target.value)}
                    maxLength={64}
                    pattern="[a-zA-Z0-9_\-]{2,64}"
                    placeholder="beacon-001"
                />
                <p className="field-hint">The ID the physical device reports, used when Beacon sends it commands.</p>

                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    <button className="ghost-button" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="primary-button compact" type="submit" disabled={busy}>
                        {busy ? 'Adding…' : 'Continue to color selection'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}

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
            setError(caught instanceof Error ? caught.message : 'Could not save the default state.');
            setBusy(false);
        }
    };

    return (
        <Dialog title={`Default state for ${device.name}`} onClose={onClose} wide>
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
                            className="ghost-button danger"
                            type="button"
                            disabled={busy}
                            onClick={() => run(() => api.clearDefaultState(device.id))}
                        >
                            Clear default
                        </button>
                    )}
                    <span className="spacer" />
                    <button className="ghost-button" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="primary-button compact" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : 'Save default'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
