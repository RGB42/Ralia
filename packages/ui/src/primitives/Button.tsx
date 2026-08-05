import type { ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Standard `button`: ein Knopf in einem Formular soll nicht versehentlich abschicken. */
  type?: 'button' | 'submit';
}

export function Button({
  variant = 'primary',
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  type = 'button',
}: ButtonProps): React.JSX.Element {
  const classes = [styles.button, styles[variant], fullWidth ? styles.fullWidth : null]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled} {...(onClick ? { onClick } : {})}>
      {children}
    </button>
  );
}
