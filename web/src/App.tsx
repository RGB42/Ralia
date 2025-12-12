import { useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./App.css";

type Participant = "u1" | "u2";

type CoupleUser = {
  id: Participant;
  name: string;
  inviteCode: string;
};

type Event = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  start: string; // ISO string
  end: string; // ISO string
  participants: Participant[];
};

type ViewMode = "month" | "week";
type ParticipantFilter = "all" | "u1" | "u2" | "both";

const categoryPalette: Record<string, string> = {
  "Quality Time": "#8f72ff",
  "Date Night": "#ff7f50",
  Travel: "#00bfa6",
  "Family & Friends": "#e25bae",
  Errands: "#4fb3f6",
};

const defaultEvents: Event[] = [
  {
    id: "1",
    title: "Book restaurant",
    description: "Reserve the table for Saturday night",
    category: "Date Night",
    location: "Downtown",
    start: new Date().toISOString(),
    end: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
    participants: ["u1", "u2"],
  },
  {
    id: "2",
    title: "Therapy session",
    description: "Individual session for partner",
    category: "Quality Time",
    location: "Online",
    start: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
    end: new Date(new Date().setDate(new Date().getDate() + 1) + 60 * 60 * 1000).toISOString(),
    participants: ["u2"],
  },
];

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function sameDay(date: Date, other: Date | string) {
  const d = new Date(other);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

function isoForDate(date: Date, hour = 9) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<Event[]>(defaultEvents);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [participantFilter, setParticipantFilter] = useState<ParticipantFilter>("all");

  const [me, setMe] = useState<CoupleUser | null>(null);
  const [partner, setPartner] = useState<CoupleUser | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [partnerNameInput, setPartnerNameInput] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [isLinked, setIsLinked] = useState(false);

  const [draft, setDraft] = useState({
    title: "",
    description: "",
    category: "Quality Time",
    location: "",
    start: isoForDate(new Date()),
    end: isoForDate(new Date(), 11),
    participants: ["u1", "u2"] as Participant[],
  });

  const filteredEvents = useMemo(
    () =>
      events.filter(event => {
        if (participantFilter === "all") return true;
        if (participantFilter === "both")
          return event.participants.includes("u1") && event.participants.includes("u2");
        return event.participants.includes(participantFilter);
      }),
    [events, participantFilter],
  );

  const eventsForDay = useMemo(
    () => filteredEvents.filter(e => sameDay(selectedDate, e.start)),
    [filteredEvents, selectedDate],
  );

  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(start.setDate(diff));
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return d;
    });
  }, [selectedDate]);

  const weekEvents = useMemo(
    () =>
      weekDays.map(day => ({
        day,
        events: filteredEvents.filter(e => sameDay(day, e.start)),
      })),
    [filteredEvents, weekDays],
  );

  function createAccount() {
    if (!nameInput.trim()) return;
    const generatedCode = `LOVE-${nameInput.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0")}`;
    setMe({ id: "u1", name: nameInput.trim(), inviteCode: generatedCode });
    setNameInput("");
  }

  function acceptInvite() {
    if (!inviteCodeInput.trim()) return;
    setPartner({
      id: "u2",
      name: partnerNameInput.trim() || "Partner",
      inviteCode: inviteCodeInput.trim(),
    });
    setIsLinked(true);
  }

  function toggleParticipant(participant: Participant) {
    setDraft(prev => {
      const has = prev.participants.includes(participant);
      const updated = has
        ? prev.participants.filter(p => p !== participant)
        : [...prev.participants, participant];
      return { ...prev, participants: updated };
    });
  }

  function addEvent() {
    if (!draft.title.trim() || draft.participants.length === 0) return;
    const newEvent: Event = {
      ...draft,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      start: new Date(draft.start).toISOString(),
      end: new Date(draft.end).toISOString(),
    };
    setEvents([newEvent, ...events]);
    setDraft({
      title: "",
      description: "",
      category: "Quality Time",
      location: "",
      start: isoForDate(selectedDate),
      end: isoForDate(selectedDate, 11),
      participants: ["u1", "u2"],
    });
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Couple Calendar</p>
          <h1>Plan together, stay in sync</h1>
          <p className="lede">
            Register, share your invite code, and manage events with categories, timeframes and
            locations. Assign each event to one partner or both.
          </p>
        </div>
        <div className="hero-card">
          <div className="hero-pill">Step 1 · Pair up</div>
          <div className="inputs">
            <label className="field">
              <span>Your name</span>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Alex"
              />
            </label>
            <button className="primary" onClick={createAccount} disabled={!nameInput.trim()}>
              Create account &amp; invite code
            </button>
            {me && (
              <div className="invite-card">
                <p>Share this with your partner</p>
                <code>{me.inviteCode}</code>
              </div>
            )}
            <div className="field">
              <span>Partner name (optional)</span>
              <input
                value={partnerNameInput}
                onChange={e => setPartnerNameInput(e.target.value)}
                placeholder="Jamie"
              />
            </div>
            <div className="field">
              <span>Enter partner invite code</span>
              <input
                value={inviteCodeInput}
                onChange={e => setInviteCodeInput(e.target.value)}
                placeholder="LOVE-..."
              />
            </div>
            <button className="ghost" onClick={acceptInvite} disabled={!inviteCodeInput.trim()}>
              Accept invite &amp; link calendar
            </button>
            {isLinked && partner && (
              <div className="status">
                <span className="dot" /> Linked with {partner.name}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Shared calendar</p>
              <h2>
                {selectedDate.toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h2>
            </div>
            <div className="segmented">
              <button
                className={viewMode === "month" ? "active" : ""}
                onClick={() => setViewMode("month")}
              >
                Month
              </button>
              <button
                className={viewMode === "week" ? "active" : ""}
                onClick={() => setViewMode("week")}
              >
                Week
              </button>
            </div>
          </div>
          <div className="filters">
            <span>Show events for</span>
            <div className="segmented small">
              <button
                className={participantFilter === "all" ? "active" : ""}
                onClick={() => setParticipantFilter("all")}
              >
                Both &amp; mine
              </button>
              <button
                className={participantFilter === "u1" ? "active" : ""}
                onClick={() => setParticipantFilter("u1")}
              >
                Me
              </button>
              <button
                className={participantFilter === "u2" ? "active" : ""}
                onClick={() => setParticipantFilter("u2")}
              >
                Partner
              </button>
              <button
                className={participantFilter === "both" ? "active" : ""}
                onClick={() => setParticipantFilter("both")}
              >
                Both only
              </button>
            </div>
          </div>
          <div className="calendar-shell">
            <Calendar
              onChange={date => {
                setSelectedDate(date as Date);
                setSelectedEvent(null);
              }}
              value={selectedDate}
              minDetail="decade"
              maxDetail="month"
            />
          </div>
          {viewMode === "week" && (
            <div className="week-strip">
              {weekEvents.map(({ day, events: dayEvents }) => (
                <div
                  key={day.toISOString()}
                  className={`week-day ${sameDay(day, selectedDate) ? "active" : ""}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <strong>{day.getDate()}</strong>
                  <div className="chips">
                    {dayEvents.map(e => (
                      <span
                        key={e.id}
                        className="chip"
                        style={{ background: categoryPalette[e.category] || "#111" }}
                        onClick={() => setSelectedEvent(e)}
                      >
                        {e.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="events">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Events on</p>
                <h3>{formatDayLabel(selectedDate)}</h3>
              </div>
              <button className="ghost" onClick={() => setSelectedEvent(null)}>
                Clear selection
              </button>
            </div>
            {eventsForDay.length === 0 && <p className="muted">No events yet. Add one below.</p>}
            {eventsForDay.map(e => (
              <article
                key={e.id}
                className="event-card"
                onClick={() => setSelectedEvent(e)}
                style={{ borderColor: categoryPalette[e.category] || "#ccc" }}
              >
                <div className="event-meta">
                  <span className="pill" style={{ background: categoryPalette[e.category] }}>
                    {e.category}
                  </span>
                  <span className="time">
                    {new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                    -{" "}
                    {new Date(e.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <h4>{e.title}</h4>
                <p className="muted">{e.description}</p>
                <p className="location">📍 {e.location || "No location set"}</p>
                <div className="participants">
                  {["u1", "u2"].map(id => (
                    <span key={id} className={e.participants.includes(id as Participant) ? "badge" : "badge ghost"}>
                      {id === "u1" ? me?.name || "You" : partner?.name || "Partner"}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
          {selectedEvent && (
            <div className="dialog">
              <div className="dialog-header">
                <h4>{selectedEvent.title}</h4>
                <button onClick={() => setSelectedEvent(null)}>Close</button>
              </div>
              <p>{selectedEvent.description}</p>
              <p>
                {new Date(selectedEvent.start).toLocaleString()} -{" "}
                {new Date(selectedEvent.end).toLocaleString()}
              </p>
              <p>Location: {selectedEvent.location}</p>
              <div className="participants">
                {selectedEvent.participants.map(p => (
                  <span key={p} className="badge">
                    {p === "u1" ? me?.name || "You" : partner?.name || "Partner"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel sticky">
          <p className="eyebrow">Create an event</p>
          <h3>Category, timeframe, location</h3>
          <div className="inputs">
            <label className="field">
              <span>Title</span>
              <input
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder="Beach day"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={draft.description}
                onChange={e => setDraft({ ...draft, description: e.target.value })}
                placeholder="Bring sunscreen and snacks"
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                value={draft.category}
                onChange={e => setDraft({ ...draft, category: e.target.value })}
              >
                {Object.keys(categoryPalette).map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-fields">
              <label className="field">
                <span>Starts</span>
                <input
                  type="datetime-local"
                  value={draft.start}
                  onChange={e => setDraft({ ...draft, start: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Ends</span>
                <input
                  type="datetime-local"
                  value={draft.end}
                  onChange={e => setDraft({ ...draft, end: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>Location</span>
              <input
                value={draft.location}
                onChange={e => setDraft({ ...draft, location: e.target.value })}
                placeholder="Cafe, home, online..."
              />
            </label>
            <div className="field">
              <span>Assign to</span>
              <div className="segmented small">
                <button
                  className={draft.participants.includes("u1") ? "active" : ""}
                  onClick={() => toggleParticipant("u1")}
                  type="button"
                >
                  {me?.name || "You"}
                </button>
                <button
                  className={draft.participants.includes("u2") ? "active" : ""}
                  onClick={() => toggleParticipant("u2")}
                  type="button"
                >
                  {partner?.name || "Partner"}
                </button>
              </div>
            </div>
          </div>
          <button className="primary" onClick={addEvent} disabled={!draft.title || draft.participants.length === 0}>
            Add event to shared calendar
          </button>
          <p className="muted tiny">
            Switching to week view lets you zoom into schedules for a single week. Month view lets you
            jump forward/back using the calendar navigation.
          </p>
        </section>
      </main>
    </div>
  );
}
