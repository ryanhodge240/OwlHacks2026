import React, { FormEvent, useState } from 'react';
import { FiBell, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { api } from '../api';
import { describeLength, describePulse } from '../lightFormat';
import { BeaconEvent, Device, LightDraft, Meta } from '../types';
import Dialog from './Dialog';
import Icon from './Icon';
import LightOrb from './LightOrb';
import LightStateFields from './LightStateFields';

type Props = { meta: Meta; events: BeaconEvent[]; devices: Device[]; onChanged: () => Promise<void> };

export default function EventsView({ meta, events, devices, onChanged }: Props) {
    const [editing, setEditing] = useState<BeaconEvent | 'new' | null>(null);
    const [error, setError] = useState('');
    const lights = devices.filter((device) => device.type === 'light');
    const lightName = (id: number) => lights.find((light) => light.id === id)?.name ?? 'Removed light';

    const remove = async (event: BeaconEvent) => {
        if (!window.confirm(`Delete ${event.name || event.triggerLabel}?`)) return;
        try {
            await api.deleteEvent(event.id);
            await onChanged();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not delete the event.');
        }
    };

    return (
        <section aria-labelledby="events-heading">
            <div className="view-head">
                <div>
                    <h1 id="events-heading">Events</h1>
                    <p>Choose a sound, how the light should look when it's heard, and which lights respond.</p>
                </div>
                <button className="primary-button compact" type="button" onClick={() => setEditing('new')}>
                    <Icon icon={FiPlus} /> New event
                </button>
            </div>

            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}

            {events.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">
                        <Icon icon={FiBell} />
                    </span>
                    <h3>No events yet</h3>
                    <p>Create one, for example a red fast pulse on every light when the fire alarm sounds.</p>
                    <button className="primary-button compact" type="button" onClick={() => setEditing('new')}>
                        Create an event
                    </button>
                </div>
            ) : (
                <div className="event-list">
                    {events.map((event) => (
                        <article className="event-row" key={event.id}>
                            <LightOrb state={event} size="small" />
                            <div className="event-main">
                                <h3>{event.name || event.triggerLabel}</h3>
                                <p>
                                    Heard: <strong>{event.triggerLabel}</strong>
                                </p>
                                <p>
                                    {event.colorHex.toUpperCase()}, {event.brightness}%,{' '}
                                    {describePulse(event.pulse).toLowerCase()}, for {describeLength(event.eventLength)}
                                </p>
                                <p className="event-lights">
                                    {event.deviceIds.length === 0
                                        ? 'Not linked to any lights'
                                        : event.deviceIds.map(lightName).join(', ')}
                                </p>
                            </div>
                            <div className="row-actions">
                                <button
                                    className="icon-button"
                                    type="button"
                                    aria-label={`Edit ${event.name || event.triggerLabel}`}
                                    onClick={() => setEditing(event)}
                                >
                                    <Icon icon={FiEdit2} />
                                </button>
                                <button
                                    className="icon-button"
                                    type="button"
                                    aria-label={`Delete ${event.name || event.triggerLabel}`}
                                    onClick={() => remove(event)}
                                >
                                    <Icon icon={FiTrash2} />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {editing && (
                <EventDialog
                    meta={meta}
                    lights={lights}
                    event={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => {
                        setEditing(null);
                        await onChanged();
                    }}
                />
            )}
        </section>
    );
}

function EventDialog({
    meta,
    lights,
    event,
    onClose,
    onSaved,
}: {
    meta: Meta;
    lights: Device[];
    event: BeaconEvent | null;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [name, setName] = useState(event?.name ?? '');
    const [trigger, setTrigger] = useState(event?.trigger ?? meta.triggerTypes[0]?.value ?? '');
    const [eventLength, setEventLength] = useState(event?.eventLength ?? 15);
    const [look, setLook] = useState<LightDraft>(
        event
            ? { colorHex: event.colorHex, brightness: event.brightness, pulse: event.pulse }
            : { colorHex: '#ff3b30', brightness: 100, pulse: 800 },
    );
    const [deviceIds, setDeviceIds] = useState<number[]>(event?.deviceIds ?? lights.map((light) => light.id));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const toggle = (id: number) =>
        setDeviceIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

    const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
        formEvent.preventDefault();
        setBusy(true);
        setError('');
        const input = { ...look, name, trigger, eventLength, deviceIds };
        try {
            if (event) await api.updateEvent(event.id, input);
            else await api.createEvent(input);
            await onSaved();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not save the event.');
            setBusy(false);
        }
    };

    return (
        <Dialog title={event ? 'Edit event' : 'New event'} onClose={onClose} wide>
            <form className="event-form" onSubmit={submit}>
                <div className="event-form-grid">
                    <div className="stack-form">
                        <label htmlFor="event-trigger">Sound</label>
                        <select
                            id="event-trigger"
                            value={trigger}
                            onChange={(change) => setTrigger(change.target.value)}
                        >
                            {meta.triggerTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>

                        <label htmlFor="event-name">
                            Name <span className="optional">optional</span>
                        </label>
                        <input
                            id="event-name"
                            value={name}
                            onChange={(change) => setName(change.target.value)}
                            maxLength={150}
                            placeholder={meta.triggerTypes.find((type) => type.value === trigger)?.label}
                        />

                        <label htmlFor="event-length">How long the alert lasts</label>
                        <div className="inline-number">
                            <input
                                id="event-length"
                                type="number"
                                min={meta.limits.eventLength.min}
                                max={meta.limits.eventLength.max}
                                value={eventLength}
                                onChange={(change) => setEventLength(Number(change.target.value))}
                                required
                            />
                            seconds
                        </div>

                        <fieldset>
                            <legend>Lights that respond</legend>
                            {lights.length === 0 ? (
                                <p className="field-hint">Add a light on the Devices tab to link it here.</p>
                            ) : (
                                <div className="check-list">
                                    {lights.map((light) => (
                                        <label key={light.id} className="check-item">
                                            <input
                                                type="checkbox"
                                                checked={deviceIds.includes(light.id)}
                                                onChange={() => toggle(light.id)}
                                            />
                                            <span>
                                                {light.name}
                                                <small>{light.room.name}</small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </fieldset>
                    </div>

                    <div>
                        <h3 className="subhead">How the light looks</h3>
                        <LightStateFields value={look} onChange={setLook} limits={meta.limits} idPrefix="event" />
                    </div>
                </div>

                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    <span className="spacer" />
                    <button className="ghost-button" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="primary-button compact" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : event ? 'Save event' : 'Create event'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
