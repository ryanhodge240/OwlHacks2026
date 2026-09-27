import { LightDraft, Meta } from '../types';
import LightOrb from './LightOrb';
import './LightStateFields.css';

const SWATCHES = [
    { hex: '#ffd9a0', name: 'Warm white' },
    { hex: '#f2f5ff', name: 'Daylight' },
    { hex: '#ff3b30', name: 'Red' },
    { hex: '#ffb020', name: 'Amber' },
    { hex: '#34c759', name: 'Green' },
    { hex: '#3a86ff', name: 'Blue' },
    { hex: '#a259ff', name: 'Violet' },
];

const PULSES = [
    { value: 0, name: 'Solid' },
    { value: 1500, name: 'Slow' },
    { value: 800, name: 'Medium' },
    { value: 300, name: 'Fast' },
];

type Props = {
    value: LightDraft;
    onChange: (value: LightDraft) => void;
    limits: Meta['limits'];
    idPrefix: string;
    /** Events can pulse; a light's everyday look is always solid, so it hides this. */
    showPulse?: boolean;
};

/** Color, brightness and (optionally) pulse controls with a live preview. */
export default function LightStateFields({ value, onChange, limits, idPrefix, showPulse = true }: Props) {
    const set = (patch: Partial<LightDraft>) => onChange({ ...value, ...patch });

    return (
        <div className="state-fields">
            <div className="state-preview">
                <LightOrb state={value} />
            </div>

            <div className="state-controls">
                <fieldset className="state-group">
                    <legend className="field-label">Color</legend>
                    <div className="swatch-row">
                        {SWATCHES.map((swatch) => (
                            <button
                                key={swatch.hex}
                                type="button"
                                className={`swatch${value.colorHex.toLowerCase() === swatch.hex ? ' is-selected' : ''}`}
                                style={{ background: swatch.hex }}
                                aria-label={swatch.name}
                                aria-pressed={value.colorHex.toLowerCase() === swatch.hex}
                                onClick={() => set({ colorHex: swatch.hex })}
                            />
                        ))}
                        <label className="swatch swatch-custom" title="Pick any color">
                            <input
                                type="color"
                                value={value.colorHex}
                                onChange={(event) => set({ colorHex: event.target.value })}
                                aria-label="Custom color"
                            />
                        </label>
                    </div>
                </fieldset>

                <div className="state-group">
                    <label className="field-label" htmlFor={`${idPrefix}-brightness`}>
                        Brightness
                    </label>
                    <div className="range-row">
                        <input
                            id={`${idPrefix}-brightness`}
                            type="range"
                            min={limits.brightness.min}
                            max={limits.brightness.max}
                            value={value.brightness}
                            onChange={(event) => set({ brightness: Number(event.target.value) })}
                        />
                        <output htmlFor={`${idPrefix}-brightness`}>{value.brightness}%</output>
                    </div>
                </div>

                {showPulse && (
                    <fieldset className="state-group">
                        <legend className="field-label">Pulse</legend>
                        <div className="segmented">
                            {PULSES.map((pulse) => (
                                <button
                                    key={pulse.value}
                                    type="button"
                                    aria-pressed={value.pulse === pulse.value}
                                    onClick={() => set({ pulse: pulse.value })}
                                >
                                    {pulse.name}
                                </button>
                            ))}
                        </div>
                        <label className="inline-number" htmlFor={`${idPrefix}-pulse`}>
                            Cycle length
                            <input
                                id={`${idPrefix}-pulse`}
                                className="input"
                                type="number"
                                min={limits.pulse.min}
                                max={limits.pulse.max}
                                step={50}
                                value={value.pulse}
                                onChange={(event) => set({ pulse: Number(event.target.value) })}
                            />
                            ms
                        </label>
                    </fieldset>
                )}
            </div>
        </div>
    );
}
