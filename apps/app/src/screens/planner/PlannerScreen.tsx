import type { WeekPlansRow } from '@ralia/data';
import { AppHeader, Button, Card, Fab, Icon, personTokens, useToast } from '@ralia/ui';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useData } from '../../data/DataProvider.js';
import { useT } from '../../i18n/useT.js';
import { PlanSheet, type PlanDraft, type PlanEntryKind } from '../../sheets/PlanSheet.js';
import screen from '../screen.module.css';
import {
  addDaysIso,
  dayOfMonth,
  isoWeekNumber,
  weekRangeLabel,
  weekStartIsoOf,
  weekdayShort,
} from '../calendar/calendar-labels.js';
import styles from './PlannerScreen.module.css';

interface SheetState {
  dayIndex: number;
  kind: PlanEntryKind;
  entryId?: string;
  initialText?: string;
}

export function PlannerScreen(): React.JSX.Element {
  const { t, lang } = useT();
  const { show } = useToast();
  const { session } = useAuth();
  const { weekPlan, notesTodoGroups } = useData();
  const navigate = useNavigate();
  const baseId = useId();
  const today = localTodayIso();
  const [weekStart, setWeekStart] = useState(() => weekStartIsoOf(today, 'mo'));
  const [entries, setEntries] = useState<readonly WeekPlansRow[]>([]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const identity = session.status === 'signed-in' ? session.identity : null;
  const days = Array.from({ length: 7 }, (_, index) => {
    const iso = addDaysIso(weekStart, index);
    return {
      iso,
      short: weekdayShort(iso, lang),
      long: weekdayLong(iso, lang),
      number: dayOfMonth(iso),
      label: `${weekdayShort(iso, lang)} ${dayOfMonth(iso)}`,
    };
  });
  const currentDayIndex = days.findIndex((day) => day.iso === today);
  const todayIndex = Math.max(0, currentDayIndex);
  const defaultOpen = Object.fromEntries(
    days.map((_, index) => [index, currentDayIndex < 0 || index >= currentDayIndex]),
  );
  const [openState, setOpenState] = useState<{
    weekStart: string;
    values: Record<number, boolean>;
  }>(() => ({ weekStart, values: defaultOpen }));
  const open = openState.weekStart === weekStart ? openState.values : defaultOpen;

  useEffect(() => {
    if (!identity) return;
    let active = true;
    void weekPlan
      .list(identity.calendarId, weekStart)
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch(() => {
        if (active) show(t('plannerLoadError'), 'danger');
      });
    return () => {
      active = false;
    };
  }, [identity, show, t, weekPlan, weekStart]);

  const plannedDays = new Set(
    entries.filter((entry) => entry.entry_type === 'meal').map((entry) => entry.day_of_week),
  ).size;
  const openTasks = entries.filter(
    (entry) => entry.entry_type === 'task' && !entry.is_done,
  ).length;

  const toggleTask = (task: WeekPlansRow) => {
    if (!identity) return;
    const nextDone = !task.is_done;
    setEntries((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? { ...entry, is_done: nextDone, completed_at: nextDone ? new Date().toISOString() : null }
          : entry,
      ),
    );
    void weekPlan
      .update(identity.calendarId, task.id, {
        is_done: nextDone,
        completed_at: nextDone ? new Date().toISOString() : null,
      })
      .catch(() => {
        setEntries((current) => current.map((entry) => (entry.id === task.id ? task : entry)));
        show(t('plannerSaveError'), 'danger');
      });
  };

  const saveEntry = async (draft: PlanDraft) => {
    if (!identity) return;
    const currentSheet = sheet;
    try {
      const assignedTo =
        draft.kind === 'meal'
          ? 'both'
          : draft.slot === 'u1'
            ? identity.userId
            : draft.slot === 'u2' && identity.partner
              ? identity.partner.id
              : 'both';
      if (currentSheet?.entryId) {
        const updated = await weekPlan.update(identity.calendarId, currentSheet.entryId, {
          day_of_week: draft.dayIndex,
          entry_type: draft.kind,
          title: draft.text,
          assigned_to: assignedTo,
        });
        setEntries((current) =>
          current.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
      } else {
        const created = await weekPlan.create({
          calendar_id: identity.calendarId,
          created_by: identity.userId,
          week_start: weekStart,
          day_of_week: draft.dayIndex,
          entry_type: draft.kind,
          title: draft.text,
          notes: '',
          sort_order: entries.filter((entry) => entry.day_of_week === draft.dayIndex).length,
          assigned_to: assignedTo,
          is_done: false,
          completed_at: null,
        });
        setEntries((current) => [...current, created]);
      }
      setSheet(null);
    } catch {
      show(t('plannerSaveError'), 'danger');
    }
  };

  const openShoppingList = async () => {
    if (!identity) return;
    try {
      const groups = await notesTodoGroups.list(identity.calendarId);
      const existing = groups.find((group) => /einkauf|shopping/i.test(group.name));
      const group =
        existing ??
        (await notesTodoGroups.create({
          calendarId: identity.calendarId,
          createdBy: identity.userId,
          name: t('plannerShoppingList'),
        }));
      void navigate(`/todos/${group.id}`);
    } catch {
      show(t('plannerShoppingError'), 'danger');
    }
  };

  return (
    <div className={screen.screen}>
      <AppHeader
        kicker={`${t('plannerWeek')} ${isoWeekNumber(weekStart)}`}
        title={weekRangeLabel(weekStart, lang)}
        range={{
          onPrev: () => setWeekStart(addDaysIso(weekStart, -7)),
          onNext: () => setWeekStart(addDaysIso(weekStart, 7)),
          onToday: () => setWeekStart(weekStartIsoOf(today, 'mo')),
          prevLabel: t('calPrevWeek'),
          nextLabel: t('calNextWeek'),
          todayLabel: t('today'),
        }}
      />
      <div className={screen.body}>
        <div className={screen.stack}>
          <Card tone="brand" padding="12px 14px">
            <div className={styles.summary}>
              <div className={styles.summaryText}>
                <div className={styles.summaryTitle}>{weekRangeLabel(weekStart, lang)}</div>
                <div className={styles.summaryHint}>
                  {plannedDays} {t('plannerOfDaysPlanned')} · {openTasks} {t('plannerTasksOpen')}
                </div>
              </div>
              <Button onClick={() => void openShoppingList()}>{t('plannerShoppingList')}</Button>
            </div>
          </Card>

          {days.map((day, index) => {
            const isOpen = open[index] ?? false;
            const isToday = day.iso === today;
            const panelId = `${baseId}-day-${index}`;
            const meals = entries.filter(
              (entry) => entry.day_of_week === index && entry.entry_type === 'meal',
            );
            const tasks = entries.filter(
              (entry) => entry.day_of_week === index && entry.entry_type === 'task',
            );
            const dayOpenTasks = tasks.filter((task) => !task.is_done).length;
            const preview = [
              meals[0]?.title || t('plannerNoMeal'),
              `${tasks.length} ${t('plannerTasks')}`,
            ].join(' · ');

            return (
              <div
                key={day.iso}
                className={`${styles.day} ${isToday ? styles.dayToday : ''}`}
                data-testid="planner-day"
              >
                <button
                  type="button"
                  className={`${styles.dayHead} ${isOpen ? '' : styles.dayHeadCollapsed}`}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpenState((state) => ({
                      weekStart,
                      values: {
                        ...(state.weekStart === weekStart ? state.values : defaultOpen),
                        [index]: !isOpen,
                      },
                    }))
                  }
                >
                  <span className={styles.badge}>
                    <span className={styles.badgeWeekday}>{day.short}</span>
                    <span className={styles.badgeNumber}>{day.number}</span>
                  </span>
                  <span className={styles.dayTitles}>
                    <span className={styles.dayWeekday}>{day.long}</span>
                    {isOpen ? null : <span className={styles.dayPreview}>{preview}</span>}
                  </span>
                  <span className={styles.daySummary}>
                    {dayOpenTasks > 0 ? `${dayOpenTasks} ${t('plannerTasksOpen')}` : ''}
                  </span>
                  <span className={styles.chevron} aria-hidden="true">
                    {isOpen ? '▴' : '▾'}
                  </span>
                </button>

                {isOpen ? (
                  <div className={styles.panes} id={panelId}>
                    <div className={`${styles.pane} ${styles.paneMeal}`}>
                      <div className={styles.paneHead}>
                        <span className={styles.paneIconMeal}>
                          <Icon name="meal" size={14} />
                        </span>
                        <span className={styles.paneLabel}>{t('plannerMeal')}</span>
                        <button
                          type="button"
                          className={styles.paneAction}
                          aria-label={`${t('plannerEditMeal')}: ${day.long}`}
                          onClick={() =>
                            setSheet({
                              dayIndex: index,
                              kind: 'meal',
                              ...(meals[0]
                                ? { entryId: meals[0].id, initialText: meals[0].title }
                                : {}),
                            })
                          }
                        >
                          <span aria-hidden="true">✎</span>
                        </button>
                      </div>
                      <div className={`${styles.meal} ${meals.length ? '' : styles.mealEmpty}`}>
                        {meals.map((meal) => meal.title).join(', ') || t('plannerNoMeal')}
                      </div>
                    </div>

                    <div className={styles.pane}>
                      <div className={styles.paneHead}>
                        <span className={styles.paneIconTask}>
                          <Icon name="task" size={14} />
                        </span>
                        <span className={styles.paneLabel}>{t('plannerTasks')}</span>
                      </div>
                      {tasks.map((task) => {
                        const inputId = `${baseId}-task-${task.id}`;
                        const slot = slotFor(task.assigned_to, identity?.userId, identity?.partner?.id);
                        return (
                          <div key={task.id} className={styles.task}>
                            <input
                              id={inputId}
                              type="checkbox"
                              className={styles.box}
                              checked={task.is_done}
                              onChange={() => toggleTask(task)}
                            />
                            <label
                              htmlFor={inputId}
                              className={`${styles.taskText} ${task.is_done ? styles.taskDone : ''}`}
                            >
                              {task.title}
                            </label>
                            <span
                              className={styles.taskDot}
                              style={{ background: personTokens(slot).bar }}
                              aria-hidden="true"
                            />
                          </div>
                        );
                      })}
                      {tasks.length === 0 ? (
                        <div className={styles.noTasks}>{t('plannerNoTasks')}</div>
                      ) : null}
                      <button
                        type="button"
                        className={styles.addTask}
                        onClick={() => setSheet({ dayIndex: index, kind: 'task' })}
                      >
                        + {t('plannerAddTask')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <Fab label={t('plannerAddEntry')} onClick={() => setSheet({ dayIndex: todayIndex, kind: 'meal' })} />

      <PlanSheet
        key={sheet ? `${sheet.dayIndex}-${sheet.kind}-${sheet.entryId ?? 'new'}` : 'none'}
        open={sheet !== null}
        days={days}
        defaultDayIndex={sheet?.dayIndex ?? todayIndex}
        defaultKind={sheet?.kind ?? 'meal'}
        initialText={sheet?.initialText ?? ''}
        onClose={() => setSheet(null)}
        onSave={(draft) => void saveEntry(draft)}
      />
    </div>
  );
}

function localTodayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function weekdayLong(iso: string, lang: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function slotFor(assignedTo: string, userId?: string, partnerId?: string): 'u1' | 'u2' | 'both' {
  if (assignedTo === userId) return 'u1';
  if (assignedTo === partnerId) return 'u2';
  return 'both';
}
