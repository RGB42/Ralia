import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

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
  start: string;
  end: string;
  participants: Participant[];
};

const categories = [
  { id: "Quality Time", color: "#a78bfa" },
  { id: "Date Night", color: "#fb7185" },
  { id: "Travel", color: "#22d3ee" },
  { id: "Family & Friends", color: "#f472b6" },
  { id: "Errands", color: "#60a5fa" },
];

const initialEvents: Event[] = [
  {
    id: "welcome",
    title: "Coffee catch-up",
    description: "Start the week together",
    category: "Quality Time",
    location: "Home",
    start: new Date().toISOString(),
    end: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
    participants: ["u1", "u2"],
  },
];

function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function daysInMonth(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const result: Date[] = [];
  for (let i = 0; i < 31; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getMonth() !== start.getMonth()) break;
    result.push(d);
  }
  return result;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [participantFilter, setParticipantFilter] = useState<"all" | Participant>("all");
  const [me, setMe] = useState<CoupleUser | null>(null);
  const [partner, setPartner] = useState<CoupleUser | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [partnerNameInput, setPartnerNameInput] = useState("");
  const [partnerCodeInput, setPartnerCodeInput] = useState("");
  const [linked, setLinked] = useState(false);

  const [draft, setDraft] = useState({
    title: "",
    description: "",
    category: categories[0].id,
    location: "",
    startTime: "09:00",
    endTime: "10:00",
    participants: ["u1", "u2"] as Participant[],
  });

  const filteredEvents = useMemo(
    () =>
      events.filter(event => {
        if (participantFilter === "all") return true;
        return event.participants.includes(participantFilter);
      }),
    [events, participantFilter],
  );

  const eventsForDay = useMemo(
    () => filteredEvents.filter(e => sameDay(new Date(e.start), selectedDate)),
    [filteredEvents, selectedDate],
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return d;
    });
  }, [selectedDate]);

  function createAccount() {
    if (!nameInput.trim()) return;
    const code = `LOVE-${nameInput.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0")}`;
    setMe({ id: "u1", name: nameInput.trim(), inviteCode: code });
    setNameInput("");
  }

  function connectPartner() {
    if (!partnerCodeInput.trim()) return;
    setPartner({
      id: "u2",
      name: partnerNameInput.trim() || "Partner",
      inviteCode: partnerCodeInput.trim(),
    });
    setLinked(true);
  }

  function toggleParticipant(id: Participant) {
    setDraft(prev => {
      const has = prev.participants.includes(id);
      const participants = has ? prev.participants.filter(p => p !== id) : [...prev.participants, id];
      return { ...prev, participants };
    });
  }

  function addEvent() {
    if (!draft.title || draft.participants.length === 0) return;
    const [sh, sm] = draft.startTime.split(":").map(Number);
    const [eh, em] = draft.endTime.split(":").map(Number);
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    const safeSH = Number.isFinite(sh) ? sh : 9;
    const safeSM = Number.isFinite(sm) ? sm : 0;
    const safeEH = Number.isFinite(eh) ? eh : safeSH + 1;
    const safeEM = Number.isFinite(em) ? em : safeSM;
    start.setHours(safeSH, safeSM, 0, 0);
    end.setHours(safeEH, safeEM, 0, 0);
    const newEvent: Event = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      location: draft.location.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      participants: draft.participants,
    };
    setEvents([newEvent, ...events]);
    setDraft({
      ...draft,
      title: "",
      description: "",
      location: "",
    });
  }

  function changeMonth(delta: number) {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + delta);
    setSelectedDate(d);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>Couple Calendar</Text>
        <Text style={styles.title}>One shared view for both of you</Text>
        <Text style={styles.subtitle}>
          Register, share an invite code, and plan date nights, errands and trips together. Works on iOS,
          Android and web with the same codebase.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Step 1 · Pair with your partner</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Alex"
              placeholderTextColor="#8892a6"
            />
            <Pressable style={styles.primary} onPress={createAccount} disabled={!nameInput.trim()}>
              <Text style={styles.primaryText}>Create account & invite code</Text>
            </Pressable>
            {me && (
              <View style={styles.inviteBox}>
                <Text style={styles.label}>Invite code</Text>
                <Text style={styles.inviteCode}>{me.inviteCode}</Text>
              </View>
            )}
          </View>

          <View style={[styles.inputGroup, { marginTop: 16 }]}>
            <Text style={styles.label}>Partner name (optional)</Text>
            <TextInput
              style={styles.input}
              value={partnerNameInput}
              onChangeText={setPartnerNameInput}
              placeholder="Jamie"
              placeholderTextColor="#8892a6"
            />
            <Text style={styles.label}>Enter invite code</Text>
            <TextInput
              style={styles.input}
              value={partnerCodeInput}
              onChangeText={setPartnerCodeInput}
              placeholder="LOVE-XXXX-0000"
              placeholderTextColor="#8892a6"
            />
            <Pressable
              style={styles.outline}
              onPress={connectPartner}
              disabled={!partnerCodeInput.trim()}
            >
              <Text style={styles.outlineText}>Accept invite & link</Text>
            </Pressable>
            {linked && partner && (
              <Text style={styles.success}>Linked with {partner.name}</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionTitle}>Shared calendar</Text>
              <Text style={styles.subtle}>
                {selectedDate.toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.segmented}>
              <Pressable
                style={[styles.segment, viewMode === "month" && styles.segmentActive]}
                onPress={() => setViewMode("month")}
              >
                <Text style={styles.segmentText}>Month</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, viewMode === "week" && styles.segmentActive]}
                onPress={() => setViewMode("week")}
              >
                <Text style={styles.segmentText}>Week</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.label}>Show for</Text>
            <View style={styles.segmented}>
              <Pressable
                style={[styles.segment, participantFilter === "all" && styles.segmentActive]}
                onPress={() => setParticipantFilter("all")}
              >
                <Text style={styles.segmentText}>Both</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, participantFilter === "u1" && styles.segmentActive]}
                onPress={() => setParticipantFilter("u1")}
              >
                <Text style={styles.segmentText}>Me</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, participantFilter === "u2" && styles.segmentActive]}
                onPress={() => setParticipantFilter("u2")}
              >
                <Text style={styles.segmentText}>Partner</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <Pressable style={styles.outlineSmall} onPress={() => changeMonth(-1)}>
              <Text style={styles.outlineText}>Previous</Text>
            </Pressable>
            <Text style={styles.label}>
              {selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </Text>
            <Pressable style={styles.outlineSmall} onPress={() => changeMonth(1)}>
              <Text style={styles.outlineText}>Next</Text>
            </Pressable>
          </View>

          {viewMode === "month" ? (
            <View style={styles.calendarGrid}>
              {daysInMonth(selectedDate).map(day => (
                <Pressable
                  key={day.toISOString()}
                  style={[
                    styles.day,
                    sameDay(day, selectedDate) && styles.dayActive,
                  ]}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={styles.dayLabel}>{day.getDate()}</Text>
                  <View style={styles.dayDots}>
                    {filteredEvents
                      .filter(e => sameDay(new Date(e.start), day))
                      .map(e => (
                        <View
                          key={e.id}
                          style={[
                            styles.dotEvent,
                            { backgroundColor: categories.find(c => c.id === e.category)?.color },
                          ]}
                        />
                      ))}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.weekRow}>
              {weekDays.map(day => (
                <Pressable
                  key={day.toISOString()}
                  style={[styles.weekDay, sameDay(day, selectedDate) && styles.weekActive]}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={styles.weekDayLabel}>
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </Text>
                  <Text style={styles.weekDayNumber}>{day.getDate()}</Text>
                  {filteredEvents
                    .filter(e => sameDay(new Date(e.start), day))
                    .map(e => (
                      <Text key={e.id} style={styles.weekChip}>
                        {e.title}
                      </Text>
                    ))}
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Events on this day</Text>
            {eventsForDay.length === 0 && <Text style={styles.subtle}>No events yet.</Text>}
            {eventsForDay.map(e => (
              <View key={e.id} style={styles.eventCard}>
                <View style={styles.eventMeta}>
                  <Text style={styles.chip}>{e.category}</Text>
                  <Text style={styles.subtle}>
                    {new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {new Date(e.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <Text style={styles.subtle}>{e.description}</Text>
                <Text style={styles.subtle}>📍 {e.location || "No location"}</Text>
                <View style={styles.participants}>
                  {["u1", "u2"].map(id => (
                    <Text
                      key={id}
                      style={[
                        styles.participant,
                        !e.participants.includes(id as Participant) && styles.participantGhost,
                      ]}
                    >
                      {id === "u1" ? me?.name || "You" : partner?.name || "Partner"}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create event</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={draft.title}
              onChangeText={text => setDraft({ ...draft, title: text })}
              placeholder="Picnic in the park"
              placeholderTextColor="#8892a6"
            />
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              multiline
              value={draft.description}
              onChangeText={text => setDraft({ ...draft, description: text })}
              placeholder="Snacks and a blanket"
              placeholderTextColor="#8892a6"
            />
            <Text style={styles.label}>Category</Text>
            <View style={styles.segmented}>
              {categories.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.segment, draft.category === cat.id && styles.segmentActive]}
                  onPress={() => setDraft({ ...draft, category: cat.id })}
                >
                  <Text style={styles.segmentText}>{cat.id}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.label}>Starts</Text>
                <TextInput
                  style={styles.input}
                  value={draft.startTime}
                  onChangeText={text => setDraft({ ...draft, startTime: text })}
                  placeholder="09:00"
                  placeholderTextColor="#8892a6"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.label}>Ends</Text>
                <TextInput
                  style={styles.input}
                  value={draft.endTime}
                  onChangeText={text => setDraft({ ...draft, endTime: text })}
                  placeholder="11:00"
                  placeholderTextColor="#8892a6"
                />
              </View>
            </View>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={draft.location}
              onChangeText={text => setDraft({ ...draft, location: text })}
              placeholder="Cafe, home, online..."
              placeholderTextColor="#8892a6"
            />
            <Text style={styles.label}>Assign to</Text>
            <View style={styles.segmented}>
              <Pressable
                style={[styles.segment, draft.participants.includes("u1") && styles.segmentActive]}
                onPress={() => toggleParticipant("u1")}
              >
                <Text style={styles.segmentText}>{me?.name || "You"}</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, draft.participants.includes("u2") && styles.segmentActive]}
                onPress={() => toggleParticipant("u2")}
              >
                <Text style={styles.segmentText}>{partner?.name || "Partner"}</Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.primary, { marginTop: 10 }]}
              onPress={addEvent}
              disabled={!draft.title || draft.participants.length === 0}
            >
              <Text style={styles.primaryText}>Add to calendar</Text>
            </Pressable>
            <Text style={styles.subtle}>
              Use week view to zoom into a specific week. Month navigation lets you jump to previous or
              future months easily.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0b1021",
  },
  container: {
    padding: 16,
    gap: 12,
  },
  eyebrow: {
    color: "#a5b4fc",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: "#e5e7eb",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 4,
  },
  subtitle: {
    color: "#cfd3e3",
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionTitle: {
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtle: {
    color: "#94a3b8",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: "#cbd5e1",
    marginTop: 6,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
    color: "#e5e7eb",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  primary: {
    backgroundColor: "#7c3aed",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  outline: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  outlineSmall: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  outlineText: {
    color: "#e5e7eb",
  },
  inviteBox: {
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
  },
  inviteCode: {
    color: "#c4b5fd",
    fontWeight: "700",
    fontSize: 16,
  },
  success: {
    color: "#34d399",
    fontWeight: "700",
    marginTop: 6,
  },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    overflow: "hidden",
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  segmentActive: {
    backgroundColor: "rgba(124,58,237,0.2)",
  },
  segmentText: {
    color: "#e5e7eb",
    fontSize: 12,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  day: {
    width: "13%",
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  dayActive: {
    borderColor: "#c4b5fd",
    backgroundColor: "rgba(124,58,237,0.2)",
  },
  dayLabel: {
    color: "#e5e7eb",
  },
  dayDots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 4,
  },
  dotEvent: {
    width: 6,
    height: 6,
    borderRadius: 6,
  },
  weekRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  weekDay: {
    flex: 1,
    minWidth: "28%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  weekActive: {
    borderColor: "#c084fc",
    backgroundColor: "rgba(124,58,237,0.2)",
  },
  weekDayLabel: {
    color: "#cbd5e1",
  },
  weekDayNumber: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
  },
  weekChip: {
    marginTop: 4,
    color: "#f8fafc",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 4,
    borderRadius: 8,
  },
  eventCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.25)",
    color: "#ede9fe",
    overflow: "hidden",
  },
  eventTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  participants: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  participant: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.2)",
    color: "#bbf7d0",
  },
  participantGhost: {
    backgroundColor: "rgba(255,255,255,0.04)",
    color: "#94a3b8",
  },
});
