"use strict";
const KEY = "klavier-uebeplan-v1";
const PAUSE_KEY = "klavier-uebeplan-pause-v1";
const DAY_MS = 86400000;
const INITIAL_PAST_DAYS = 21;
const FUTURE_DAYS = 7;
const CHUNK_DAYS = 28;
const LOCAL_STORAGE_ERROR = "Speichern auf diesem Gerät ist nicht verfügbar. Bitte Safari nicht im privaten Modus verwenden und Website-Daten erlauben.";
const $ = id => document.getElementById(id);
let pieces = [];
let logs = {};
let pauseFromDay = null;
let startDay = 0;
let endDay = 0;
let todayDay = 0;
let timer = null;
let storageAvailable = false;
let expandedPieceId = null;
const dateToDay = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? Math.round(date.getTime() / DAY_MS) : NaN;
};
const dayToDate = day => new Date(day * DAY_MS).toISOString().slice(0, 10);
const localToday = () => {
  const d = new Date();
  return dateToDay([d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"));
};
const formatDay = (day, opts) => new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", ...opts }).format(new Date(day * DAY_MS));
const compareDays = (a, b) => dateToDay(a) - dateToDay(b);
const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
function validatePieces(data) {
  if (!Array.isArray(data)) throw Error("Die Stückliste muss ein JSON-Array sein.");
  const seen = new Set();
  return data.map((p, i) => {
    if (!isPlainObject(p) || typeof p.id !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(p.id) || seen.has(p.id)) throw Error(`Ungültige oder doppelte id bei Stück ${i + 1}.`);
    seen.add(p.id);
    for (const key of ["titel", "werknummer", "tonart"]) if (typeof p[key] !== "string" || !p[key].trim()) throw Error(`Feld ${key} fehlt bei ${p.id}.`);
    if (!Number.isSafeInteger(p.intervallTage) || p.intervallTage < 1 || p.intervallTage > 3650) throw Error(`Ungültiges intervallTage bei ${p.id}.`);
    if (p.dauerMinuten !== undefined && (!Number.isSafeInteger(p.dauerMinuten) || p.dauerMinuten < 0 || p.dauerMinuten > 1440)) throw Error(`Ungültiges dauerMinuten bei ${p.id}.`);
    if (!Number.isFinite(dateToDay(p.ersterTermin))) throw Error(`Ungültiger ersterTermin bei ${p.id}.`);
    return p;
  });
}
function validateLogs(value) {
  if (!isPlainObject(value)) throw Error("Die Übungsdaten haben kein gültiges Format.");
  const out = Object.create(null);
  for (const [id, dates] of Object.entries(value)) {
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(id) || !Array.isArray(dates) || dates.length > 50000) throw Error("Ungültige Übungsdaten.");
    const normalized = [...new Set(dates)];
    if (normalized.length !== dates.length || dates.some(d => !Number.isFinite(dateToDay(d)))) throw Error("Ungültige oder doppelte Übungsdaten.");
    out[id] = normalized.sort(compareDays);
  }
  return out;
}
function readPause() {
  const raw = localStorage.getItem(PAUSE_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}
function savePause(day) {
  if (!storageAvailable) throw Error(LOCAL_STORAGE_ERROR);
  if (day === null) localStorage.removeItem(PAUSE_KEY);
  else localStorage.setItem(PAUSE_KEY, String(day));
  pauseFromDay = day;
}
function readLogs() {
  try {
    const raw = localStorage.getItem(KEY);
    storageAvailable = true;
    return raw ? validateLogs(JSON.parse(raw)) : Object.create(null);
  } catch (err) {
    storageAvailable = false;
    throw Error(`Übungsdaten konnten nicht gelesen werden: ${err.message}`);
  }
}
function saveLogs(next) {
  if (!storageAvailable) throw Error(LOCAL_STORAGE_ERROR);
  localStorage.setItem(KEY, JSON.stringify(next));
  logs = next;
}
function notice(text) { $("notice").textContent = text; }
function loggedDays(id, throughDay) {
  return (logs[id] || []).map(dateToDay).filter(d => d <= throughDay).sort((a, b) => a - b);
}
function statusFor(piece, day, actualToday) {
  const first = dateToDay(piece.ersterTermin);
  const sessions = loggedDays(piece.id, actualToday);
  if (sessions.includes(day)) return "done";
  if (pauseFromDay !== null && day >= pauseFromDay) return "paused";
  if (day < first && sessions.every(d => d > day)) return "";
  if (day > actualToday) {
    if (!sessions.length) return "";
    const next = sessions.at(-1) + piece.intervallTage;
    if (next <= actualToday) return "";
    return day >= next && (day - next) % piece.intervallTage === 0 ? "projected" : "";
  }
  let last = null;
  for (const practiced of sessions) {
    if (practiced >= day) break;
    last = practiced;
  }
  const due = last === null ? first : last + piece.intervallTage;
  return day === due ? "due" : day > due ? "late" : "";
}
function makeCell(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function makeHead(day) {
  const th = makeCell("th", null, day === todayDay ? "today-col" : "");
  th.dataset.day = day;
  th.append(makeCell("span", day === todayDay ? "Heute" : formatDay(day, { weekday: "short" })), makeCell("small", formatDay(day, { day: "2-digit", month: "2-digit", year: "numeric" })));
  return th;
}
function makeDayCell(piece, day) {
  const state = statusFor(piece, day, todayDay);
  const td = makeCell("td", null, `day-cell${day === todayDay ? " today-col" : ""}${state ? ` state-${state}` : ""}`);
  td.dataset.day = day;

  if (day === todayDay) {
    if (state === "paused") {
      td.append(makeCell("span", "Pause", "pause-label"));
      return td;
    }

    const done = state === "done";
    const btn = makeCell("button", done ? "✓ Geübt" : state === "late" ? "Überfällig" : state === "due" ? "Fällig" : "Üben");
    btn.type = "button";
    btn.className = `check${state === "due" || state === "late" || done ? " active" : ""}`;
    btn.setAttribute("aria-label", `${piece.titel}: ${done ? "Übung von heute rückgängig machen" : "heute als geübt markieren"}`);
    btn.setAttribute("aria-pressed", String(done));
    btn.addEventListener("click", () => toggleToday(piece.id));
    td.append(btn);
    return td;
  }

  if (day < todayDay && pauseFromDay === null) {
    const done = state === "done";
    const label = done ? "✓ Geübt" : state === "late" ? "Überfällig" : state === "due" ? "Fällig" : "·";

    const btn = makeCell("button", label, "retro");
    btn.type = "button";
    btn.setAttribute("aria-label", `${piece.titel}: ${done ? "Übung am" : "Übung nachtragen am"} ${formatDay(day, { day: "2-digit", month: "2-digit", year: "numeric" })}`);
    btn.addEventListener("click", () => togglePast(piece.id, day));
    td.append(btn);
    return td;
  }

  if (state) {
    td.textContent = {
      due: "Fällig",
      late: "Überfällig",
      done: "✓ Geübt",
      projected: "Geplant",
      paused: "Pause"
    }[state];
  } else {
    td.textContent = "·";
  }

  return td;
}
function totalForDay(day) {
  if (pauseFromDay !== null && day >= pauseFromDay) return 0;
  return pieces.reduce((sum, piece) => {
    const state = statusFor(piece, day, todayDay);
    const counted = day > todayDay ? state === "projected" : day === todayDay ? state === "due" || state === "late" || state === "done" : state === "done";
    return sum + (counted ? (piece.dauerMinuten ?? 0) : 0);
  }, 0);
}
function totalLabel(day) {
  const minutes = totalForDay(day);
  return minutes > 0 ? `${minutes} Min.` : "–";
}
function makeTotalCell(day) {
  const td = makeCell("td", totalLabel(day), `total-cell${day === todayDay ? " today-col" : ""}`);
  td.dataset.day = day;
  return td;
}
function repertoireMinutes() {
  return pieces.reduce((sum, piece) => sum + (piece.dauerMinuten ?? 0), 0);
}
function togglePieceDetails(id, event) {
  if (event) event.stopPropagation();
  expandedPieceId = expandedPieceId === id ? null : id;
  const pos = $("viewport").scrollLeft;
  render();
  $("viewport").scrollLeft = pos;
}
function render(scrollTarget = null) {
  todayDay = localToday();
  const head = $("head"), body = $("body");
  head.replaceChildren();
  body.replaceChildren();

  const headRow = document.createElement("tr");
  headRow.append(makeCell("th", "Stück", "piece headpiece"));

  for (let d = startDay; d <= endDay; d++) headRow.append(makeHead(d));
  head.append(headRow);

  for (const piece of pieces) {
    const row = document.createElement("tr");
    const label = makeCell("th", null, `piece${expandedPieceId === piece.id ? " expanded" : ""}`);
    label.scope = "row";

    const title = makeCell("button", piece.titel, "piece-title");
    title.type = "button";
    title.dataset.pieceId = piece.id;
    title.setAttribute("aria-expanded", String(expandedPieceId === piece.id));
    title.setAttribute(
      "aria-label",
      `${piece.titel}: Details ${expandedPieceId === piece.id ? "schließen" : "anzeigen"}`
    );
    title.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      togglePieceDetails(piece.id);
    });

    const details = makeCell(
      "small",
      `${piece.werknummer} · ${piece.tonart} · alle ${piece.intervallTage} Tage`,
      // `${piece.werknummer} · ${piece.tonart} · alle ${piece.intervallTage} Tage` + (piece.dauerMinuten != null ? ` · ${piece.dauerMinuten} Min.` : ""),
      "piece-details"
    );
    details.hidden = expandedPieceId !== piece.id;

    label.append(title, details);
    row.append(label);

    for (let d = startDay; d <= endDay; d++) row.append(makeDayCell(piece, d));
    body.append(row);
  }

  const totalRow = document.createElement("tr");
  totalRow.className = "total-row";
  const totalHeading = makeCell("th", "Tagesdauer", "piece total-piece");
  totalHeading.scope = "row";
  totalRow.append(totalHeading);

  for (let d = startDay; d <= endDay; d++) totalRow.append(makeTotalCell(d));
  body.append(totalRow);

  if (scrollTarget !== null) scrollToDay(scrollTarget);

  const repertoire = $("repertoireMinutes");
  if (repertoire) repertoire.textContent = `Repertoire: ${repertoireMinutes()} Min.`;
}
function scrollToDay(day) {
  const cell = [...$("head").querySelectorAll("[data-day]")].find(el => Number(el.dataset.day) === day);
  if (cell) $("viewport").scrollLeft = Math.max(0, cell.offsetLeft - $("head").querySelector(".headpiece").offsetWidth);
}
function togglePast(id, day) {
  if (day >= todayDay) return;
  if (pauseFromDay !== null) {
    notice("Während einer Pause können zurückliegende Übungen nicht nachgetragen werden.");
    return;
  }

  try {
    const date = dayToDate(day);
    const next = validateLogs(logs);
    const set = new Set(next[id] || []);
    const alreadyDone = set.has(date);

    const action = alreadyDone
      ? `Die Übung von ${pieceTitle(id)} am ${formatDay(day, { day: "2-digit", month: "2-digit", year: "numeric" })} entfernen?`
      : `Eine Übung von ${pieceTitle(id)} am ${formatDay(day, { day: "2-digit", month: "2-digit", year: "numeric" })} nachtragen?`;

    if (!confirm(`${action}\n\nDie künftigen Wiederholtermine werden neu berechnet.`)) return;

    if (alreadyDone) set.delete(date);
    else set.add(date);

    next[id] = [...set].sort(compareDays);
    saveLogs(next);

    const pos = $("viewport").scrollLeft;
    render();
    $("viewport").scrollLeft = pos;
    notice(alreadyDone ? "Übung entfernt." : "Übung nachgetragen.");
  } catch (err) {
    notice(`Nicht gespeichert: ${err.message}`);
  }
}

function pieceTitle(id) {
  return pieces.find(piece => piece.id === id)?.titel ?? id;
}
function toggleToday(id) {
  if (localToday() !== todayDay) { refreshDate(); return; }
  if (pauseFromDay !== null) { notice("Der Plan ist pausiert. Beende die Pause, um eine Übung zu markieren."); return; }
  try {
    const today = dayToDate(todayDay);
    const next = validateLogs(logs);
    const set = new Set(next[id] || []);
    if (set.has(today)) set.delete(today); else set.add(today);
    next[id] = [...set].sort(compareDays);
    saveLogs(next);
    const pos = $("viewport").scrollLeft;
    render(); $("viewport").scrollLeft = pos;
    notice("");
  } catch (err) { notice(`Nicht gespeichert: ${err.message}`); }
}
function togglePause() {
  try {
    if (pauseFromDay === null) {
      if (!confirm(`Plan ab heute (${formatDay(todayDay, { day: "2-digit", month: "2-digit", year: "numeric" })}) pausieren?\n\nBis zum Beenden werden keine Stücke als fällig oder geplant markiert. Beim Beenden werden alle künftigen Wiederholtermine um die Pausendauer verschoben.`)) return;
      savePause(todayDay);
      notice(`Plan pausiert ab ${formatDay(todayDay, { day: "2-digit", month: "2-digit", year: "numeric" })}.`);
    } else {
      const pauseDays = todayDay - pauseFromDay;
      if (pauseDays > 0) {
        const next = validateLogs(logs);
        for (const [id, dates] of Object.entries(next)) {
          next[id] = dates.map(dateToDay).map(day => day + pauseDays).map(dayToDate).sort(compareDays);
        }
        saveLogs(next);
      }
      savePause(null);
      notice(`Pause beendet. Alle Wiederholtermine wurden um ${pauseDays} Tag${pauseDays === 1 ? "" : "e"} verschoben.`);
    }
    const pos = $("viewport").scrollLeft;
    render(); $("viewport").scrollLeft = pos;
  } catch (err) { notice(`Pause konnte nicht geändert werden: ${err.message}`); }
}
function clearLocalData() {
  if (!confirm("Alle lokal gespeicherten Übungseinträge auf diesem Gerät löschen?\n\nDie Stückliste in stuecke.json bleibt unverändert. Diese Aktion kann nicht rückgängig gemacht werden. Exportiere vorher ein Backup, wenn du die Einträge behalten möchtest.")) return;
  try {
    if (!storageAvailable) throw Error(LOCAL_STORAGE_ERROR);
    localStorage.removeItem(KEY);
    localStorage.removeItem(PAUSE_KEY);
    logs = Object.create(null);
    pauseFromDay = null;
    const pos = $("viewport").scrollLeft;
    render(); $("viewport").scrollLeft = pos;
    notice("Lokal gespeicherte Übungseinträge wurden gelöscht.");
  } catch (err) { notice(`Löschen fehlgeschlagen: ${err.message}`); }
}
function refreshDate() {
  const newToday = localToday();
  if (newToday === todayDay) return;
  todayDay = newToday;
  if (endDay < todayDay + FUTURE_DAYS) endDay = todayDay + FUTURE_DAYS;
  render(todayDay);
}
function exportBackup() {
  const payload = { format: "klavier-uebeplan-v1", exportiertAm: new Date().toISOString(), uebungen: logs, pauseAb: pauseFromDay !== null ? dayToDate(pauseFromDay) : null };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `klavier-backup-${dayToDate(localToday())}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function importBackup(file) {
  try {
    if (!file || file.size > 10_000_000) throw Error("Bitte eine Backup-Datei unter 10 MB wählen.");
    const data = JSON.parse(await file.text());
    if (!isPlainObject(data) || data.format !== "klavier-uebeplan-v1") throw Error("Das ist kein passendes Klavier-Backup.");
    const candidate = validateLogs(data.uebungen);
    const count = Object.values(candidate).reduce((sum, days) => sum + days.length, 0);
    if (!confirm(`Backup mit ${count} Übungseinträgen importieren? Alle bisherigen Einträge auf diesem iPad werden ersetzt.`)) return;
    saveLogs(candidate);
    const pauseDate = data.pauseAb === null || data.pauseAb === undefined ? null : dateToDay(data.pauseAb);
    savePause(Number.isFinite(pauseDate) ? pauseDate : null);
    const pos = $("viewport").scrollLeft;
    render(); $("viewport").scrollLeft = pos;
    notice(`Backup mit ${count} Einträgen importiert.`);
  } catch (err) { notice(`Import fehlgeschlagen: ${err.message}`); }
}
async function init() {
  try {
    const response = await fetch("stuecke.json", { cache: "no-cache" });
    if (!response.ok) throw Error(`Stückliste nicht geladen (HTTP ${response.status}).`);
    pieces = validatePieces(await response.json());
    logs = readLogs();
    pauseFromDay = readPause();
    todayDay = localToday();
    startDay = todayDay - INITIAL_PAST_DAYS;
    endDay = todayDay + FUTURE_DAYS;
    render(todayDay);
    $("goToday").addEventListener("click", () => { refreshDate(); scrollToDay(todayDay); });
    $("pauseBtn").addEventListener("click", togglePause);
    $("exportBtn").addEventListener("click", exportBackup);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", async event => { if (event.target.files[0]) await importBackup(event.target.files[0]); event.target.value = ""; });
    $("viewport").addEventListener("scroll", () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if ($("viewport").scrollLeft > 130 || startDay <= -719162) return;
        const leftBefore = $("viewport").scrollLeft;
        const anchor = startDay;
        startDay = Math.max(-719162, startDay - CHUNK_DAYS);
        render();
        const cell = [...$("head").querySelectorAll("[data-day]")].find(el => Number(el.dataset.day) === anchor);
        $("viewport").scrollLeft = cell ? cell.offsetLeft - $("head").querySelector(".headpiece").offsetWidth + leftBefore : leftBefore;
      }, 100);
    }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshDate(); });
    setInterval(refreshDate, 60000);
    if (!pieces.length) notice("Die Stückliste ist noch leer. Ergänze stuecke.json.");
  } catch (err) { notice(`App konnte nicht gestartet werden: ${err.message}`); }
}
init();