import { LightState } from './types';

export function describePulse(pulse: number): string {
    if (pulse <= 0) return 'Steady';
    if (pulse < 1000) return `Pulses every ${pulse} ms`;
    return `Pulses every ${(pulse / 1000).toFixed(pulse % 1000 === 0 ? 0 : 1)} s`;
}

export function describeLength(seconds: number): string {
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export function describeState(state: LightState): string {
    return `${state.colorHex.toUpperCase()}, ${state.brightness}% brightness, ${describePulse(state.pulse).toLowerCase()}`;
}
