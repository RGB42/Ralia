import { AppHeader, Card, Chip, EmptyState, Fab, personTokens } from '@ralia/ui';
import { useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useT } from '../../i18n/useT.js';
import { MOCK_PROFILE, type MockTodoItem } from '../../mock/fixtures.js';
import screen from '../screen.module.css';
import styles from './TodoDetail.module.css';
import { applyTodoFilter, useTodoStore, type TodoFilter } from './todo-store.js';

const INITIAL_BY_SLOT: Record<string, string> = {
  u1: MOCK_PROFILE.me.initial,
  u2: MOCK_PROFILE.partner.initial,
  both: '·',
  bday: '·',
};

export function TodoDetail(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const { listId } = useParams();
  const { items, lists, toggle, filter, setFilter } = useTodoStore();
  const [doneOpen, setDoneOpen] = useState(false);
  const baseId = useId();

  const list = lists.find((entry) => entry.id === listId);
  const all = items.filter((item) => item.listId === listId);
  const filtered = applyTodoFilter(all, filter);
  const open = filtered.filter((item) => !item.done);
  const done = all.filter((item) => item.done);

  const filters: readonly { value: TodoFilter; label: string }[] = [
    { value: 'alle', label: t('todosFilterAll') },
    { value: 'u1', label: MOCK_PROFILE.me.name.split(' ')[0] ?? 'u1' },
    { value: 'u2', label: MOCK_PROFILE.partner.name.split(' ')[0] ?? 'u2' },
    { value: 'offen', label: t('todosFilterOpen') },
  ];

  const renderRow = (item: MockTodoItem, isDone: boolean) => {
    const inputId = `${baseId}-${item.id}`;
    return (
      <div key={item.id} className={`${styles.row} ${isDone ? styles.rowDone : ''}`}>
        <input
          id={inputId}
          type="checkbox"
          className={styles.box}
          checked={item.done}
          onChange={() => toggle(item.id)}
        />
        <label htmlFor={inputId} className={`${styles.text} ${isDone ? styles.textDone : ''}`}>
          {item.text}
        </label>
        {item.note && !isDone ? <span className={styles.note}>{item.note}</span> : null}
        <span
          className={styles.avatar}
          style={{ background: personTokens(item.slot).bar }}
          aria-hidden="true"
        >
          {INITIAL_BY_SLOT[item.slot] ?? '?'}
        </span>
      </div>
    );
  };

  return (
    <div className={screen.screen}>
      <AppHeader
        kicker={`${open.length} ${t('todosOpenSuffix')} · ${t('todosSharedWith')} ${MOCK_PROFILE.partner.name.split(' ')[0]}`}
        title={list?.title ?? t('todosTitle')}
        onBack={() => void navigate('/todos')}
        backLabel={t('back')}
      />
      <div className={screen.body}>
        <div className={screen.stack}>
          <div className={styles.filters}>
            {filters.map((entry) => (
              <Chip
                key={entry.value}
                active={filter === entry.value}
                label={entry.label}
                onClick={() => setFilter(entry.value)}
              />
            ))}
          </div>

          <Card flush>
            {open.map((item) => renderRow(item, false))}
            {open.length === 0 ? <EmptyState message={t('todosNothingOpen')} /> : null}
            <button type="button" className={styles.addRow}>
              + {t('todosAddItem')}
            </button>
          </Card>

          <div className={styles.doneCard}>
            <button
              type="button"
              className={styles.doneToggle}
              aria-expanded={doneOpen}
              onClick={() => setDoneOpen((value) => !value)}
            >
              <span className={styles.doneLabel}>
                {t('todosDone')} · {done.length}
              </span>
              <span className={styles.doneAction}>
                {doneOpen ? t('todosHide') : t('todosShow')}
              </span>
            </button>
            {doneOpen ? (
              <div className={styles.doneList}>{done.map((item) => renderRow(item, true))}</div>
            ) : null}
          </div>

          <div className={styles.metaLine}>
            {all.length} {t('todosEntries')} · {t('todosMetaHint')}
          </div>
        </div>
      </div>
      <Fab label={t('todosAddItem')} onClick={() => undefined} />
    </div>
  );
}
