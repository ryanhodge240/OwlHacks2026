import React, { FormEvent, useEffect, useState } from 'react';
import { FiBell, FiShield } from 'react-icons/fi';
import BeaconLogo from './img/beacon-logo.png';
import Dashboard from './Dashboard';
import { User } from './types';
import './App.css';

type AuthMode = 'login' | 'register';

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authBusy, setAuthBusy] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((data) => setUser(data.user))
            .catch(() => undefined)
            .finally(() => setCheckingSession(false));
    }, []);

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
    };

    if (checkingSession) {
        return <div className="loading-screen">Loading your signal space...</div>;
    }

    if (!user) {
        return (
            <main className="auth-page">
                <div className="auth-visual">
                    <div className="brand-lockup">
                        <span className="brand-mark">
                            <img src={BeaconLogo} alt="Lamp with lighting room" />
                        </span>
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

    return <Dashboard user={user} onLogout={logout} />;
}

export default App;
