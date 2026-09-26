import React, { FormEvent, useEffect, useState } from 'react';
import { FiArrowUpRight, FiCalendar, FiCode, FiMapPin, FiMenu, FiUsers, FiX, FiZap } from 'react-icons/fi';
import './App.css';

const features = [
    {
        icon: FiCode,
        title: 'Make something real',
        text: 'Turn a bold idea into a working prototype with tools, APIs, and teammates at your side.',
    },
    {
        icon: FiUsers,
        title: 'Find your people',
        text: 'Meet curious builders, designers, and problem-solvers who are ready to collaborate.',
    },
    {
        icon: FiZap,
        title: 'Ship with energy',
        text: 'Get feedback, learn fast, and leave with a project you are excited to keep building.',
    },
];

function App() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [user, setUser] = useState<{ username: string } | null>(null);
    const [authError, setAuthError] = useState('');
    const [authBusy, setAuthBusy] = useState(false);

    const closeMenu = () => setMenuOpen(false);

    useEffect(() => {
        if (typeof fetch === 'undefined') return;
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((data) => setUser(data.user))
            .catch(() => undefined);
    }, []);

    const openAuth = (mode: 'login' | 'register') => {
        setAuthMode(mode);
        setAuthError('');
        setPassword('');
        setAuthOpen(true);
        closeMenu();
    };

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
            setAuthOpen(false);
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

    return (
        <div className="owl-page">
            <header className="site-header">
                <nav className="container navbar-shell" aria-label="Main navigation">
                    <a className="brand" href="#top" onClick={closeMenu}>
                        <span className="brand-mark">O</span>
                        <span>
                            Owl Hacks <strong>2026</strong>
                        </span>
                    </a>
                    <button
                        className="menu-toggle"
                        type="button"
                        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(!menuOpen)}
                    >
                        {React.createElement((menuOpen ? FiX : FiMenu) as unknown as React.ElementType)}
                    </button>
                    <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
                        <a href="#about" onClick={closeMenu}>
                            About
                        </a>
                        <a href="#why-join" onClick={closeMenu}>
                            Why join
                        </a>
                        <a href="#schedule" onClick={closeMenu}>
                            Schedule
                        </a>
                        {user ? (
                            <button className="nav-account" type="button" onClick={logout}>
                                Log out @{user.username}
                            </button>
                        ) : (
                            <button className="nav-cta nav-button" type="button" onClick={() => openAuth('login')}>
                                Log in {React.createElement(FiArrowUpRight as unknown as React.ElementType)}
                            </button>
                        )}
                    </div>
                </nav>
            </header>

            <main id="top">
                <section className="hero-section container" id="about">
                    <div className="hero-copy">
                        <p className="eyebrow">
                            <span className="eyebrow-dot" /> A weekend for curious builders
                        </p>
                        <h1>
                            Build the future.
                            <br />
                            <span>Stay curious.</span>
                        </h1>
                        <p className="hero-lede">
                            Owl Hacks is a welcoming space to explore big ideas, learn new skills, and make something
                            that matters.
                        </p>
                        <div className="hero-actions" id="register">
                            <button
                                className="button button-primary"
                                type="button"
                                onClick={() => openAuth('register')}
                            >
                                Join the community {React.createElement(FiArrowUpRight as unknown as React.ElementType)}
                            </button>
                            <a className="button button-quiet" href="#why-join">
                                Explore the event
                            </a>
                        </div>
                        <div className="hero-meta">
                            <span>{React.createElement(FiCalendar as unknown as React.ElementType)} Spring 2026</span>
                            <span>
                                {React.createElement(FiMapPin as unknown as React.ElementType)} Somewhere inspiring
                            </span>
                        </div>
                    </div>
                    <div className="hero-art" aria-label="Decorative owl hacks graphic">
                        <div className="orbit orbit-one" />
                        <div className="orbit orbit-two" />
                        <div className="owl-orb">
                            <span className="owl-eye eye-left" />
                            <span className="owl-eye eye-right" />
                            <span className="owl-beak" />
                            <span className="owl-wing wing-left" />
                            <span className="owl-wing wing-right" />
                        </div>
                        <span className="spark spark-one">✦</span>
                        <span className="spark spark-two">✦</span>
                    </div>
                </section>

                <section className="section-block container" id="why-join">
                    <div className="section-heading">
                        <p className="eyebrow">More than a hackathon Test</p>
                        <h2>
                            Bring a question.
                            <br />
                            Leave with momentum.
                        </h2>
                    </div>
                    <div className="feature-grid">
                        {features.map(({ icon: Icon, title, text }) => (
                            <article className="feature-card" key={title}>
                                <div className="feature-icon">
                                    {React.createElement(Icon as unknown as React.ElementType)}
                                </div>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="schedule-section container" id="schedule">
                    <div>
                        <p className="eyebrow">Save the signal</p>
                        <h2>Details are taking shape.</h2>
                        <p className="schedule-copy">
                            We are lining up mentors, workshops, and a few delightful surprises. Sign up to hear when
                            registration opens.
                        </p>
                    </div>
                    <div className="status-card">
                        <span className="status-badge">
                            <span /> Planning in progress
                        </span>
                        <strong>2026</strong>
                        <span>Dates and location soon</span>
                    </div>
                </section>
            </main>

            <footer className="container site-footer">
                <span>Owl Hacks 2026</span>
                <span>Made for the next idea.</span>
            </footer>
            {authOpen && (
                <div className="auth-backdrop" role="presentation" onMouseDown={() => setAuthOpen(false)}>
                    <section
                        className="auth-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="auth-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <button
                            className="auth-close"
                            type="button"
                            aria-label="Close"
                            onClick={() => setAuthOpen(false)}
                        >
                            ×
                        </button>
                        <p className="eyebrow">Your builder profile</p>
                        <h2 id="auth-title">{authMode === 'login' ? 'Welcome back.' : 'Make an account.'}</h2>
                        <form onSubmit={submitAuth}>
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
                            />
                            {authError && (
                                <p className="auth-error" role="alert">
                                    {authError}
                                </p>
                            )}
                            <button className="button button-primary auth-submit" type="submit" disabled={authBusy}>
                                {authBusy ? 'Working...' : authMode === 'login' ? 'Log in' : 'Create account'}
                            </button>
                        </form>
                        <button
                            className="auth-switch"
                            type="button"
                            onClick={() => openAuth(authMode === 'login' ? 'register' : 'login')}
                        >
                            {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in'}
                        </button>
                    </section>
                </div>
            )}
        </div>
    );
}

export default App;
