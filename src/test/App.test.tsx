import { render, screen } from '@testing-library/react';
import App from '../App';

const response = (body: unknown, ok = true) => Promise.resolve({ ok, json: async () => body });

afterEach(() => {
    jest.restoreAllMocks();
});

test('renders the Beacon sign-in experience', async () => {
    jest.spyOn(global, 'fetch').mockReturnValue(response({ user: null }) as Promise<Response>);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});

test('renders the dashboard and connected lights for a signed-in user', async () => {
    jest.spyOn(global, 'fetch')
        .mockReturnValueOnce(response({ user: { id: 1, username: 'ada' } }) as Promise<Response>)
        .mockReturnValueOnce(
            response({
                lights: [
                    {
                        id: 1,
                        name: 'Bedroom lamp',
                        room: 'Bedroom',
                        deviceId: 'beacon-001',
                        isOnline: true,
                        createdAt: '',
                    },
                ],
            }) as Promise<Response>,
        );

    render(<App />);

    expect(await screen.findByRole('heading', { name: /your signals/i })).toBeInTheDocument();
    expect(await screen.findByText('Bedroom lamp')).toBeInTheDocument();
    expect(screen.getByText('beacon-001')).toBeInTheDocument();
});
