import { ReactNode } from 'react';
import Dialog from './Dialog';

type Props = {
    title: string;
    message: ReactNode;
    confirmLabel: string;
    busyLabel?: string;
    busy?: boolean;
    error?: string;
    onConfirm: () => void;
    onCancel: () => void;
};

/** "Are you sure?" pop-up. Cancel gets focus first so Enter can't delete by accident. */
export default function ConfirmDialog({
    title,
    message,
    confirmLabel,
    busyLabel = 'Working…',
    busy = false,
    error,
    onConfirm,
    onCancel,
}: Props) {
    return (
        <Dialog title={title} onClose={onCancel} small>
            <p className="dialog-intro confirm-message">{message}</p>
            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            <div className="dialog-actions">
                <button className="btn btn-secondary" type="button" onClick={onCancel}>
                    Cancel
                </button>
                <button className="btn btn-primary" type="button" onClick={onConfirm} disabled={busy}>
                    {busy ? busyLabel : confirmLabel}
                </button>
            </div>
        </Dialog>
    );
}
