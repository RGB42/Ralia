import { AppHeader, Card, Fab, ProgressBar, SectionLabel, personTokens } from '@ralia/ui';
import { useNavigate } from 'react-router';
import { useT } from '../../i18n/useT.js';
import { MOCK_PROFILE } from '../../mock/fixtures.js';
import screen from '../screen.module.css';
import styles from './TodoOverview.module.css';
import { useTodoStore } from './todo-store.js';

const INITIAL_BY_SLOT: Record<string, string> = {
  u1: MOCK_PROFILE.me.initial,
  u2: MOCK_PROFILE.partner.initial,
};

export function TodoOverview(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const { items, lists } = useTodoStore();

  return (
    <div className={screen.screen}>
      <AppHeader kicker={t('todosKicker')} title={t('todosTitle')} />
      <div className={screen.body}>
        <div className={screen.stack}>
          <div className={styles.grid}>
            {lists.map((list) => {
              const all = items.filter((item) => item.listId === list.id);
              const open = all.filter((item) => !item.done).length;
              const donePct = all.length === 0 ? 0 : ((all.length - open) / all.length) * 100;
              const slots = [...new Set(all.map((item) => item.slot))];
              const meta =
                open === 0
                  ? t('todosAllDone')
                  : `${open} ${t('todosOfOpen')} ${all.length} ${t('todosOpenSuffix')}`;

              return (
                <button
                  key={list.id}
                  type="button"
                  className={styles.card}
                  data-testid="todo-list-card"
                  // Die Vorlage liest Titel und Zahl getrennt vor; ein Name aus
                  // beidem sagt in einem Zug, worum es geht.
                  aria-label={`${list.title}, ${open} ${t('todosOpenSuffix')}`}
                  onClick={() => void navigate(`/todos/${list.id}`)}
                >
                  <span className={styles.cardHead}>
                    <span className={styles.initial} style={{ background: list.color }}>
                      {list.initial}
                    </span>
                    <span
                      className={`${styles.count} ${open === 0 ? styles.countDone : ''}`}
                      style={open === 0 ? undefined : { color: list.color }}
                    >
                      {open}
                    </span>
                  </span>
                  <span className={styles.title}>{list.title}</span>
                  <span className={styles.meta}>{meta}</span>
                  <span className={styles.footer}>
                    <span className={styles.bar}>
                      <ProgressBar
                        height={6}
                        label={`${list.title}: ${t('todosProgress')}`}
                        segments={[{ widthPct: donePct, color: list.color }]}
                      />
                    </span>
                    <span className={styles.avatars} aria-hidden="true">
                      {slots.map((slot) => (
                        <span
                          key={slot}
                          className={styles.avatar}
                          style={{ background: personTokens(slot).bar }}
                        >
                          {INITIAL_BY_SLOT[slot] ?? '?'}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}

            <button type="button" className={styles.newCard}>
              <span className={styles.newPlus} aria-hidden="true">
                +
              </span>
              <span className={styles.newLabel}>{t('todosNewList')}</span>
            </button>
          </div>

          <Card padding="14px">
            <SectionLabel>{t('todosRecentlyDone')}</SectionLabel>
            <div className={styles.recent}>
              Spülmaschinentabs · Jonas, heute 08:14
              <br />
              Geschenk für Mia · Lena, gestern
            </div>
          </Card>
        </div>
      </div>
      {/* Nicht „Neue Liste": das ist die gestrichelte Kachel. Der FAB oeffnet
          in der Vorlage openNew, also das Sheet fuer einen neuen Eintrag. */}
      <Fab label={t('todosAddItem')} onClick={() => undefined} />
    </div>
  );
}
