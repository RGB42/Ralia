import type { ReactNode } from 'react';
import { OverlayFrame } from './OverlayFrame.js';

export interface ModalProps {
  open: boolean;
  onClose(): void;
  title: string;
  dismissible?: boolean;
  closeLabel?: string;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  dismissible = true,
  closeLabel,
  children,
}: ModalProps): React.JSX.Element | null {
  return (
    <OverlayFrame
      open={open}
      onClose={onClose}
      title={title}
      placement="center"
      maxHeight="86%"
      dismissible={dismissible}
      {...(closeLabel ? { closeLabel } : {})}
    >
      {children}
    </OverlayFrame>
  );
}
