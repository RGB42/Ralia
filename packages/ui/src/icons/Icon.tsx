import { ICON_DEFS, type IconName } from './paths.js';

export { ICON_NAMES, type IconName } from './paths.js';

export interface IconProps {
  name: IconName;
  /** Vorlage: 17 in der Sidebar, 19 in der Bottom-Nav, 14 bei Essen/Aufgaben. */
  size?: number;
  /** Gesetzt = das Icon traegt Bedeutung. Sonst dekorativ und ausgeblendet. */
  title?: string;
}

export function Icon({ name, size = 17, title }: IconProps): React.JSX.Element {
  const def = ICON_DEFS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      // exactOptionalPropertyTypes ist aktiv: undefined darf nicht durchgereicht werden.
      {...(def.linecap ? { strokeLinecap: def.linecap } : {})}
      {...(def.linejoin ? { strokeLinejoin: def.linejoin } : {})}
      {...(title ? { role: 'img' as const } : { 'aria-hidden': true as const })}
    >
      {title ? <title>{title}</title> : null}
      {def.body}
    </svg>
  );
}
