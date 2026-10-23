
const STORAGE_KEY = "ledger.transactions.v1";

let transactions = [];
let editingId = null;

// ---------- DOM refs ----------
const form = document.getElementById("txForm");
const txIdField = document.getElementById("txId");
const descriptionField = document.getElementById("description");
const amountField = document.getElementById("amount");
const dateField = document.getElementById("date");
const typeField = document.getElementById("type");
const categoryField = document.getElementById("category");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const txBody = document.getElementById("txBody");
const listEmpty = document.getElementById("listEmpty");
const entryCount = document.getElementById("entryCount");

const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const totalCountEl = document.getElementById("totalCount");
const balanceAmountEl = document.getElementById("balanceAmount");
const balanceLabelEl = document.getElementById("balanceLabel");
const balanceStampRing = document.querySelector(".stamp__ring");

const breakdownEl = document.getElementById("breakdown");
const breakdownEmpty = document.getElementById("breakdownEmpty");

const filterType = document.getElementById("filterType");
const filterCategory = document.getElementById("filterCategory");
const filterSearch = document.getElementById("filterSearch");


function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Could not read saved data, starting fresh.", e);
    transactions = [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error("Could not save data.", e);
  }
}

// ---------- Helpers ----------
function formatCurrency(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${Math.abs(value).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function resetForm() {
  form.reset();
  txIdField.value = "";
  editingId = null;
  dateField.valueAsDate = new Date();
  submitBtn.textContent = "Add entry";
  cancelEditBtn.hidden = true;
  formError.textContent = "";
}

// ---------- Validation ----------
function validate({ description, amount }) {
  if (!description.trim()) return "Please enter a description.";
  if (isNaN(amount) || amount <= 0) return "Amount must be a positive number.";
  return "";
}

// ---------- CRUD ----------
function addOrUpdateTransaction(data) {
  if (editingId !== null) {
    const idx = transactions.findIndex(t => t.id === editingId);
    if (idx !== -1) transactions[idx] = { ...transactions[idx], ...data };
  } else {
    transactions.push({ id: Date.now(), ...data });
  }
  saveTransactions();
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

function startEdit(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  editingId = id;
  txIdField.value = id;
  descriptionField.value = tx.description;
  amountField.value = tx.amount;
  dateField.value = tx.date;
  typeField.value = tx.type;
  categoryField.value = tx.category;
  submitBtn.textContent = "Save changes";
  cancelEditBtn.hidden = false;
  descriptionField.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Rendering ----------
function getFilteredTransactions() {
  const type = filterType.value;
  const category = filterCategory.value;
  const search = filterSearch.value.trim().toLowerCase();

  return transactions
    .filter(t => type === "all" || t.type === type)
    .filter(t => category === "all" || t.category === category)
    .filter(t => !search || t.description.toLowerCase().includes(search))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function renderCategoryOptions() {
  const current = filterCategory.value;
  const categories = [...new Set(transactions.map(t => t.category))].sort();
  filterCategory.innerHTML = '<option value="all">All categories</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (categories.includes(current)) filterCategory.value = current;
}

function renderTable() {
  const list = getFilteredTransactions();
  txBody.innerHTML = "";

  listEmpty.hidden = transactions.length !== 0;

  if (list.length === 0 && transactions.length > 0) {
    txBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--ink-soft);padding:18px 0;">No entries match your filters.</td></tr>`;
  }

  list.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(t.date)}</td>
      <td>${escapeHtml(t.description)}</td>
      <td><span class="pill">${escapeHtml(t.category)}</span></td>
      <td class="cell-amount ${t.type}">${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount).replace("-", "")}</td>
      <td class="cell-actions">
        <button class="icon-btn" data-action="edit" data-id="${t.id}">Edit</button>
        <button class="icon-btn danger" data-action="delete" data-id="${t.id}">Delete</button>
      </td>
    `;
    txBody.appendChild(tr);
  });

  entryCount.textContent = transactions.length;
}

function renderTotals() {
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  totalIncomeEl.textContent = formatCurrency(income);
  totalExpenseEl.textContent = formatCurrency(expense);
  totalCountEl.textContent = transactions.length;

  balanceAmountEl.textContent = formatCurrency(balance);
  balanceLabelEl.textContent = balance < 0 ? "DEFICIT" : "BALANCE";
  balanceStampRing.classList.toggle("is-negative", balance < 0);
}

function renderBreakdown() {
  const expenseTx = transactions.filter(t => t.type === "expense");
  const totals = {};
  expenseTx.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? entries[0][1] : 0;

  breakdownEmpty.hidden = entries.length !== 0;
  breakdownEl.innerHTML = entries.map(([cat, amt]) => `
    <div class="breakdown__row">
      <span class="breakdown__label">${escapeHtml(cat)}</span>
      <span class="breakdown__bar-track">
        <span class="breakdown__bar-fill" style="width:${max ? (amt / max) * 100 : 0}%"></span>
      </span>
      <span class="breakdown__value">${formatCurrency(amt)}</span>
    </div>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderAll() {
  renderCategoryOptions();
  renderTable();
  renderTotals();
  renderBreakdown();
}

// ---------- Events ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = {
    description: descriptionField.value.trim(),
    amount: parseFloat(amountField.value),
    type: typeField.value,
    category: categoryField.value,
    date: dateField.value || new Date().toISOString().slice(0, 10),
  };

  const errorMsg = validate(data);
  if (errorMsg) {
    formError.textContent = errorMsg;
    return;
  }

  formError.textContent = "";
  addOrUpdateTransaction(data);
  resetForm();
});

cancelEditBtn.addEventListener("click", resetForm);

txBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);

  if (btn.dataset.action === "edit") {
    startEdit(id);
  } else if (btn.dataset.action === "delete") {
    if (confirm("Delete this entry? This can't be undone.")) {
      deleteTransaction(id);
    }
  }
});

[filterType, filterCategory, filterSearch].forEach(el => {
  el.addEventListener("input", renderTable);
});

// ---------- Init ----------
loadTransactions();
resetForm();
renderAll();