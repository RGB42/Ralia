import type { ReactNode } from 'react';
import { OverlayFrame } from './OverlayFrame.js';

export interface BottomSheetProps {
  open: boolean;
  onClose(): void;
  title: string;
  kicker?: string;
  maxHeight?: string;
  closeLabel?: string;
  children: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  kicker,
  maxHeight = '90%',
  closeLabel,
  children,
}: BottomSheetProps): React.JSX.Element | null {
  return (
    <OverlayFrame
      open={open}
      onClose={onClose}
      title={title}
      placement="bottom"
      maxHeight={maxHeight}
      {...(kicker ? { kicker } : {})}
      {...(closeLabel ? { closeLabel } : {})}
    >
      {children}
    </OverlayFrame>
  );
}
