import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  Fab,
  FieldLabel,
  Input,
  ProgressBar,
  SectionLabel,
  personTokens,
} from '@ralia/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useT } from '../../i18n/useT.js';
import { TodoSheet } from '../../sheets/TodoSheet.js';
import screen from '../screen.module.css';
import styles from './TodoOverview.module.css';
import { useTodoStore } from './todo-store.js';

export function TodoOverview(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { items, lists, add, addList } = useTodoStore();
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newListOpen, setNewListOpen] = useState(false);
  const [listName, setListName] = useState('');
  const identity = session.status === 'signed-in' ? session.identity : null;
  const initials: Record<string, string> = {
    u1: identity?.profile.name?.trim().charAt(0).toUpperCase() || '?',
    u2: identity?.partner?.name?.trim().charAt(0).toUpperCase() || '?',
  };
  const recentlyDone = items.filter((item) => item.done).slice(-2).reverse();

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
                          {initials[slot] ?? '?'}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}

            <button type="button" className={styles.newCard} onClick={() => setNewListOpen(true)}>
              <span className={styles.newPlus} aria-hidden="true">
                +
              </span>
              <span className={styles.newLabel}>{t('todosNewList')}</span>
            </button>
          </div>

          <Card padding="14px">
            <SectionLabel>{t('todosRecentlyDone')}</SectionLabel>
            <div className={styles.recent}>
              {recentlyDone.length === 0
                ? t('todosEmpty')
                : recentlyDone.map((item, index) => (
                    <span key={item.id}>
                      {index > 0 ? <br /> : null}
                      {item.text}
                    </span>
                  ))}
            </div>
          </Card>
        </div>
      </div>
      <Fab
        label={t('todosAddItem')}
        onClick={() => (lists.length > 0 ? setNewItemOpen(true) : setNewListOpen(true))}
      />

      <TodoSheet
        key={`${newItemOpen}-${lists[0]?.id ?? 'none'}`}
        open={newItemOpen && lists.length > 0}
        lists={lists}
        defaultListId={lists[0]?.id ?? ''}
        existing={items}
        onClose={() => setNewItemOpen(false)}
        onSave={(draft) => {
          add(draft);
          setNewItemOpen(false);
        }}
        onReveal={(item) => {
          setNewItemOpen(false);
          void navigate(`/todos/${item.listId}`);
        }}
      />

      <BottomSheet
        open={newListOpen}
        onClose={() => setNewListOpen(false)}
        closeLabel={t('sheetClose')}
        title={t('todosNewList')}
      >
        <div className={screen.stack}>
          <div>
            <FieldLabel htmlFor="new-list-name">{t('name')}</FieldLabel>
            <Input id="new-list-name" value={listName} onChange={setListName} />
          </div>
          <Button
            fullWidth
            disabled={listName.trim() === ''}
            onClick={() => {
              void addList(listName).then((id) => {
                if (!id) return;
                setListName('');
                setNewListOpen(false);
                void navigate(`/todos/${id}`);
              });
            }}
          >
            {t('sheetSave')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
