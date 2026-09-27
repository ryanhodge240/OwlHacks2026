import { useCallback, useEffect, useRef, useState } from 'react';
import { FiPlay } from 'react-icons/fi';
import { api } from './api';
import DevicesView, { Preview } from './components/DevicesView';
import EventsView from './components/EventsView';
import Icon from './components/Icon';
import RoomsView from './components/RoomsView';
import ThemeToggle from './components/ThemeToggle';
import BeaconLogo from './img/beacon-logo-clear.png';
import { BeaconEvent, Device, DeviceEvent, LightState, Meta, Room, TriggerResult, User } from './types';
import './Dashboard.css';

type Tab = 'devices' | 'events' | 'rooms';
const TABS: { id: Tab; name: string; title: string }[] = [
    { id: 'devices', name: 'Devices', title: 'Connected Devices' },
    { id: 'events', name: 'Events', title: 'Sound Events' },
    { id: 'rooms', name: 'Rooms', title: 'Rooms' },
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

    const testMessage =
        testError ||
        (testResult &&
            (testResult.commands.length === 0
                ? `No lights respond to ${testResult.triggerLabel.toLowerCase()} yet.`
                : `${testResult.triggerLabel}: ${testResult.commands.length} ${
                      testResult.commands.length === 1 ? 'light' : 'lights'
                  } changed.`));

    const current = TABS.find((item) => item.id === tab) ?? TABS[0];

    return (
        <div className="dashboard">
            <header className="dash-header">
                <a className="brand" href="/" aria-label="Beacon home">
                    <img src={BeaconLogo} alt="" />
                    <span>Beacon</span>
                </a>

                <nav className="dash-tabs" aria-label="Sections">
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="dash-tab"
                            aria-current={tab === item.id ? 'page' : undefined}
                            onClick={() => setTab(item.id)}
                        >
                            {item.name}
                        </button>
                    ))}
                </nav>

                <div className="dash-header-actions">
                    <span className="dash-user">
                        Hi, <strong>{user.username}</strong>
                    </span>
                    <ThemeToggle />
                    <button className="btn btn-primary" type="button" onClick={onLogout}>
                        Logout
                    </button>
                </div>
            </header>

            <main className="dash-main">
                <div className="page-head">
                    <h1 className="page-title">{current.title}</h1>

                    {meta && (
                        <div className="test-sound">
                            <label className="field-label" htmlFor="test-trigger">
                                Test a sound
                            </label>
                            <select
                                id="test-trigger"
                                className="input"
                                value={testTrigger}
                                onChange={(event) => setTestTrigger(event.target.value)}
                            >
                                {meta.triggerTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                            <button className="btn btn-secondary" type="button" onClick={runTest}>
                                <Icon icon={FiPlay} /> Play
                            </button>
                        </div>
                    )}
                </div>

                <p className={`test-result${testError ? ' form-error' : ''}`} aria-live="polite">
                    {testMessage}
                </p>

                {loadError && (
                    <p className="form-error page-error" role="alert">
                        {loadError}
                    </p>
                )}

                {!meta ? (
                    <p className="page-loading">Loading your home…</p>
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
            </main>
        </div>
    );
}
