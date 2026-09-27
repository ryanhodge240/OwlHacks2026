import { useCallback, useEffect, useRef, useState } from 'react';
import { FiPlay, FiSquare } from 'react-icons/fi';
import { api } from './api';
import DevicesView, { Preview } from './components/DevicesView';
import EventsView from './components/EventsView';
import Icon from './components/Icon';
import RoomsView from './components/RoomsView';
import ThemeToggle from './components/ThemeToggle';
import BeaconLogo from './img/beacon-logo-clear.png';
import { BeaconEvent, Device, Meta, Room, TriggerResult, User } from './types';
import './Dashboard.css';

type Tab = 'devices' | 'events' | 'rooms';
const TABS: { id: Tab; name: string; title: string }[] = [
    { id: 'devices', name: 'Devices', title: 'Connected Devices' },
    { id: 'events', name: 'Events', title: 'Sound Events' },
    { id: 'rooms', name: 'Rooms', title: 'Rooms' },
];

/** A test never shows for longer than this, so a 10-minute alert doesn't take over the dashboard. */
const MAX_TEST_MS = 8000;
/** Used when the server sends no usable length, and for "no lights respond" messages. */
const DEFAULT_TEST_MS = 5000;

const testLength = (seconds: number) =>
    Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, MAX_TEST_MS) : DEFAULT_TEST_MS;

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
    const testTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

    /** Ends a test: clears the highlighted rows and the message together. */
    const endTest = useCallback(() => {
        clearTimeout(testTimer.current);
        testTimer.current = undefined;
        setPreviews({});
        setTestResult(null);
    }, []);

    // Don't leave a timer running if the dashboard closes (e.g. on logout).
    useEffect(() => () => clearTimeout(testTimer.current), []);

    const runTest = async () => {
        endTest();
        setTestError('');
        try {
            const result = await api.trigger(testTrigger);
            setTab('devices');

            const next: Record<number, Preview> = {};
            let longest = 0;
            result.commands.forEach((command) => {
                next[command.deviceId] = {
                    state: command.alertState,
                    label: command.eventName || result.triggerLabel,
                };
                longest = Math.max(longest, testLength(command.durationSeconds));
            });

            setPreviews(next);
            setTestResult(result);
            testTimer.current = setTimeout(endTest, longest || DEFAULT_TEST_MS);
        } catch (error) {
            setTestError(error instanceof Error ? error.message : 'Could not run the test.');
        }
    };

    const testing = testResult !== null;

    const testMessage =
        testError ||
        (testResult &&
            (testResult.commands.length === 0
                ? `No lights respond to ${testResult.triggerLabel.toLowerCase()} yet.`
                : `Showing ${testResult.triggerLabel.toLowerCase()} on ${testResult.commands.length} ${
                      testResult.commands.length === 1 ? 'light' : 'lights'
                  }.`));

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
                                disabled={testing}
                            >
                                {meta.triggerTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                            {testing ? (
                                <button className="btn btn-primary" type="button" onClick={endTest}>
                                    <Icon icon={FiSquare} /> Stop
                                </button>
                            ) : (
                                <button className="btn btn-secondary" type="button" onClick={runTest}>
                                    <Icon icon={FiPlay} /> Play
                                </button>
                            )}
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
                        events={events}
                        previews={previews}
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
