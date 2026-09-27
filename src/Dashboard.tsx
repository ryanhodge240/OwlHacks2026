import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiLogOut, FiPlay } from 'react-icons/fi';
import { api } from './api';
import DevicesView, { Preview } from './components/DevicesView';
import EventsView from './components/EventsView';
import Icon from './components/Icon';
import RoomsView from './components/RoomsView';
import BeaconLogo from './img/beacon-logo.png';
import { BeaconEvent, Device, DeviceEvent, LightState, Meta, Room, TriggerResult, User } from './types';

type Tab = 'devices' | 'events' | 'rooms';
const TABS: { id: Tab; name: string }[] = [
    { id: 'devices', name: 'Devices' },
    { id: 'events', name: 'Events' },
    { id: 'rooms', name: 'Rooms' },
];
/** Previews run for the event's length, capped so a 10-minute alert doesn't take over the dashboard. */
const MAX_PREVIEW_MS = 8000;

type Props = { user: User; onLogout: () => void };

export default function Dashboard({ user, onLogout }: Props) {
    const [tab, setTab] = useState<Tab>('devices');
    const [meta, setMeta] = useState<Meta | null>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [events, setEvents] = useState<BeaconEvent[]>([]);
    const [loadError, setLoadError] = useState('');
    const [previews, setPreviews] = useState<Record<number, Preview>>({});
    const [testTrigger, setTestTrigger] = useState('');
    const [testResult, setTestResult] = useState<TriggerResult | null>(null);
    const [testError, setTestError] = useState('');
    const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

    const refresh = useCallback(async () => {
        try {
            const [nextRooms, nextDevices, nextEvents] = await Promise.all([api.rooms(), api.devices(), api.events()]);
            setRooms(nextRooms);
            setDevices(nextDevices);
            setEvents(nextEvents);
            setLoadError('');
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Could not load your home.');
        }
    }, []);

    useEffect(() => {
        api.meta()
            .then((data) => {
                setMeta(data);
                setTestTrigger(data.triggerTypes[0]?.value ?? '');
            })
            .catch(() => setLoadError('Could not reach the Beacon server.'));
        refresh();
    }, [refresh]);

    useEffect(() => {
        const pending = timers.current;
        return () => Object.values(pending).forEach(clearTimeout);
    }, []);

    const showPreview = useCallback((deviceId: number, state: LightState, label: string, seconds: number) => {
        clearTimeout(timers.current[deviceId]);
        setPreviews((current) => ({ ...current, [deviceId]: { state, label } }));
        timers.current[deviceId] = setTimeout(
            () =>
                setPreviews((current) => {
                    const { [deviceId]: _done, ...rest } = current;
                    return rest;
                }),
            Math.min(seconds * 1000, MAX_PREVIEW_MS),
        );
    }, []);

    const previewEvent = (deviceId: number, event: DeviceEvent) =>
        showPreview(deviceId, event, event.name || event.triggerLabel, event.eventLength);

    const runTest = async () => {
        setTestError('');
        try {
            const result = await api.trigger(testTrigger);
            setTestResult(result);
            setTab('devices');
            result.commands.forEach((command) =>
                showPreview(
                    command.deviceId,
                    command.alertState,
                    command.eventName || result.triggerLabel,
                    command.durationSeconds,
                ),
            );
        } catch (error) {
            setTestError(error instanceof Error ? error.message : 'Could not run the test.');
        }
    };

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <a className="brand-lockup" href="/" aria-label="Beacon home">
                    <span className="brand-mark">
                        <img src={BeaconLogo} alt="" />
                    </span>
                    <span>Beacon</span>
                </a>
                <nav className="tabs" aria-label="Sections">
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="tab"
                            aria-current={tab === item.id ? 'page' : undefined}
                            onClick={() => setTab(item.id)}
                        >
                            {item.name}
                        </button>
                    ))}
                </nav>
                <div className="account-area">
                    <span className="account-greeting">
                        Hi, <strong>{user.username}</strong>
                    </span>
                    <button className="logout-button" type="button" onClick={onLogout}>
                        <Icon icon={FiLogOut} /> Log out
                    </button>
                </div>
            </header>

            <div className="dashboard-content">
                {meta && (
                    <div className="test-bar">
                        <label htmlFor="test-trigger">Test a sound</label>
                        <select
                            id="test-trigger"
                            value={testTrigger}
                            onChange={(event) => setTestTrigger(event.target.value)}
                        >
                            {meta.triggerTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        <button className="primary-button compact" type="button" onClick={runTest}>
                            <Icon icon={FiPlay} /> Play on my lights
                        </button>
                        <p className="test-result" aria-live="polite">
                            {testError ||
                                (testResult &&
                                    (testResult.commands.length === 0
                                        ? `No lights respond to ${testResult.triggerLabel.toLowerCase()} yet.`
                                        : `${testResult.triggerLabel}: ${testResult.commands.length} ${
                                              testResult.commands.length === 1 ? 'light' : 'lights'
                                          } changed.`))}
                        </p>
                    </div>
                )}

                {loadError && (
                    <p className="form-error" role="alert">
                        {loadError}
                    </p>
                )}

                {!meta ? (
                    <div className="empty-state">Loading your home…</div>
                ) : tab === 'devices' ? (
                    <DevicesView
                        meta={meta}
                        rooms={rooms}
                        devices={devices}
                        previews={previews}
                        onPreview={previewEvent}
                        onChanged={refresh}
                        onGoToEvents={() => setTab('events')}
                    />
                ) : tab === 'events' ? (
                    <EventsView meta={meta} events={events} devices={devices} onChanged={refresh} />
                ) : (
                    <RoomsView rooms={rooms} onChanged={refresh} />
                )}
            </div>
        </main>
    );
}
