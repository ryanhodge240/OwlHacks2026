import { CSSProperties } from 'react';
import { LightDraft, LightState } from '../types';
import './LightOrb.css';

type Props = {
    state: LightState | LightDraft | null;
    size?: 'small' | 'large';
    alerting?: boolean;
    label?: string;
};

/** A glowing bulb drawn in the light's color, brightness and pulse rate. */
export default function LightOrb({ state, size = 'large', alerting = false, label }: Props) {
    const style = state
        ? ({
              '--orb-color': state.colorHex,
              '--orb-level': Math.max(state.brightness, 4) / 100,
              '--orb-pulse': `${state.pulse}ms`,
          } as CSSProperties)
        : undefined;

    const classes = ['light-orb', `light-orb-${size}`];
    if (!state) classes.push('is-off');
    if (state && state.pulse > 0) classes.push('is-pulsing');
    if (alerting) classes.push('is-alerting');

    return (
        <span className={classes.join(' ')} style={style} role={label ? 'img' : undefined} aria-label={label}>
            <span className="light-orb-core" />
        </span>
    );
}
