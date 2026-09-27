import { FormEvent, useMemo, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { api } from '../api';
import { describeLength, describePulse } from '../lightFormat';
import { BeaconEvent, Device, LightDraft, Meta } from '../types';
import Dialog from './Dialog';
import Icon from './Icon';
import LightOrb from './LightOrb';
import LightStateFields from './LightStateFields';

type Props = { meta: Meta; events: BeaconEvent[]; devices: Device[]; onChanged: () => Promise<void> };

export default function EventsView({ meta, events, devices, onChanged }: Props) {
    const [query, setQuery] = useState('');
    const [trigger, setTrigger] = useState('');
    const [lightId, setLightId] = useState('');
    const [editing, setEditing] = useState<BeaconEvent | 'new' | null>(null);

    const lights = devices.filter((device) => device.type === 'light');
    const lightName = (id: number) => lights.find((light) => light.id === id)?.name ?? 'Removed light';
    const titleOf = (event: BeaconEvent) => event.name || event.triggerLabel;

    const shown = useMemo(() => {
        const text = query.trim().toLowerCase();
        return events
            .filter((event) => !text || (event.name || event.triggerLabel).toLowerCase().includes(text))
            .filter((event) => !trigger || event.trigger === trigger)
            .filter((event) => !lightId || event.deviceIds.includes(Number(lightId)));
    }, [events, query, trigger, lightId]);

    const filtering = Boolean(query || trigger || lightId);
    const clearFilters = () => {
        setQuery('');
        setTrigger('');
        setLightId('');
    };

    return (
        <section aria-label="Events">
            <div className="toolbar">
                <div className="field">
                    <label className="field-label" htmlFor="event-filter-name">
                        Event Name
                    </label>
                    <input
                        id="event-filter-name"
                        className="input"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <div className="field">
                    <label className="field-label" htmlFor="event-filter-sound">
                        Sound
                    </label>
                    <select
                        id="event-filter-sound"
                        className="input"
                        value={trigger}
                        onChange={(event) => setTrigger(event.target.value)}
                    >
                        <option value="">All Sounds</option>
                        {meta.triggerTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label className="field-label" htmlFor="event-filter-light">
                        Light
                    </label>
                    <select
                        id="event-filter-light"
                        className="input"
                        value={lightId}
                        onChange={(event) => setLightId(event.target.value)}
                    >
                        <option value="">All Lights</option>
                        {lights.map((light) => (
                            <option key={light.id} value={light.id}>
                                {light.name}
                            </option>
                        ))}
                    </select>
                </div>
                <button className="btn btn-primary toolbar-add" type="button" onClick={() => setEditing('new')}>
                    New Event <Icon icon={FiPlus} />
                </button>
            </div>

            <div className="table-frame">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Sound</th>
                            <th scope="col">Light</th>
                            <th scope="col">Lights</th>
                            <th scope="col" className="col-actions">
                                <span className="visually-hidden">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((event) => (
                            <tr key={event.id}>
                                <td>
                                    <div className="cell-main">
                                        <LightOrb state={event} size="small" />
                                        <strong>{titleOf(event)}</strong>
                                    </div>
                                </td>
                                <td>{event.triggerLabel}</td>
                                <td>
                                    {event.colorHex.toUpperCase()}, {event.brightness}%
                                    <span className="cell-sub">
                                        {describePulse(event.pulse)}, for {describeLength(event.eventLength)}
                                    </span>
                                </td>
                                <td>
                                    {event.deviceIds.length === 0 ? (
                                        <span className="cell-muted">No lights</span>
                                    ) : (
                                        event.deviceIds.map(lightName).join(', ')
                                    )}
                                </td>
                                <td className="col-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        type="button"
                                        onClick={() => setEditing(event)}
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {shown.length === 0 &&
                    (filtering ? (
                        <div className="table-empty">
                            <h3>No events match</h3>
                            <p>Try a different name, sound or light.</p>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={clearFilters}>
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <div className="table-empty">
                            <h3>No events yet</h3>
                            <p>Create one, for example a fast red pulse on every light when the fire alarm sounds.</p>
                            <button className="btn btn-primary" type="button" onClick={() => setEditing('new')}>
                                Create an event
                            </button>
                        </div>
                    ))}
            </div>

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

    const remove = async () => {
        if (!event || !window.confirm(`Delete ${event.name || event.triggerLabel}?`)) return;
        setBusy(true);
        setError('');
        try {
            await api.deleteEvent(event.id);
            await onSaved();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not delete the event.');
            setBusy(false);
        }
    };

    return (
        <Dialog title={event ? 'Edit event' : 'New event'} onClose={onClose} wide>
            <form onSubmit={submit}>
                <div className="dialog-columns">
                    <div className="dialog-form">
                        <div className="field">
                            <label className="field-label" htmlFor="event-trigger">
                                Sound
                            </label>
                            <select
                                id="event-trigger"
                                className="input"
                                value={trigger}
                                onChange={(change) => setTrigger(change.target.value)}
                            >
                                {meta.triggerTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="event-name">
                                Name <span className="optional">optional</span>
                            </label>
                            <input
                                id="event-name"
                                className="input"
                                value={name}
                                onChange={(change) => setName(change.target.value)}
                                maxLength={150}
                                placeholder={meta.triggerTypes.find((type) => type.value === trigger)?.label}
                            />
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="event-length">
                                How long the alert lasts
                            </label>
                            <div className="inline-number">
                                <input
                                    id="event-length"
                                    className="input"
                                    type="number"
                                    min={meta.limits.eventLength.min}
                                    max={meta.limits.eventLength.max}
                                    value={eventLength}
                                    onChange={(change) => setEventLength(Number(change.target.value))}
                                    required
                                />
                                seconds
                            </div>
                        </div>

                        <fieldset className="field-group">
                            <legend className="field-label">Lights that respond</legend>
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
                        <h3 className="dialog-section-title">How the light looks</h3>
                        <LightStateFields value={look} onChange={setLook} limits={meta.limits} idPrefix="event" />
                    </div>
                </div>

                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    {event && (
                        <button className="btn btn-danger" type="button" onClick={remove} disabled={busy}>
                            Delete event
                        </button>
                    )}
                    <span className="spacer" />
                    <button className="btn btn-secondary" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : event ? 'Save event' : 'Create event'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}