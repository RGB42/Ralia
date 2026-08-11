import { AppHeader, Card, Chip, EmptyState, Fab, personTokens } from '@ralia/ui';
import { useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useT } from '../../i18n/useT.js';
import type { MockTodoItem } from '../../mock/fixtures.js';
import { ItemSheet } from '../../sheets/ItemSheet.js';
import { TodoSheet } from '../../sheets/TodoSheet.js';
import { useLongPress } from '../../sheets/use-long-press.js';
import screen from '../screen.module.css';
import styles from './TodoDetail.module.css';
import { applyTodoFilter, useTodoStore, type TodoFilter } from './todo-store.js';

export function TodoDetail(): React.JSX.Element {
  const { t } = useT();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { listId } = useParams();
  const { items, lists, toggle, add, update, remove, filter, setFilter } = useTodoStore();
  const [doneOpen, setDoneOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<MockTodoItem | null>(null);
  const baseId = useId();
  const identity = session.status === 'signed-in' ? session.identity : null;
  const meName = firstName(identity?.profile.name ?? t('me'));
  const partnerName = firstName(identity?.partner?.name ?? t('partner'));
  const initials: Record<string, string> = {
    u1: firstInitial(meName),
    u2: firstInitial(partnerName),
    both: '·',
    bday: '·',
  };

  const list = lists.find((entry) => entry.id === listId);
  const all = items.filter((item) => item.listId === listId);
  const filtered = applyTodoFilter(all, filter);
  const open = filtered.filter((item) => !item.done);
  const done = all.filter((item) => item.done);

  const filters: readonly { value: TodoFilter; label: string }[] = [
    { value: 'alle', label: t('todosFilterAll') },
    { value: 'u1', label: meName },
    ...(identity?.partner ? [{ value: 'u2' as const, label: partnerName }] : []),
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
      initials={initials}
    />
  );

  return (
    <div className={screen.screen}>
      <AppHeader
        kicker={`${open.length} ${t('todosOpenSuffix')} · ${t('todosSharedWith')} ${partnerName}`}
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
  initials,
}: {
  item: MockTodoItem;
  isDone: boolean;
  inputId: string;
  onToggle(): void;
  onLongPress(): void;
  initials: Record<string, string>;
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
        {initials[item.slot] ?? '?'}
      </span>
    </div>
  );
}

function firstName(value: string): string {
  return value.split(' ')[0] || value;
}

function firstInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || '?';
}
