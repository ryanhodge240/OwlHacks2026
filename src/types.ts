export type User = { id: number; username: string };

export type DeviceType = 'light' | 'microphone' | 'speaker' | 'camera';

export type LightState = {
    color: number;
    colorHex: string;
    brightness: number;
    /** Length of one pulse cycle in milliseconds. 0 is a solid light. */
    pulse: number;
};

export type Room = { id: number; name: string; deviceCount: number };

export type DeviceEvent = LightState & {
    id: number;
    name: string | null;
    trigger: string;
    triggerLabel: string;
    /** Seconds the light holds the alert state. */
    eventLength: number;
};

export type Device = {
    id: number;
    name: string;
    type: DeviceType;
    hardwareId: string | null;
    room: { id: number; name: string };
    createdAt: string;
    defaultState: LightState | null;
    events: DeviceEvent[];
};

export type HomeAssistantLight = { entityId: string; name: string };

export type BeaconEvent = DeviceEvent & { deviceIds: number[] };

export type Range = { min: number; max: number };

export type Meta = {
    triggerTypes: { value: string; label: string }[];
    deviceTypes: DeviceType[];
    limits: { brightness: Range; pulse: Range; eventLength: Range };
};

export type TriggerCommand = {
    deviceId: number;
    deviceName: string;
    hardwareId: string | null;
    eventId: number;
    eventName: string | null;
    durationSeconds: number;
    alertState: LightState;
    revertTo: LightState | null;
};

export type TriggerResult = { trigger: string; triggerLabel: string; commands: TriggerCommand[] };

/** What the light-state editor works with before it is sent to the API. */
export type LightDraft = { colorHex: string; brightness: number; pulse: number };
