import styles from './Skeleton.module.css';

export interface SkeletonProps {
  height?: number;
  width?: string;
  radius?: number;
}

export function Skeleton({
  height = 16,
  width = '100%',
  radius = 12,
}: SkeletonProps): React.JSX.Element {
  return (
    <div
      className={styles.skeleton}
      aria-hidden="true"
      style={{ height: `${height}px`, width, borderRadius: `${radius}px` }}
    />
  );
}
