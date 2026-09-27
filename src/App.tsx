import { FormEvent, useEffect, useState } from 'react';
import PhoneRingGif from './img/phone_ring.gif';
import BeaconLogo from './img/beacon-logo-clear.png';
import Dashboard from './Dashboard';
import ThemeToggle from './components/ThemeToggle';
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

    if (user) {
        return <Dashboard user={user} onLogout={logout} />;
    }

    return (
        <main className="auth-page">
            <div className="auth-art">
                <div className="brand">
                    <img src={BeaconLogo} alt="" />
                    <span>Beacon</span>
                </div>
                <div className="auth-illustration">
                    <img src={PhoneRingGif} alt="A ringing phone lighting up a lamp" />
                </div>
            </div>

            <section className="auth-panel" aria-labelledby="auth-title">
                <ThemeToggle className="auth-theme-toggle" />

                <div className="auth-panel-inner">
                    <h1 id="auth-title" className="auth-title">
                        Hear it in <span>light</span>.
                    </h1>
                    <p className="auth-tagline">Turn doorbells, alarms, and calls into colored light.</p>

                    <h2 className="auth-prompt">
                        {authMode === 'login' ? 'Login or create an account below:' : 'Create your account below:'}
                    </h2>

                    <form className="auth-form" onSubmit={submitAuth}>
                        <div className="field">
                            <label className="field-label" htmlFor="username">
                                Username
                            </label>
                            <input
                                id="username"
                                className="input"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                minLength={3}
                                maxLength={32}
                                pattern="[a-zA-Z0-9_]+"
                                required
                                autoComplete="username"
                            />
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="password">
                                Password
                            </label>
                            <input
                                id="password"
                                className="input"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                minLength={8}
                                maxLength={128}
                                required
                                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                            />
                        </div>

                        <button
                            className="auth-switch"
                            type="button"
                            onClick={() => {
                                setAuthMode(authMode === 'login' ? 'register' : 'login');
                                setAuthError('');
                            }}
                        >
                            {authMode === 'login' ? 'New? Create account' : 'Have an account? Login'} →
                        </button>

                        {authError && (
                            <p className="form-error" role="alert">
                                {authError}
                            </p>
                        )}

                        <button className="btn btn-primary auth-submit" type="submit" disabled={authBusy}>
                            {authBusy ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'}
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}

export default App;