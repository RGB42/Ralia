import React, { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import './App.css'

type Event = {
  id: number;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
};

export default function App() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const dateStr = selectedDate.toISOString().split("T")[0];
  const eventsForDay = events.filter(e => e.date === dateStr);

  function addEvent() {
    setEvents([
      ...events,
      {
        id: Date.now(),
        date: dateStr,
        title: newTitle,
        description: newDesc,
      },
    ]);
    setNewTitle("");
    setNewDesc("");
    setShowAdd(false);
  }

  function removeEvent(id: number) {
    setEvents(events.filter(e => e.id !== id));
    setSelectedEvent(null);
  }

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Shared Calendar</h1>
      <Calendar
        onChange={date => {
          setSelectedDate(date as Date);
          setSelectedEvent(null);
        }}
        value={selectedDate}
      />
      <h2 style={{ marginTop: "2rem" }}>
        Events for {dateStr}
        <button style={{ marginLeft: 16 }} onClick={() => setShowAdd(true)}>
          Add Event
        </button>
      </h2>
      {eventsForDay.length === 0 && <p>No events for this day.</p>}
      <ul>
        {eventsForDay.map(e => (
          <li key={e.id} style={{ marginBottom: 8 }}>
            <a
              href="#"
              onClick={() => setSelectedEvent(e)}
              style={{ textDecoration: "underline", color: "blue" }}
            >
              {e.title}
            </a>
            <button
              style={{ marginLeft: 8, color: "red" }}
              onClick={() => removeEvent(e.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {showAdd && (
        <div style={{ border: "1px solid #ccc", padding: 16, marginTop: 16 }}>
          <h3>Add Event</h3>
          <input
            placeholder="Title"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            style={{ display: "block", marginBottom: 8, width: "100%" }}
          />
          <textarea
            placeholder="Description"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            style={{ display: "block", marginBottom: 8, width: "100%" }}
          />
          <button onClick={addEvent} disabled={!newTitle}>
            Save
          </button>
          <button onClick={() => setShowAdd(false)} style={{ marginLeft: 8 }}>
            Cancel
          </button>
        </div>
      )}
      {selectedEvent && (
        <div style={{ border: "1px solid #888", padding: 16, marginTop: 16 }}>
          <h3>{selectedEvent.title}</h3>
          <p>{selectedEvent.description}</p>
          <button onClick={() => setSelectedEvent(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
