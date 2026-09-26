import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders the Owl Hacks landing page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /build the future/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join the community/i })).toBeInTheDocument();
});
