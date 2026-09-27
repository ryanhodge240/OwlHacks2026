import React from 'react';
import { IconType } from 'react-icons';

/** react-icons' types don't line up with React 19's JSX types, so render icons through createElement. */
export default function Icon({ icon, label }: { icon: IconType; label?: string }) {
    return React.createElement(icon as unknown as React.ElementType, {
        'aria-hidden': label ? undefined : true,
        'aria-label': label,
        role: label ? 'img' : undefined,
    });
}