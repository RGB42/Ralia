import styles from './SheetHandle.module.css';

/** Der Griff am oberen Rand eines Sheets (Vorlage Z. 713). Rein dekorativ. */
export function SheetHandle(): React.JSX.Element {
  return <div className={styles.handle} aria-hidden="true" />;
}
