const STORAGE_KEY = "finance-tracker-data-v1";

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

const monthSelect = document.getElementById("monthSelect");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const wageForm = document.getElementById("wageForm");
const expenseForm = document.getElementById("expenseForm");
const tabBtns = document.querySelectorAll(".tab-btn");
const txList = document.getElementById("txList");
const txCount = document.getElementById("txCount");
const categoryChart = document.getElementById("categoryChart");

function currentMonthKey() {
  return monthSelect.value;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7);
}

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function init() {
  monthSelect.value = todayISO().slice(0, 7);
  wageForm.querySelector('input[name="date"]').value = todayISO();
  expenseForm.querySelector('input[name="date"]').value = todayISO();
  renderAll();
}

function renderAll() {
  renderSummary();
  renderTransactionList();
  renderCategoryChart();
}

function renderSummary() {
  const monthKey = currentMonthKey();
  const monthTx = transactions.filter((t) => monthKeyOf(t.date) === monthKey);

  const income = monthTx.filter((t) => t.type === "wage").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
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
  const monthKey = currentMonthKey();
  const monthTx = transactions
    .filter((t) => monthKeyOf(t.date) === monthKey)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  txCount.textContent = `${monthTx.length} ${monthTx.length === 1 ? "entry" : "entries"}`;

  if (monthTx.length === 0) {
    txList.innerHTML = `<li class="empty-hint">No transactions for this month yet.</li>`;
    return;
  }

  txList.innerHTML = monthTx
    .map((t) => {
      const isIncome = t.type === "wage";
      const sign = isIncome ? "+" : "-";
      const tag = isIncome ? "Wage" : t.category || "Expense";
      return `
        <li class="tx-item">
          <span class="tx-date">${t.date}</span>
          <span class="tx-desc">
            <span class="tx-title">${escapeHtml(t.description)}</span>
            <span class="tx-tag">${escapeHtml(tag)}</span>
          </span>
          <span class="tx-amount ${isIncome ? "income" : "expense"}">${sign}${formatMoney(t.amount)}</span>
          <button class="tx-delete" data-id="${t.id}" title="Delete">&times;</button>
        </li>`;
    })
    .join("");
}

function renderCategoryChart() {
  const monthKey = currentMonthKey();
  const expenses = transactions.filter((t) => t.type === "expense" && monthKeyOf(t.date) === monthKey);

  if (expenses.length === 0) {
    categoryChart.innerHTML = `<p class="empty-hint">No expenses logged for this month yet.</p>`;
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
      return `
        <div class="category-row">
          <span>${escapeHtml(category)}</span>
          <span class="category-bar-track"><span class="category-bar-fill" style="width:${pct}%"></span></span>
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

  monthSelect.value = monthKeyOf(tx.date);
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

monthSelect.addEventListener("change", renderAll);

prevMonthBtn.addEventListener("click", () => {
  monthSelect.value = shiftMonth(currentMonthKey(), -1);
  renderAll();
});

nextMonthBtn.addEventListener("click", () => {
  monthSelect.value = shiftMonth(currentMonthKey(), 1);
  renderAll();
});

init();
