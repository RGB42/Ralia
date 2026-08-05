import { AppHeader, Button, Card, Fab, Icon, personTokens } from '@ralia/ui';
import { useId, useState } from 'react';
import { useT } from '../../i18n/useT.js';
import { MOCK_PLANNER, MOCK_TODAY } from '../../mock/fixtures.js';
import screen from '../screen.module.css';
import { PlanSheet, type PlanEntryKind } from '../../sheets/PlanSheet.js';
import styles from './PlannerScreen.module.css';

const TODAY_DAY = Number(MOCK_TODAY.slice(8, 10));

/** Langer Wochentagsname aus dem kurzen der Fixtures. */
const LONG_WEEKDAY: Record<string, string> = {
  Mo: 'Montag',
  Di: 'Dienstag',
  Mi: 'Mittwoch',
  Do: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  So: 'Sonntag',
};

export function PlannerScreen(): React.JSX.Element {
  const { t } = useT();
  const baseId = useId();

  /*
   * Standard aus der Vorlage (Z. 1327): Tage vor heute zu, ab heute auf.
   * Der Planer laeuft von Montag bis Sonntag, die Tagesnummer allein taugt
   * nicht zum Vergleich (der 1. und 2. gehoeren zum Folgemonat) — deshalb
   * entscheidet die Position gegenueber dem heutigen Tag.
   */
  const todayIndex = MOCK_PLANNER.findIndex((day) => day.dayOfMonth === TODAY_DAY);
  const [open, setOpen] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(MOCK_PLANNER.map((_, index) => [index, index >= todayIndex])),
  );
  const [sheet, setSheet] = useState<{ dayIndex: number; kind: PlanEntryKind } | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      MOCK_PLANNER.flatMap((day) => day.tasks.map((task) => [task.id, task.done])),
    ),
  );

  const plannedDays = MOCK_PLANNER.filter((day) => day.meal !== '').length;
  const openTasks = MOCK_PLANNER.flatMap((day) => day.tasks).filter(
    (task) => !done[task.id],
  ).length;

  return (
    <div className={screen.screen}>
      <AppHeader kicker={t('navPlanner')} title={`${t('plannerWeek')} 31`} />
      <div className={screen.body}>
        <div className={screen.stack}>
          <Card tone="brand" padding="12px 14px">
            <div className={styles.summary}>
              <div className={styles.summaryText}>
                <div className={styles.summaryTitle}>
                  {t('plannerWeek')} 31 · 27. Juli – 2. August
                </div>
                <div className={styles.summaryHint}>
                  {plannedDays} {t('plannerOfDaysPlanned')} · {openTasks} {t('plannerTasksOpen')}
                </div>
              </div>
              <Button onClick={() => undefined}>{t('plannerShoppingList')}</Button>
            </div>
          </Card>

          {MOCK_PLANNER.map((day, index) => {
            const isOpen = open[index] ?? false;
            const isToday = index === todayIndex;
            const panelId = `${baseId}-day-${index}`;
            const dayTasks = day.tasks;
            const dayOpenTasks = dayTasks.filter((task) => !done[task.id]).length;
            const preview = [
              day.meal || t('plannerNoMeal'),
              `${dayTasks.length} ${t('plannerTasks')}`,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <div
                key={day.weekday}
                className={`${styles.day} ${isToday ? styles.dayToday : ''}`}
                data-testid="planner-day"
              >
                <button
                  type="button"
                  className={`${styles.dayHead} ${isOpen ? '' : styles.dayHeadCollapsed}`}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen((value) => ({ ...value, [index]: !isOpen }))}
                >
                  <span className={styles.badge}>
                    <span className={styles.badgeWeekday}>{day.weekday}</span>
                    <span className={styles.badgeNumber}>{day.dayOfMonth}</span>
                  </span>
                  <span className={styles.dayTitles}>
                    <span className={styles.dayWeekday}>
                      {LONG_WEEKDAY[day.weekday] ?? day.weekday}
                    </span>
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
                          aria-label={`${t('plannerEditMeal')}: ${LONG_WEEKDAY[day.weekday] ?? day.weekday}`}
                          onClick={() => setSheet({ dayIndex: index, kind: 'meal' })}
                        >
                          <span aria-hidden="true">✎</span>
                        </button>
                      </div>
                      <div className={`${styles.meal} ${day.meal ? '' : styles.mealEmpty}`}>
                        {day.meal || t('plannerNoMeal')}
                      </div>
                    </div>

                    <div className={styles.pane}>
                      <div className={styles.paneHead}>
                        <span className={styles.paneIconTask}>
                          <Icon name="task" size={14} />
                        </span>
                        <span className={styles.paneLabel}>{t('plannerTasks')}</span>
                      </div>
                      {dayTasks.map((task) => {
                        const checked = done[task.id] ?? false;
                        const inputId = `${baseId}-task-${task.id}`;
                        return (
                          <div key={task.id} className={styles.task}>
                            <input
                              id={inputId}
                              type="checkbox"
                              className={styles.box}
                              checked={checked}
                              onChange={() =>
                                setDone((value) => ({ ...value, [task.id]: !checked }))
                              }
                            />
                            <label
                              htmlFor={inputId}
                              className={`${styles.taskText} ${checked ? styles.taskDone : ''}`}
                            >
                              {task.text}
                            </label>
                            <span
                              className={styles.taskDot}
                              style={{ background: personTokens(task.slot).bar }}
                              aria-hidden="true"
                            />
                          </div>
                        );
                      })}
                      {dayTasks.length === 0 ? (
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
      <Fab
        label={t('plannerAddEntry')}
        onClick={() => setSheet({ dayIndex: todayIndex, kind: 'meal' })}
      />

      <PlanSheet
        key={sheet ? `${sheet.dayIndex}-${sheet.kind}` : 'none'}
        open={sheet !== null}
        defaultDayIndex={sheet?.dayIndex ?? todayIndex}
        defaultKind={sheet?.kind ?? 'meal'}
        onClose={() => setSheet(null)}
        onSave={() => setSheet(null)}
      />
    </div>
  );
}
