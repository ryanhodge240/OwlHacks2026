import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';

const response = (body: unknown, ok = true) => Promise.resolve({ ok, status: 200, json: async () => body });

const meta = {
    triggerTypes: [{ value: 'doorbell', label: 'Doorbell ring' }],
    deviceTypes: ['light', 'microphone', 'speaker', 'camera'],
    limits: { brightness: { min: 0, max: 100 }, pulse: { min: 0, max: 10000 }, eventLength: { min: 1, max: 3600 } },
};

const lamp = {
    id: 1,
    name: 'Bedroom lamp',
    type: 'light',
    hardwareId: 'beacon-001',
    room: { id: 1, name: 'Bedroom' },
    createdAt: '',
    defaultState: { color: 0xffd9a0, colorHex: '#ffd9a0', brightness: 60, pulse: 0 },
    events: [
        {
            id: 1,
            name: null,
            trigger: 'doorbell',
            triggerLabel: 'Doorbell ring',
            eventLength: 10,
            color: 0x3a86ff,
            colorHex: '#3a86ff',
            brightness: 100,
            pulse: 800,
        },
    ],
};

afterEach(() => {
    jest.restoreAllMocks();
});

test('renders the Beacon sign-in experience', async () => {
    jest.spyOn(global, 'fetch').mockReturnValue(response({ user: null }) as Promise<Response>);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /hear it in light/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
});

test('shows each light with its default state and the color it changes to for an event', async () => {
    const routes: Record<string, unknown> = {
        '/api/auth/me': { user: { id: 1, username: 'ada' } },
        '/api/meta': meta,
        '/api/rooms': { rooms: [{ id: 1, name: 'Bedroom', deviceCount: 1 }] },
        '/api/devices': { devices: [lamp] },
        '/api/events': { events: [{ ...lamp.events[0], deviceIds: [1] }] },
    };
    jest.spyOn(global, 'fetch').mockImplementation(
        (input) => response(routes[String(input)] ?? {}) as Promise<Response>,
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Connected Devices' })).toBeInTheDocument();
    expect(await screen.findByText('Bedroom lamp')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/#FFD9A0, 60%, solid/)).toBeInTheDocument();
    expect(screen.getByText(/#3A86FF, 100%, pulses every 800 ms, for 10 s/)).toBeInTheDocument();
});

test('loads available Home Assistant lights when adding a light', async () => {
    const existingLamp = { ...lamp, hardwareId: 'light.bedroom' };
    const newLamp = { ...lamp, id: 2, name: 'Hallway lamp', hardwareId: 'light.hallway' };
    const routes: Record<string, unknown> = {
        '/api/auth/me': { user: { id: 1, username: 'ada' } },
        '/api/meta': meta,
        '/api/rooms': { rooms: [{ id: 1, name: 'Bedroom', deviceCount: 1 }] },
        '/api/devices': { devices: [existingLamp] },
        '/api/events': { events: [{ ...lamp.events[0], deviceIds: [1] }] },
        '/api/home-assistant/lights': {
            lights: [
                { entityId: 'light.bedroom', name: 'Bedroom lamp' },
                { entityId: 'light.hallway', name: 'Hallway lamp' },
            ],
        },
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
        if (String(input) === '/api/devices' && init?.method === 'POST') {
            return response({ device: newLamp }) as Promise<Response>;
        }
        return response(routes[String(input)] ?? {}) as Promise<Response>;
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Connected Devices' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'New Device' }));
    expect(await screen.findByRole('option', { name: /Hallway lamp \(light\.hallway\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Bedroom lamp \(light\.bedroom\)/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hallway lamp' } });
    fireEvent.change(screen.getByLabelText('Home Assistant light'), { target: { value: 'light.hallway' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: set up the light' }));

    const createCall = fetchMock.mock.calls.find(
        ([input, init]) => String(input) === '/api/devices' && init?.method === 'POST',
    );
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
        name: 'Hallway lamp',
        type: 'light',
        hardwareId: 'light.hallway',
    });
    expect(await screen.findByRole('heading', { name: 'Set up Hallway lamp' })).toBeInTheDocument();
});
