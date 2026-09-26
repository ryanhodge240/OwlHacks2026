import React, { FormEvent, useEffect, useState } from 'react';
import { FiBell, FiCheckCircle, FiLogOut, FiPlus, FiShield, FiSun, FiTrash2, FiWifi } from 'react-icons/fi';
import './App.css';

type User = { id: number; username: string };

type SmartLight = {
    id: number;
    name: string;
    room: string;
    deviceId: string;
    isOnline: boolean;
    createdAt: string;
};

type AuthMode = 'login' | 'register';

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authBusy, setAuthBusy] = useState(false);
    const [lights, setLights] = useState<SmartLight[]>([]);
    const [lightsLoading, setLightsLoading] = useState(false);
    const [lightName, setLightName] = useState('');
    const [lightRoom, setLightRoom] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [lightError, setLightError] = useState('');
    const [lightBusy, setLightBusy] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((data) => setUser(data.user))
            .catch(() => undefined)
            .finally(() => setCheckingSession(false));
    }, []);

    useEffect(() => {
        if (!user) return;
        setLightsLoading(true);
        fetch('/api/lights')
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Unable to load lights.');
                setLights(data.lights);
            })
            .catch((error) => setLightError(error instanceof Error ? error.message : 'Unable to load lights.'))
            .finally(() => setLightsLoading(false));
    }, [user]);

    const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAuthBusy(true);
        setAuthError('');

        try {
            const response = await fetch(`/api/auth/${authMode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Authentication failed.');
            setUser(data.user);
            setPassword('');
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : 'Authentication failed.');
        } finally {
            setAuthBusy(false);
        }
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        setLights([]);
    };

    const addLight = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLightBusy(true);
        setLightError('');

        try {
            const response = await fetch('/api/lights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: lightName, room: lightRoom, deviceId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to add this light.');
            setLights((currentLights) => [data.light, ...currentLights]);
            setLightName('');
            setLightRoom('');
            setDeviceId('');
        } catch (error) {
            setLightError(error instanceof Error ? error.message : 'Unable to add this light.');
        } finally {
            setLightBusy(false);
        }
    };

    const removeLight = async (id: number) => {
        const response = await fetch(`/api/lights/${id}`, { method: 'DELETE' });
        if (response.ok) setLights((currentLights) => currentLights.filter((light) => light.id !== id));
    };

    if (checkingSession) {
        return <div className="loading-screen">Loading your signal space...</div>;
    }

    if (!user) {
        return (
            <main className="auth-page">
                <div className="auth-visual">
                    <div className="brand-lockup">
                        <span className="brand-mark">{React.createElement(FiSun as unknown as React.ElementType)}</span>
                        <span>Beacon</span>
                    </div>
                    <div className="visual-copy">
                        <p className="kicker">Technology that speaks in light</p>
                        <h1>
                            Never miss
                            <br />
                            <em>the moment.</em>
                        </h1>
                        <p>
                            Beacon turns the sounds around you into clear, visible signals. A calmer way to stay
                            connected.
                        </p>
                    </div>
                    <div className="signal-art" aria-hidden="true">
                        <span className="signal-ring ring-one" />
                        <span className="signal-ring ring-two" />
                        <span className="signal-ring ring-three" />
                        <span className="signal-core">
                            {React.createElement(FiBell as unknown as React.ElementType)}
                        </span>
                    </div>
                    <p className="visual-footnote">Designed for deaf and hard-of-hearing communities.</p>
                </div>
                <section className="auth-panel" aria-labelledby="auth-title">
                    <div className="auth-panel-inner">
                        <p className="panel-overline">Your personal signal system</p>
                        <h2 id="auth-title">{authMode === 'login' ? 'Welcome back.' : 'Create your space.'}</h2>
                        <p className="auth-intro">
                            {authMode === 'login'
                                ? 'Sign in to manage your smart lights and alerts.'
                                : 'Start building a home that keeps you in the know.'}
                        </p>
                        <form className="auth-form" onSubmit={submitAuth}>
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                minLength={3}
                                maxLength={32}
                                pattern="[a-zA-Z0-9_]+"
                                required
                                autoComplete="username"
                                placeholder="your_username"
                            />
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                minLength={8}
                                maxLength={128}
                                required
                                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                                placeholder="At least 8 characters"
                            />
                            {authError && (
                                <p className="form-error" role="alert">
                                    {authError}
                                </p>
                            )}
                            <button className="primary-button" type="submit" disabled={authBusy}>
                                {authBusy ? 'Please wait...' : authMode === 'login' ? 'Sign in' : 'Create account'}
                                <span>→</span>
                            </button>
                        </form>
                        <button
                            className="mode-switch"
                            type="button"
                            onClick={() => {
                                setAuthMode(authMode === 'login' ? 'register' : 'login');
                                setAuthError('');
                            }}
                        >
                            {authMode === 'login'
                                ? 'New to Beacon? Create an account'
                                : 'Already have an account? Sign in'}
                        </button>
                        <div className="trust-note">
                            {React.createElement(FiShield as unknown as React.ElementType)} Your account is private and
                            secure.
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <a className="brand-lockup" href="/" aria-label="Beacon home">
                    <span className="brand-mark">{React.createElement(FiSun as unknown as React.ElementType)}</span>
                    <span>Beacon</span>
                </a>
                <div className="account-area">
                    <span className="account-greeting">
                        Hi, <strong>{user.username}</strong>
                    </span>
                    <button className="logout-button" type="button" onClick={logout}>
                        {React.createElement(FiLogOut as unknown as React.ElementType)} Log out
                    </button>
                </div>
            </header>
            <div className="dashboard-content">
                <section className="dashboard-intro">
                    <div>
                        <p className="panel-overline">Your dashboard</p>
                        <h1>
                            Your signals, <em>your way.</em>
                        </h1>
                        <p>Add the lights you want Beacon to use for important moments around your home.</p>
                    </div>
                    <div className="status-pill">
                        <span /> System ready
                    </div>
                </section>
                <section className="dashboard-grid">
                    <div className="lights-section">
                        <div className="section-title">
                            <div>
                                <p className="panel-overline">Connected devices</p>
                                <h2>
                                    Your smart lights <span>{lights.length}</span>
                                </h2>
                            </div>
                            {React.createElement(FiWifi as unknown as React.ElementType)}
                        </div>
                        {lightsLoading ? (
                            <div className="empty-state">Loading your lights...</div>
                        ) : lights.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-icon">
                                    {React.createElement(FiSun as unknown as React.ElementType)}
                                </span>
                                <h3>No lights connected yet</h3>
                                <p>Add your first light to start turning everyday sounds into visual alerts.</p>
                            </div>
                        ) : (
                            <div className="light-list">
                                {lights.map((light) => (
                                    <article className="light-card" key={light.id}>
                                        <div className="light-icon">
                                            {React.createElement(FiSun as unknown as React.ElementType)}
                                        </div>
                                        <div className="light-details">
                                            <h3>{light.name}</h3>
                                            <p>
                                                {light.room} ·{' '}
                                                <span className={light.isOnline ? 'online' : ''}>
                                                    {light.isOnline ? 'Online' : 'Offline'}
                                                </span>
                                            </p>
                                            <small>{light.deviceId}</small>
                                        </div>
                                        <button
                                            className="delete-button"
                                            type="button"
                                            aria-label={`Remove ${light.name}`}
                                            onClick={() => removeLight(light.id)}
                                        >
                                            {React.createElement(FiTrash2 as unknown as React.ElementType)}
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                    <aside className="add-light-card">
                        <div className="add-card-icon">
                            {React.createElement(FiPlus as unknown as React.ElementType)}
                        </div>
                        <p className="panel-overline">Add a device</p>
                        <h2>
                            Bring a light
                            <br />
                            into the system.
                        </h2>
                        <p className="add-copy">Connect a smart light by giving it a name and its device ID.</p>
                        <form className="light-form" onSubmit={addLight}>
                            <label htmlFor="light-name">Light name</label>
                            <input
                                id="light-name"
                                value={lightName}
                                onChange={(event) => setLightName(event.target.value)}
                                required
                                placeholder="e.g. Bedroom lamp"
                            />
                            <label htmlFor="light-room">Room</label>
                            <input
                                id="light-room"
                                value={lightRoom}
                                onChange={(event) => setLightRoom(event.target.value)}
                                required
                                placeholder="e.g. Bedroom"
                            />
                            <label htmlFor="device-id">Device ID</label>
                            <input
                                id="device-id"
                                value={deviceId}
                                onChange={(event) => setDeviceId(event.target.value)}
                                required
                                maxLength={64}
                                placeholder="e.g. beacon-001"
                            />
                            {lightError && (
                                <p className="form-error" role="alert">
                                    {lightError}
                                </p>
                            )}
                            <button className="primary-button" type="submit" disabled={lightBusy}>
                                {lightBusy ? 'Adding...' : 'Add smart light'} <span>→</span>
                            </button>
                        </form>
                    </aside>
                </section>
                <section className="how-it-works">
                    <div className="how-icon">{React.createElement(FiCheckCircle as unknown as React.ElementType)}</div>
                    <div>
                        <p className="panel-overline">Coming next</p>
                        <h2>Make every alert impossible to miss.</h2>
                        <p>
                            Once your lights are connected, you will be able to choose colors and patterns for meetings,
                            calls, timers, and more.
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default App;
