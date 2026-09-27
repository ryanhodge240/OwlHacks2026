import { ReactNode, useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import Icon from './Icon';
import './Dialog.css';

type Props = { title: string; onClose: () => void; children: ReactNode; wide?: boolean };

export default function Dialog({ title, onClose, children, wide = false }: Props) {
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        panel.current?.querySelector<HTMLElement>('input, select, button:not(.dialog-close)')?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            previous?.focus();
        };
    }, [onClose]);

    return (
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div
                className={`dialog${wide ? ' dialog-wide' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                ref={panel}
            >
                <div className="dialog-head">
                    <h2 id="dialog-title">{title}</h2>
                    <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Close">
                        <Icon icon={FiX} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
