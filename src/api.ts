import { BeaconEvent, Device, HomeAssistantLight, LightDraft, Meta, Room, TriggerResult } from './types';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data as T;
}

const lightBody = (draft: LightDraft) => ({
    color: draft.colorHex,
    brightness: draft.brightness,
    pulse: draft.pulse,
});

export type EventInput = LightDraft & { name: string; trigger: string; eventLength: number; deviceIds: number[] };

export const api = {
    meta: () => request<Meta>('GET', '/api/meta'),

    rooms: () => request<{ rooms: Room[] }>('GET', '/api/rooms').then((data) => data.rooms),
    createRoom: (name: string) => request<{ room: Room }>('POST', '/api/rooms', { name }).then((data) => data.room),
    renameRoom: (id: number, name: string) =>
        request<{ room: Room }>('PATCH', `/api/rooms/${id}`, { name }).then((data) => data.room),
    deleteRoom: (id: number) => request<void>('DELETE', `/api/rooms/${id}`),

    devices: () => request<{ devices: Device[] }>('GET', '/api/devices').then((data) => data.devices),
    homeAssistantLights: () =>
        request<{ lights: HomeAssistantLight[] }>('GET', '/api/home-assistant/lights').then((data) => data.lights),
    createDevice: (input: { name: string; type: string; roomId: number; hardwareId: string }) =>
        request<{ device: Device }>('POST', '/api/devices', input).then((data) => data.device),
    updateDevice: (id: number, input: { name?: string; roomId?: number; hardwareId?: string }) =>
        request<{ device: Device }>('PATCH', `/api/devices/${id}`, input).then((data) => data.device),
    deleteDevice: (id: number) => request<void>('DELETE', `/api/devices/${id}`),
    setDefaultState: (id: number, draft: LightDraft) =>
        request<{ device: Device }>('PUT', `/api/devices/${id}/default-state`, lightBody(draft)).then(
            (data) => data.device,
        ),
    clearDefaultState: (id: number) =>
        request<{ device: Device }>('DELETE', `/api/devices/${id}/default-state`).then((data) => data.device),

    events: () => request<{ events: BeaconEvent[] }>('GET', '/api/events').then((data) => data.events),
    createEvent: (input: EventInput) =>
        request<{ event: BeaconEvent }>('POST', '/api/events', { ...input, ...lightBody(input) }).then(
            (data) => data.event,
        ),
    updateEvent: (id: number, input: EventInput) =>
        request<{ event: BeaconEvent }>('PATCH', `/api/events/${id}`, { ...input, ...lightBody(input) }).then(
            (data) => data.event,
        ),
    deleteEvent: (id: number) => request<void>('DELETE', `/api/events/${id}`),

    trigger: (trigger: string) => request<TriggerResult>('POST', `/api/triggers/${trigger}`),
};
