const STORAGE_KEY = "finance-tracker-data-v1";
const PAYDAY_DOM = 25;

/** @typedef {{id:string, type:"wage"|"expense", date:string, description:string, category?:string, amount:number}} Transaction */

/** @returns {Transaction[]} */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** @param {Transaction[]} transactions */
function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

let transactions = loadTransactions();

const periodLabel = document.getElementById("periodLabel");
const prevPeriodBtn = document.getElementById("prevMonth");
const nextPeriodBtn = document.getElementById("nextMonth");
const wageForm = document.getElementById("wageForm");
const expenseForm = document.getElementById("expenseForm");
const tabBtns = document.querySelectorAll(".tab-btn");
const txList = document.getElementById("txList");
const txCount = document.getElementById("txCount");
const categoryChart = document.getElementById("categoryChart");

function todayISO() {
  return toISODate(new Date());
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function normalizeYM(year, month) {
  const d = new Date(year, month, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Easter Sunday (Gregorian, Meeus/Jones/Butcher algorithm). */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/** Swedish public holidays ("röda dagar") that can fall on a weekday near the 25th. */
function swedishHolidays(year) {
  const dates = [
    new Date(year, 0, 1), // Nyårsdagen
    new Date(year, 0, 6), // Trettondedag jul
    new Date(year, 4, 1), // Första maj
    new Date(year, 5, 6), // Sveriges nationaldag
    new Date(year, 11, 25), // Juldagen
    new Date(year, 11, 26), // Annandag jul
  ];
  const easter = easterSunday(year);
  dates.push(addDays(easter, -2)); // Långfredagen
  dates.push(easter); // Påskdagen
  dates.push(addDays(easter, 1)); // Annandag påsk
  dates.push(addDays(easter, 39)); // Kristi himmelsfärdsdag
  dates.push(addDays(easter, 49)); // Pingstdagen
  return dates;
}

function isBusinessDay(date, holidays) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !holidays.some((h) => toISODate(h) === toISODate(date));
}

/** Nearest weekday that isn't a weekend or a public holiday; ties go to the earlier day. */
function nearestBusinessDay(date, holidays) {
  if (isBusinessDay(date, holidays)) return date;
  for (let offset = 1; offset <= 7; offset++) {
    const back = addDays(date, -offset);
    const fwd = addDays(date, offset);
    if (isBusinessDay(back, holidays)) return back;
    if (isBusinessDay(fwd, holidays)) return fwd;
  }
  return date;
}

/** The actual payday (25th, or nearest weekday around it) for a given year/month. */
function getPayday(year, month) {
  const { year: y, month: m } = normalizeYM(year, month);
  const base = new Date(y, m, PAYDAY_DOM);
  return nearestBusinessDay(base, swedishHolidays(y));
}

/** The {year, month} whose payday starts the pay period containing dateStr. */
function periodAnchorForDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const payday = getPayday(y, m - 1);
  if (date >= payday) return { year: y, month: m - 1 };
  return normalizeYM(y, m - 2);
}

function periodBounds(anchor) {
  const start = getPayday(anchor.year, anchor.month);
  const next = normalizeYM(anchor.year, anchor.month + 1);
  const end = addDays(getPayday(next.year, next.month), -1);
  return { start, end, startISO: toISODate(start), endISO: toISODate(end) };
}

function formatPeriodLabel(start, end) {
  const startStr = start.toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
  const endStr = end.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

let currentAnchor = periodAnchorForDate(todayISO());

function renderPeriodLabel() {
  const { start, end } = periodBounds(currentAnchor);
  periodLabel.textContent = formatPeriodLabel(start, end);
}

function formatMoney(value) {
  return value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
  });
}

const CATEGORY_LABELS = {
  Housing: "Boende",
  Groceries: "Livsmedel",
  Transport: "Transport",
  Utilities: "Räkningar",
  Health: "Hälsa",
  Savings: "Sparande",
  Entertainment: "Nöje",
  Subscriptions: "Prenumerationer",
  Other: "Övrigt",
};

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function txKind(t) {
  if (t.type === "wage") return "income";
  if (t.category === "Savings") return "savings";
  return "expense";
}

function transactionsInCurrentPeriod() {
  const { startISO, endISO } = periodBounds(currentAnchor);
  return transactions.filter((t) => t.date >= startISO && t.date <= endISO);
}

function init() {
  wageForm.querySelector('input[name="date"]').value = todayISO();
  expenseForm.querySelector('input[name="date"]').value = todayISO();
  renderPeriodLabel();
  renderAll();
}

function renderAll() {
  renderSummary();
  renderTransactionList();
  renderCategoryChart();
}

function renderSummary() {
  const periodTx = transactionsInCurrentPeriod();

  const income = periodTx.filter((t) => t.type === "wage").reduce((s, t) => s + t.amount, 0);
  const expense = periodTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const totalIncome = transactions.filter((t) => t.type === "wage").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalBalance = totalIncome - totalExpense;

  document.getElementById("sumIncome").textContent = formatMoney(income);
  document.getElementById("sumExpense").textContent = formatMoney(expense);
  document.getElementById("sumBalance").textContent = formatMoney(balance);
  document.getElementById("sumTotal").textContent = formatMoney(totalBalance);
}

function renderTransactionList() {
  const periodTx = transactionsInCurrentPeriod().sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  );

  txCount.textContent = `${periodTx.length} ${periodTx.length === 1 ? "post" : "poster"}`;

  if (periodTx.length === 0) {
    txList.innerHTML = `<li class="empty-hint">Inga transaktioner denna period än.</li>`;
    return;
  }

  txList.innerHTML = periodTx
    .map((t) => {
      const kind = txKind(t);
      const isIncome = kind === "income";
      const sign = isIncome ? "+" : "-";
      const tag = isIncome ? "Lön" : categoryLabel(t.category) || "Utgift";
      return `
        <li class="tx-item ${kind}">
          <span class="tx-date">${t.date}</span>
          <span class="tx-desc">
            <span class="tx-title">${escapeHtml(t.description)}</span>
            <span class="tx-tag">${escapeHtml(tag)}</span>
          </span>
          <span class="tx-amount ${kind}">${sign}${formatMoney(t.amount)}</span>
          <button class="tx-delete" data-id="${t.id}" title="Ta bort">&times;</button>
        </li>`;
    })
    .join("");
}

function renderCategoryChart() {
  const expenses = transactionsInCurrentPeriod().filter((t) => t.type === "expense");

  if (expenses.length === 0) {
    categoryChart.innerHTML = `<p class="empty-hint">Inga utgifter registrerade denna period än.</p>`;
    return;
  }

  const totals = {};
  for (const t of expenses) {
    totals[t.category || "Other"] = (totals[t.category || "Other"] || 0) + t.amount;
  }
  const max = Math.max(...Object.values(totals));

  categoryChart.innerHTML = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const pct = max > 0 ? Math.round((amount / max) * 100) : 0;
      const kind = category === "Savings" ? "savings" : "expense";
      return `
        <div class="category-row">
          <span>${escapeHtml(categoryLabel(category))}</span>
          <span class="category-bar-track"><span class="category-bar-fill ${kind}" style="width:${pct}%"></span></span>
          <span>${formatMoney(amount)}</span>
        </div>`;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function addTransaction(type, form) {
  const data = new FormData(form);
  const amount = parseFloat(data.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return;

  const tx = {
    id: crypto.randomUUID(),
    type,
    date: data.get("date"),
    description: data.get("description").trim(),
    amount,
  };
  if (type === "expense") {
    tx.category = data.get("category");
  }

  transactions.push(tx);
  saveTransactions(transactions);

  const dateValue = tx.date;
  form.reset();
  form.querySelector('input[name="date"]').value = dateValue;

  currentAnchor = periodAnchorForDate(tx.date);
  renderPeriodLabel();
  renderAll();
}

wageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTransaction("wage", wageForm);
});

expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTransaction("expense", expenseForm);
});

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    wageForm.classList.toggle("hidden", tab !== "wage");
    expenseForm.classList.toggle("hidden", tab !== "expense");
  });
});

txList.addEventListener("click", (e) => {
  const btn = e.target.closest(".tx-delete");
  if (!btn) return;
  const id = btn.dataset.id;
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions(transactions);
  renderAll();
});

prevPeriodBtn.addEventListener("click", () => {
  currentAnchor = normalizeYM(currentAnchor.year, currentAnchor.month - 1);
  renderPeriodLabel();
  renderAll();
});

nextPeriodBtn.addEventListener("click", () => {
  currentAnchor = normalizeYM(currentAnchor.year, currentAnchor.month + 1);
  renderPeriodLabel();
  renderAll();
});

init();
