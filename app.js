"use strict";
const KEY = "klavier-uebeplan-v1";
const DAY_MS = 86400000;
const INITIAL_PAST_DAYS = 21;
const FUTURE_DAYS = 7;
const CHUNK_DAYS = 28;
const LOCAL_STORAGE_ERROR = "Speichern auf diesem Gerät ist nicht verfügbar. Bitte Safari nicht im privaten Modus verwenden und Website-Daten erlauben.";
const $ = id => document.getElementById(id);
let pieces = [];
let logs = {};
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
  if (day < first && sessions.every(d => d > day)) return "";
  if (day > actualToday) {
    let next = sessions.length ? sessions.at(-1) + piece.intervallTage : first;
    if (next <= actualToday) next = actualToday + 1;
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
    const done = state === "done";
    const btn = makeCell("button", done ? "✓ Geübt" : state === "late" ? "Überfällig" : state === "due" ? "Fällig" : "Üben");
    btn.type = "button";
    btn.className = `check${state === "due" || state === "late" || done ? " active" : ""}`;
    btn.setAttribute("aria-label", `${piece.titel}: ${done ? "Übung von heute rückgängig machen" : "heute als geübt markieren"}`);
    btn.setAttribute("aria-pressed", String(done));
    btn.addEventListener("click", () => toggleToday(piece.id));
    td.append(btn);
  } else if (state) td.textContent = { due: "Fällig", late: "Überfällig", done: "✓ Geübt", projected: "Geplant" }[state];
  else td.textContent = "·";
  return td;
}
function totalForDay(day) {
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
  head.replaceChildren(); body.replaceChildren();
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
    title.setAttribute("aria-expanded", String(expandedPieceId === piece.id));
    title.setAttribute("aria-label", `${piece.titel}: Details ${expandedPieceId === piece.id ? "schließen" : "anzeigen"}`);
    title.addEventListener("click", event => togglePieceDetails(piece.id, event));
    label.append(title);
    const details = makeCell("small", `${piece.werknummer} · ${piece.tonart} · alle ${piece.intervallTage} Tage${piece.dauerMinuten != null ? ` · ${piece.dauerMinuten} Min.` : ""}`, "piece-details");
    details.hidden = expandedPieceId !== piece.id;
    label.append(details);
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
function toggleToday(id) {
  if (localToday() !== todayDay) { refreshDate(); return; }
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
function refreshDate() {
  const newToday = localToday();
  if (newToday === todayDay) return;
  todayDay = newToday;
  if (endDay < todayDay + FUTURE_DAYS) endDay = todayDay + FUTURE_DAYS;
  render(todayDay);
}
function exportBackup() {
  const payload = { format: "klavier-uebeplan-v1", exportiertAm: new Date().toISOString(), uebungen: logs };
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
    todayDay = localToday();
    startDay = todayDay - INITIAL_PAST_DAYS;
    endDay = todayDay + FUTURE_DAYS;
    render(todayDay);
    $("goToday").addEventListener("click", () => { refreshDate(); scrollToDay(todayDay); });
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