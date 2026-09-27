import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Dialog.css';

type Props = { title: string; onClose: () => void; children: ReactNode; wide?: boolean; small?: boolean };

/** Dialogs that are open right now, newest last. Only the top one reacts to Escape. */
const openDialogs: object[] = [];

export default function Dialog({ title, onClose, children, wide = false, small = false }: Props) {
    const panel = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const closeRef = useRef(onClose);

    // Always call the latest onClose without re-running the setup below.
    useEffect(() => {
        closeRef.current = onClose;
    });

    useEffect(() => {
        const me = {};
        openDialogs.push(me);
        const previous = document.activeElement as HTMLElement | null;
        panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.dialog-close)')?.focus();

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && openDialogs[openDialogs.length - 1] === me) closeRef.current();
        };
        document.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('keydown', onKey);
            openDialogs.splice(openDialogs.indexOf(me), 1);
            previous?.focus();
        };
    }, []);

    const classes = ['dialog'];
    if (wide) classes.push('dialog-wide');
    if (small) classes.push('dialog-small');

    return createPortal(
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div className={classes.join(' ')} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
                <div className="dialog-head">
                    <h2 id={titleId}>{title}</h2>
                </div>
                {children}
            </div>
        </div>,
        document.body,
    );
}
