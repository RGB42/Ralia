import { AppHeader, Card, Chip, EmptyState, Fab, personTokens } from '@ralia/ui';
import { useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useT } from '../../i18n/useT.js';
import { MOCK_PROFILE, type MockTodoItem } from '../../mock/fixtures.js';
import { ItemSheet } from '../../sheets/ItemSheet.js';
import { TodoSheet } from '../../sheets/TodoSheet.js';
import { useLongPress } from '../../sheets/use-long-press.js';
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
  const { items, lists, toggle, add, update, remove, filter, setFilter } = useTodoStore();
  const [doneOpen, setDoneOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<MockTodoItem | null>(null);
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

  const renderRow = (item: MockTodoItem, isDone: boolean) => (
    <TodoRow
      key={item.id}
      item={item}
      isDone={isDone}
      inputId={`${baseId}-${item.id}`}
      onToggle={() => toggle(item.id)}
      onLongPress={() => setEditing(item)}
    />
  );

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
            <button type="button" className={styles.addRow} onClick={() => setNewOpen(true)}>
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
      <Fab label={t('todosAddItem')} onClick={() => setNewOpen(true)} />

      <TodoSheet
        key={`new-${newOpen}`}
        open={newOpen}
        lists={lists}
        defaultListId={listId ?? lists[0]?.id ?? ''}
        existing={items}
        onClose={() => setNewOpen(false)}
        onSave={(draft) => {
          add(draft);
          setNewOpen(false);
        }}
        onReveal={(item) => {
          // Erledigtes wieder oeffnen, Offenes nur zeigen.
          if (item.done) toggle(item.id);
          setDoneOpen(false);
          setNewOpen(false);
        }}
      />

      <ItemSheet
        key={editing?.id ?? 'none'}
        open={editing !== null}
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          update(next);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) remove(editing.id);
          setEditing(null);
        }}
      />
    </div>
  );
}

/**
 * Eine Zeile als eigene Komponente: `useLongPress` haelt einen Timer, und den
 * braucht jede Zeile fuer sich. In einer Schleife im Elternteil waere es ein
 * Hook in einer Schleife.
 */
function TodoRow({
  item,
  isDone,
  inputId,
  onToggle,
  onLongPress,
}: {
  item: MockTodoItem;
  isDone: boolean;
  inputId: string;
  onToggle(): void;
  onLongPress(): void;
}): React.JSX.Element {
  const press = useLongPress(onLongPress);
  return (
    <div className={`${styles.row} ${isDone ? styles.rowDone : ''}`} {...press}>
      <input
        id={inputId}
        type="checkbox"
        className={styles.box}
        checked={item.done}
        onChange={onToggle}
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
}
