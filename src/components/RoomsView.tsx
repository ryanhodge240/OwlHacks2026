import React, { FormEvent, useState } from 'react';
import { FiCheck, FiEdit2, FiHome, FiTrash2, FiX } from 'react-icons/fi';
import { api } from '../api';
import { Room } from '../types';
import Icon from './Icon';

type Props = { rooms: Room[]; onChanged: () => Promise<void> };

export default function RoomsView({ rooms, onChanged }: Props) {
    const [name, setName] = useState('');
    const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
    const [error, setError] = useState('');

    const attempt = async (action: () => Promise<unknown>) => {
        setError('');
        try {
            await action();
            await onChanged();
            return true;
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Something went wrong.');
            return false;
        }
    };

    const add = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (await attempt(() => api.createRoom(name))) setName('');
    };

    return (
        <section aria-labelledby="rooms-heading">
            <div className="view-head">
                <div>
                    <h1 id="rooms-heading">Rooms</h1>
                    <p>Rooms group your devices. A room can be deleted once it has no devices in it.</p>
                </div>
            </div>

            <form className="inline-form" onSubmit={add}>
                <label htmlFor="room-name" className="visually-hidden">
                    Room name
                </label>
                <input
                    id="room-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={150}
                    required
                    placeholder="Kitchen"
                />
                <button className="primary-button compact" type="submit">
                    Add room
                </button>
            </form>

            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}

            {rooms.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">
                        <Icon icon={FiHome} />
                    </span>
                    <h3>No rooms yet</h3>
                    <p>Add the rooms in your home, or create one while adding a device.</p>
                </div>
            ) : (
                <ul className="room-list">
                    {rooms.map((room) => (
                        <li key={room.id}>
                            {renaming?.id === room.id ? (
                                <form
                                    className="rename-form"
                                    onSubmit={async (event) => {
                                        event.preventDefault();
                                        if (await attempt(() => api.renameRoom(room.id, renaming.name)))
                                            setRenaming(null);
                                    }}
                                >
                                    <input
                                        aria-label={`New name for ${room.name}`}
                                        value={renaming.name}
                                        onChange={(event) => setRenaming({ id: room.id, name: event.target.value })}
                                        autoFocus
                                        required
                                        maxLength={150}
                                    />
                                    <button className="icon-button" type="submit" aria-label="Save name">
                                        <Icon icon={FiCheck} />
                                    </button>
                                    <button
                                        className="icon-button"
                                        type="button"
                                        aria-label="Cancel rename"
                                        onClick={() => setRenaming(null)}
                                    >
                                        <Icon icon={FiX} />
                                    </button>
                                </form>
                            ) : (
                                <>
                                    <span className="room-list-name">{room.name}</span>
                                    <span className="room-list-count">
                                        {room.deviceCount} {room.deviceCount === 1 ? 'device' : 'devices'}
                                    </span>
                                    <button
                                        className="icon-button"
                                        type="button"
                                        aria-label={`Rename ${room.name}`}
                                        onClick={() => setRenaming({ id: room.id, name: room.name })}
                                    >
                                        <Icon icon={FiEdit2} />
                                    </button>
                                    <button
                                        className="icon-button"
                                        type="button"
                                        aria-label={`Delete ${room.name}`}
                                        disabled={room.deviceCount > 0}
                                        title={room.deviceCount > 0 ? 'Move or remove its devices first' : undefined}
                                        onClick={() => attempt(() => api.deleteRoom(room.id))}
                                    >
                                        <Icon icon={FiTrash2} />
                                    </button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
