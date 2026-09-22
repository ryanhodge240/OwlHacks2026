import React, { useState } from 'react';
import {
  FiArrowUpRight,
  FiCalendar,
  FiCode,
  FiMapPin,
  FiMenu,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi';
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

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="owl-page">
      <header className="site-header">
        <nav className="container navbar-shell" aria-label="Main navigation">
          <a className="brand" href="#top" onClick={closeMenu}>
            <span className="brand-mark">O</span>
            <span>Owl Hacks <strong>2026</strong></span>
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
            <a href="#about" onClick={closeMenu}>About</a>
            <a href="#why-join" onClick={closeMenu}>Why join</a>
            <a href="#schedule" onClick={closeMenu}>Schedule</a>
            <a className="nav-cta" href="#register" onClick={closeMenu}>
              Get updates {React.createElement(FiArrowUpRight as unknown as React.ElementType)}
            </a>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="hero-section container" id="about">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> A weekend for curious builders</p>
            <h1>Build the future.<br /><span>Stay curious.</span></h1>
            <p className="hero-lede">
              Owl Hacks is a welcoming space to explore big ideas, learn new skills,
              and make something that matters.
            </p>
            <div className="hero-actions" id="register">
              <a className="button button-primary" href="mailto:hello@owlhacks2026.com">
                Join the waitlist {React.createElement(FiArrowUpRight as unknown as React.ElementType)}
              </a>
              <a className="button button-quiet" href="#why-join">Explore the event</a>
            </div>
            <div className="hero-meta">
              <span>{React.createElement(FiCalendar as unknown as React.ElementType)} Spring 2026</span>
              <span>{React.createElement(FiMapPin as unknown as React.ElementType)} Somewhere inspiring</span>
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
            <p className="eyebrow">More than a hackathon</p>
            <h2>Bring a question.<br />Leave with momentum.</h2>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }) => (
              <article className="feature-card" key={title}>
                <div className="feature-icon">{React.createElement(Icon as unknown as React.ElementType)}</div>
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
            <p className="schedule-copy">We are lining up mentors, workshops, and a few delightful surprises. Sign up to hear when registration opens.</p>
          </div>
          <div className="status-card">
            <span className="status-badge"><span /> Planning in progress</span>
            <strong>2026</strong>
            <span>Dates and location soon</span>
          </div>
        </section>
      </main>

      <footer className="container site-footer">
        <span>Owl Hacks 2026</span>
        <span>Made for the next idea.</span>
      </footer>
    </div>
  );
}

export default App;
