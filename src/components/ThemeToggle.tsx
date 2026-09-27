import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../theme';
import Icon from './Icon';

export default function ThemeToggle({ className = '' }: { className?: string }) {
    const { theme, toggle } = useTheme();
    const next = theme === 'dark' ? 'light' : 'dark';

    return (
        <button
            type="button"
            className={`theme-toggle ${className}`.trim()}
            onClick={toggle}
            aria-label={`Switch to ${next} mode`}
            title={`Switch to ${next} mode`}
        >
            <Icon icon={theme === 'dark' ? FiSun : FiMoon} />
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
    );
}
