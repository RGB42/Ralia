import { Button } from './Button.js';
import styles from './EmptyState.module.css';

export interface EmptyStateAction {
  label: string;
  onClick(): void;
}

export interface EmptyStateProps {
  message: string;
  action?: EmptyStateAction;
}

export function EmptyState({ message, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={styles.empty}>
      <div>{message}</div>
      {action ? (
        <div className={styles.action}>
          <Button variant="ghost" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
