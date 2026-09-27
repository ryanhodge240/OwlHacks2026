import { FormEvent, useMemo, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { api } from '../api';
import { Room } from '../types';
import Dialog from './Dialog';
import Icon from './Icon';

type Props = { rooms: Room[]; onChanged: () => Promise<void> };

export default function RoomsView({ rooms, onChanged }: Props) {
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<Room | 'new' | null>(null);

    const shown = useMemo(() => {
        const text = query.trim().toLowerCase();
        return rooms.filter((room) => !text || room.name.toLowerCase().includes(text));
    }, [rooms, query]);

    return (
        <section aria-label="Rooms">
            <div className="toolbar">
                <div className="field">
                    <label className="field-label" htmlFor="room-filter-name">
                        Room Name
                    </label>
                    <input
                        id="room-filter-name"
                        className="input"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <button className="btn btn-primary toolbar-add" type="button" onClick={() => setEditing('new')}>
                    New Room <Icon icon={FiPlus} />
                </button>
            </div>

            <div className="table-frame">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Devices</th>
                            <th scope="col" className="col-actions">
                                <span className="visually-hidden">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((room) => (
                            <tr key={room.id}>
                                <td>
                                    <strong>{room.name}</strong>
                                </td>
                                <td>
                                    {room.deviceCount === 0 ? (
                                        <span className="cell-muted">No devices</span>
                                    ) : (
                                        `${room.deviceCount} ${room.deviceCount === 1 ? 'device' : 'devices'}`
                                    )}
                                </td>
                                <td className="col-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        type="button"
                                        onClick={() => setEditing(room)}
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {shown.length === 0 &&
                    (query ? (
                        <div className="table-empty">
                            <h3>No rooms match</h3>
                            <p>Try a different name.</p>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setQuery('')}>
                                Clear filter
                            </button>
                        </div>
                    ) : (
                        <div className="table-empty">
                            <h3>No rooms yet</h3>
                            <p>Add the rooms in your home, or create one while adding a device.</p>
                            <button className="btn btn-primary" type="button" onClick={() => setEditing('new')}>
                                Add a room
                            </button>
                        </div>
                    ))}
            </div>

            {editing && (
                <RoomDialog
                    room={editing === 'new' ? null : editing}
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

function RoomDialog({
    room,
    onClose,
    onSaved,
}: {
    room: Room | null;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [name, setName] = useState(room?.name ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const hasDevices = Boolean(room && room.deviceCount > 0);

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await onSaved();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Something went wrong.');
            setBusy(false);
        }
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        run(() => (room ? api.renameRoom(room.id, name) : api.createRoom(name)));
    };

    return (
        <Dialog title={room ? 'Edit room' : 'New room'} onClose={onClose}>
            <form className="dialog-form" onSubmit={submit}>
                <div className="field">
                    <label className="field-label" htmlFor="room-name">
                        Name
                    </label>
                    <input
                        id="room-name"
                        className="input"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={150}
                        required
                        placeholder="Kitchen"
                    />
                </div>

                {hasDevices && (
                    <p className="field-hint">
                        This room has {room?.deviceCount} {room?.deviceCount === 1 ? 'device' : 'devices'}. Move or
                        remove them before deleting the room.
                    </p>
                )}

                {error && (
                    <p className="form-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="dialog-actions">
                    {room && (
                        <button
                            className="btn btn-danger"
                            type="button"
                            disabled={busy || hasDevices}
                            onClick={() => run(() => api.deleteRoom(room.id))}
                        >
                            Delete room
                        </button>
                    )}
                    <span className="spacer" />
                    <button className="btn btn-secondary" type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                        {busy ? 'Saving…' : room ? 'Save' : 'Add room'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
