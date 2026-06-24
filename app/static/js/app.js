/* =============================================================
   Budget Planner — App JS
   Handles: sidebar toggle, modal helpers, fetch wrappers,
            page-specific init functions called by each template
   ============================================================= */

"use strict";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function fmt(n, opts = {}) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...opts,
  }).format(n);
}

function fmtPct(n) {
  return n.toFixed(1) + "%";
}

function fmtMonths(n) {
  if (n == null) return "—";
  if (n === 0) return "Paid off!";
  const y = Math.floor(n / 12);
  const m = n % 12;
  if (y === 0) return `${m}mo`;
  if (m === 0) return `${y}yr`;
  return `${y}yr ${m}mo`;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `flash flash-${type}`;
  t.innerHTML = `<i class="fas fa-${type === "success" ? "check-circle" : "exclamation-circle"}"></i> ${msg}`;
  t.style.cssText = "position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;max-width:340px;animation:fadeInUp .25s ease";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// Inject fadeInUp keyframe once
(function injectAnim() {
  const style = document.createElement("style");
  style.textContent = `@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(style);
})();

// ---------------------------------------------------------------------------
// Sidebar toggle (mobile)
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = $(".sidebar");
  const overlay = $(".sidebar-overlay");
  const hamburger = $(".hamburger");

  function openSidebar() {
    sidebar?.classList.add("open");
    overlay?.classList.add("open");
  }
  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("open");
  }

  hamburger?.addEventListener("click", openSidebar);
  overlay?.addEventListener("click", closeSidebar);

  // Close sidebar when a nav link is clicked on mobile
  $$(".nav-link").forEach(l => l.addEventListener("click", () => {
    if (window.innerWidth < 768) closeSidebar();
  }));
});

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------

function openModal(id) {
  const el = document.getElementById(id);
  el?.classList.add("open");
}

function closeModal(id) {
  const el = document.getElementById(id);
  el?.classList.remove("open");
  // Reset form inside if any
  el?.querySelectorAll("form").forEach(f => f.reset());
  // Clear hidden edit-id
  if (el) el.dataset.editId = "";
}

// Close on overlay click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
  }
});

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $$(".modal-overlay.open").forEach(m => m.classList.remove("open"));
  }
});

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

window.initDashboard = async function () {
  try {
    const data = await apiFetch("/api/dashboard");
    renderStatCards(data);
    renderExpensePie(data.expense_by_category);
    renderIncomeExpenseBar(data);
  } catch (err) {
    console.error(err);
  }
};

function renderStatCards(d) {
  function setCard(id, value, extraClass = "") {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
      if (extraClass) el.classList.add(extraClass);
    }
  }

  setCard("stat-income", fmt(d.monthly_income));
  setCard("stat-expenses", fmt(d.monthly_expenses));

  const cfEl = document.getElementById("stat-cashflow");
  if (cfEl) {
    cfEl.textContent = fmt(d.cash_flow);
    cfEl.classList.add(d.cash_flow >= 0 ? "positive" : "negative");
  }

  setCard("stat-savings-rate", fmtPct(d.savings_rate));
  setCard("stat-debt-payments", fmt(d.total_debt_payments));

  const nwEl = document.getElementById("stat-networth");
  if (nwEl) {
    nwEl.textContent = fmt(d.net_worth);
    nwEl.classList.add(d.net_worth >= 0 ? "positive" : "negative");
  }
}

const CATEGORY_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#a855f7", "#e11d48",
];

function renderExpensePie(byCategory) {
  const ctx = document.getElementById("pieChart");
  if (!ctx) return;
  const labels = Object.keys(byCategory);
  const values = Object.values(byCategory);

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CATEGORY_COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: "65%",
      plugins: {
        legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 }, padding: 10 } },
        tooltip: {
          callbacks: {
            label: (c) => ` ${fmt(c.raw)} / mo`,
          },
        },
      },
    },
  });
}

function renderIncomeExpenseBar(d) {
  const ctx = document.getElementById("barChart");
  if (!ctx) return;

  const remaining = Math.max(0, d.cash_flow);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Monthly Budget"],
      datasets: [
        { label: "Expenses", data: [d.monthly_expenses], backgroundColor: "#ef4444", borderRadius: 6 },
        { label: "Remaining", data: [remaining], backgroundColor: "#10b981", borderRadius: 6 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          ticks: { callback: (v) => "$" + v.toLocaleString() },
          grid: { color: "#f1f5f9" },
          max: Math.ceil(d.monthly_income / 1000) * 1000,
        },
      },
      plugins: {
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.raw)}` } },
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
        annotation: {},
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Income page
// ---------------------------------------------------------------------------

window.initIncome = async function () {
  await loadIncome();

  // Open add modal
  $("#btn-add-income")?.addEventListener("click", () => {
    const modal = $("#income-modal");
    if (modal) modal.dataset.editId = "";
    $("#income-modal-title").textContent = "Add Income";
    openModal("income-modal");
  });

  // Form submit
  $("#income-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const modal = $("#income-modal");
    const editId = modal?.dataset.editId;
    const payload = {
      name: $("#income-name").value.trim(),
      amount: parseFloat($("#income-amount").value),
      frequency: $("#income-frequency").value,
    };
    try {
      if (editId) {
        await apiFetch(`/api/income/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Income updated.");
      } else {
        await apiFetch("/api/income", { method: "POST", body: JSON.stringify(payload) });
        showToast("Income added.");
      }
      closeModal("income-modal");
      await loadIncome();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
};

async function loadIncome() {
  const data = await apiFetch("/api/income");
  const tbody = $("#income-tbody");
  const totalEl = $("#income-total");

  if (totalEl) totalEl.textContent = fmt(data.monthly_total);

  if (!tbody) return;
  if (data.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-money-bill-wave"></i><p>No income sources yet. Add one above.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.items.map(item => `
    <tr>
      <td class="fw-700">${escHtml(item.name)}</td>
      <td class="amount">${fmt(item.amount)}</td>
      <td><span class="chip">${item.frequency}</span></td>
      <td class="amount positive-amount">${fmt(item.monthly_amount)}<span class="text-muted text-sm">/mo</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="editIncome(${item.id})" title="Edit">
            <i class="fas fa-pencil"></i>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteIncome(${item.id})" title="Delete" style="color:var(--danger)">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

window.editIncome = async function (id) {
  const data = await apiFetch("/api/income");
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  const modal = $("#income-modal");
  modal.dataset.editId = id;
  $("#income-modal-title").textContent = "Edit Income";
  $("#income-name").value = item.name;
  $("#income-amount").value = item.amount;
  $("#income-frequency").value = item.frequency;
  openModal("income-modal");
};

window.deleteIncome = async function (id) {
  if (!confirm("Delete this income source?")) return;
  await apiFetch(`/api/income/${id}`, { method: "DELETE" });
  showToast("Income deleted.");
  await loadIncome();
};

// ---------------------------------------------------------------------------
// Expenses page
// ---------------------------------------------------------------------------

window.initExpenses = async function () {
  await loadExpenses();

  $("#btn-add-expense")?.addEventListener("click", () => {
    const modal = $("#expense-modal");
    if (modal) modal.dataset.editId = "";
    $("#expense-modal-title").textContent = "Add Expense";
    openModal("expense-modal");
  });

  $("#expense-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const modal = $("#expense-modal");
    const editId = modal?.dataset.editId;
    const payload = {
      name: $("#expense-name").value.trim(),
      amount: parseFloat($("#expense-amount").value),
      category: $("#expense-category").value,
      frequency: $("#expense-frequency").value,
    };
    try {
      if (editId) {
        await apiFetch(`/api/expenses/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Expense updated.");
      } else {
        await apiFetch("/api/expenses", { method: "POST", body: JSON.stringify(payload) });
        showToast("Expense added.");
      }
      closeModal("expense-modal");
      await loadExpenses();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
};

async function loadExpenses() {
  const data = await apiFetch("/api/expenses");
  const tbody = $("#expense-tbody");
  const totalEl = $("#expense-total");

  if (totalEl) totalEl.textContent = fmt(data.monthly_total);

  if (!tbody) return;
  if (data.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-receipt"></i><p>No expenses yet. Add one!</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.items.map(item => `
    <tr>
      <td class="fw-700">${escHtml(item.name)}</td>
      <td><span class="badge badge-neutral">${escHtml(item.category)}</span></td>
      <td class="amount">${fmt(item.amount)}</td>
      <td><span class="chip">${item.frequency}</span></td>
      <td class="amount negative-amount">${fmt(item.monthly_amount)}<span class="text-muted text-sm">/mo</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="editExpense(${item.id})" title="Edit">
            <i class="fas fa-pencil"></i>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteExpense(${item.id})" title="Delete" style="color:var(--danger)">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

window.editExpense = async function (id) {
  const data = await apiFetch("/api/expenses");
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  const modal = $("#expense-modal");
  modal.dataset.editId = id;
  $("#expense-modal-title").textContent = "Edit Expense";
  $("#expense-name").value = item.name;
  $("#expense-amount").value = item.amount;
  $("#expense-category").value = item.category;
  $("#expense-frequency").value = item.frequency;
  openModal("expense-modal");
};

window.deleteExpense = async function (id) {
  if (!confirm("Delete this expense?")) return;
  await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
  showToast("Expense deleted.");
  await loadExpenses();
};

// ---------------------------------------------------------------------------
// Savings page
// ---------------------------------------------------------------------------

window.initSavings = async function () {
  await loadSavings();

  $("#btn-add-savings")?.addEventListener("click", () => {
    const modal = $("#savings-modal");
    if (modal) modal.dataset.editId = "";
    $("#savings-modal-title").textContent = "Add Savings Goal";
    openModal("savings-modal");
  });

  $("#savings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const modal = $("#savings-modal");
    const editId = modal?.dataset.editId;
    const payload = {
      name: $("#savings-name").value.trim(),
      current_amount: parseFloat($("#savings-current").value || 0),
      goal_amount: parseFloat($("#savings-goal").value),
      monthly_contribution: parseFloat($("#savings-contrib").value || 0),
      notes: $("#savings-notes").value.trim(),
    };
    try {
      if (editId) {
        await apiFetch(`/api/savings/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Goal updated.");
      } else {
        await apiFetch("/api/savings", { method: "POST", body: JSON.stringify(payload) });
        showToast("Goal added.");
      }
      closeModal("savings-modal");
      await loadSavings();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
};

async function loadSavings() {
  const data = await apiFetch("/api/savings");
  const container = $("#savings-grid");
  if (!container) return;

  if (data.items.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-piggy-bank"></i><p>No savings goals yet.</p></div>`;
    return;
  }

  container.innerHTML = data.items.map(g => {
    const barClass = g.progress_pct >= 100 ? "success" : g.progress_pct >= 75 ? "primary" : "";
    const months = g.months_remaining;
    const etaStr = months === 0
      ? `<span style="color:var(--success);font-weight:700"><i class="fas fa-check-circle"></i> Goal reached!</span>`
      : months == null
        ? `<span class="text-muted">Set a contribution to estimate</span>`
        : `<i class="fas fa-calendar"></i> Est. ${fmtDate(addMonths(new Date(), months))} (${fmtMonths(months)})`;

    return `
      <div class="goal-card">
        <div class="goal-card-header">
          <div>
            <div class="goal-name">${escHtml(g.name)}</div>
            <div class="goal-meta">${fmt(g.monthly_contribution)}/mo contribution</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="editSavings(${g.id})"><i class="fas fa-pencil"></i></button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteSavings(${g.id})" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="goal-amounts">
          <div>
            <div class="goal-current">${fmt(g.current_amount)}</div>
            <div class="text-sm text-muted">saved so far</div>
          </div>
          <div class="goal-target">
            <div class="fw-700">${fmt(g.goal_amount)}</div>
            <div>goal</div>
            <div class="goal-pct">${g.progress_pct}%</div>
          </div>
        </div>
        <div class="progress-bar-wrap mb-2">
          <div class="progress-bar ${barClass}" style="width:${g.progress_pct}%"></div>
        </div>
        <div class="text-sm">${etaStr}</div>
        ${g.notes ? `<div class="text-sm text-muted mt-1"><i class="fas fa-sticky-note"></i> ${escHtml(g.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

window.editSavings = async function (id) {
  const data = await apiFetch("/api/savings");
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  const modal = $("#savings-modal");
  modal.dataset.editId = id;
  $("#savings-modal-title").textContent = "Edit Savings Goal";
  $("#savings-name").value = item.name;
  $("#savings-current").value = item.current_amount;
  $("#savings-goal").value = item.goal_amount;
  $("#savings-contrib").value = item.monthly_contribution;
  $("#savings-notes").value = item.notes;
  openModal("savings-modal");
};

window.deleteSavings = async function (id) {
  if (!confirm("Delete this savings goal?")) return;
  await apiFetch(`/api/savings/${id}`, { method: "DELETE" });
  showToast("Savings goal deleted.");
  await loadSavings();
};

// ---------------------------------------------------------------------------
// Debt page
// ---------------------------------------------------------------------------

window.initDebt = async function () {
  await loadDebt();

  $("#btn-add-debt")?.addEventListener("click", () => {
    const modal = $("#debt-modal");
    if (modal) modal.dataset.editId = "";
    $("#debt-modal-title").textContent = "Add Debt";
    openModal("debt-modal");
  });

  $("#debt-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const modal = $("#debt-modal");
    const editId = modal?.dataset.editId;
    const payload = {
      name: $("#debt-name").value.trim(),
      balance: parseFloat($("#debt-balance").value),
      interest_rate: parseFloat($("#debt-rate").value || 0),
      minimum_payment: parseFloat($("#debt-min").value),
      extra_payment: parseFloat($("#debt-extra").value || 0),
    };
    try {
      if (editId) {
        await apiFetch(`/api/debt/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Debt updated.");
      } else {
        await apiFetch("/api/debt", { method: "POST", body: JSON.stringify(payload) });
        showToast("Debt added.");
      }
      closeModal("debt-modal");
      await loadDebt();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
};

async function loadDebt() {
  const data = await apiFetch("/api/debt");
  const container = $("#debt-grid");
  const totalBalEl = $("#debt-total-balance");
  const totalPayEl = $("#debt-total-payment");

  if (totalBalEl) totalBalEl.textContent = fmt(data.total_balance);
  if (totalPayEl) totalPayEl.textContent = fmt(data.total_payment);

  if (!container) return;
  if (data.items.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-hand-holding-usd"></i><p>No debts tracked. Add one to see payoff timelines.</p></div>`;
    return;
  }

  container.innerHTML = data.items.map(d => {
    const pct = Math.min(100, 100); // can't compute without original balance, show 100% for now
    const payoffStr = fmtMonths(d.payoff_months);
    const payoffDate = d.payoff_months ? fmtDate(addMonths(new Date(), d.payoff_months)) : null;

    return `
      <div class="debt-card">
        <div class="debt-card-header">
          <div>
            <div class="debt-name">${escHtml(d.name)}</div>
            <div class="debt-meta">${d.interest_rate}% APR</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="editDebt(${d.id})"><i class="fas fa-pencil"></i></button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteDebt(${d.id})" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="debt-amounts">
          <div class="debt-amount-item">
            <div class="debt-amount-label">Balance</div>
            <div class="debt-amount-value" style="color:var(--danger)">${fmt(d.balance)}</div>
          </div>
          <div class="debt-amount-item">
            <div class="debt-amount-label">Min Payment</div>
            <div class="debt-amount-value">${fmt(d.minimum_payment)}</div>
          </div>
          <div class="debt-amount-item">
            <div class="debt-amount-label">Extra Payment</div>
            <div class="debt-amount-value" style="color:var(--success)">${fmt(d.extra_payment)}</div>
          </div>
          <div class="debt-amount-item">
            <div class="debt-amount-label">Total / Mo</div>
            <div class="debt-amount-value">${fmt(d.total_payment)}</div>
          </div>
        </div>
        <div class="debt-payoff-banner">
          <i class="fas fa-flag-checkered"></i>
          ${d.payoff_months === 0 ? "Paid off!" : payoffDate ? `Payoff: ${payoffDate} (${payoffStr})` : "Increase payment to pay off"}
        </div>
      </div>
    `;
  }).join("");
}

window.editDebt = async function (id) {
  const data = await apiFetch("/api/debt");
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  const modal = $("#debt-modal");
  modal.dataset.editId = id;
  $("#debt-modal-title").textContent = "Edit Debt";
  $("#debt-name").value = item.name;
  $("#debt-balance").value = item.balance;
  $("#debt-rate").value = item.interest_rate;
  $("#debt-min").value = item.minimum_payment;
  $("#debt-extra").value = item.extra_payment;
  openModal("debt-modal");
};

window.deleteDebt = async function (id) {
  if (!confirm("Delete this debt?")) return;
  await apiFetch(`/api/debt/${id}`, { method: "DELETE" });
  showToast("Debt removed.");
  await loadDebt();
};

// ---------------------------------------------------------------------------
// Allocation page
// ---------------------------------------------------------------------------

window.initAllocation = async function () {
  await loadAllocation();

  // Save all button
  $("#btn-save-alloc")?.addEventListener("click", async () => {
    const rows = $$(".alloc-row[data-id]");
    try {
      await Promise.all(rows.map(row => {
        const id = row.dataset.id;
        const amount = parseFloat(row.querySelector(".alloc-amount-input")?.value || 0);
        return apiFetch(`/api/allocation/${id}`, { method: "PUT", body: JSON.stringify({ amount }) });
      }));
      showToast("Allocations saved.");
      await loadAllocation();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Add category
  $("#btn-add-alloc-cat")?.addEventListener("click", async () => {
    const name = prompt("New allocation category name:");
    if (!name) return;
    try {
      await apiFetch("/api/allocation/category", { method: "POST", body: JSON.stringify({ category: name }) });
      showToast("Category added.");
      await loadAllocation();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
};

async function loadAllocation() {
  const data = await apiFetch("/api/allocation");
  renderAllocList(data);
  renderAllocBar(data);
}

function renderAllocList(data) {
  const container = $("#alloc-rows");
  if (!container) return;

  container.innerHTML = data.items.map(a => `
    <div class="alloc-row" data-id="${a.id}">
      <div class="alloc-label"><i class="fas fa-circle" style="font-size:.5rem;color:var(--primary);margin-right:.4rem"></i>${escHtml(a.category)}</div>
      <input type="number" class="form-control alloc-amount-input" value="${a.amount}" min="0" step="50" onchange="updateAllocBar()">
      <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteAllocCat(${a.id})" title="Remove" style="color:var(--danger)">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join("");

  // Store income on container for bar updates
  container.dataset.income = data.monthly_income;
}

function renderAllocBar(data) {
  const fill = $("#alloc-bar-fill");
  const label = $("#alloc-bar-label");
  const remaining = $("#alloc-remaining");
  const incomeEl = $("#alloc-income");

  if (incomeEl) incomeEl.textContent = fmt(data.monthly_income);

  const pct = data.monthly_income > 0 ? (data.total_allocated / data.monthly_income) * 100 : 0;
  if (fill) {
    fill.style.width = Math.min(pct, 100) + "%";
    fill.classList.toggle("over", pct > 100);
  }
  if (label) label.textContent = `${Math.min(pct, 100).toFixed(0)}% allocated`;
  if (remaining) {
    remaining.textContent = fmt(Math.abs(data.remaining));
    remaining.style.color = data.remaining >= 0 ? "var(--success)" : "var(--danger)";
    const sign = data.remaining >= 0 ? "+" : "-";
    const prefix = document.getElementById("alloc-remaining-prefix");
    if (prefix) prefix.textContent = data.remaining >= 0 ? "Under budget by" : "Over budget by";
  }
}

window.updateAllocBar = function () {
  const container = $("#alloc-rows");
  const income = parseFloat(container?.dataset.income || 0);
  const total = $$(".alloc-amount-input").reduce((s, inp) => s + parseFloat(inp.value || 0), 0);
  const pct = income > 0 ? (total / income) * 100 : 0;

  const fill = $("#alloc-bar-fill");
  const remaining = $("#alloc-remaining");
  const prefix = $("#alloc-remaining-prefix");
  const label = $("#alloc-bar-label");

  if (fill) {
    fill.style.width = Math.min(pct, 100) + "%";
    fill.classList.toggle("over", pct > 100);
  }
  if (label) label.textContent = `${Math.min(pct, 100).toFixed(0)}% allocated`;
  if (remaining) {
    const diff = income - total;
    remaining.textContent = fmt(Math.abs(diff));
    remaining.style.color = diff >= 0 ? "var(--success)" : "var(--danger)";
    if (prefix) prefix.textContent = diff >= 0 ? "Under budget by" : "Over budget by";
  }
};

window.deleteAllocCat = async function (id) {
  if (!confirm("Remove this allocation category?")) return;
  await apiFetch(`/api/allocation/${id}`, { method: "DELETE" });
  showToast("Category removed.");
  await loadAllocation();
};

// ---------------------------------------------------------------------------
// Scenarios page
// ---------------------------------------------------------------------------

window.initScenarios = async function () {
  const baseline = await apiFetch("/api/scenarios/baseline");

  // Seed input fields with baseline
  const fields = {
    "sc-income": baseline.monthly_income,
    "sc-expenses": baseline.monthly_expenses,
    "sc-savings": baseline.current_savings,
    "sc-debt": baseline.total_debt,
    "sc-extra-savings": 0,
    "sc-extra-invest": 0,
    "sc-extra-debt": 0,
  };

  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  // Recompute whenever any input changes
  $$(".sc-input").forEach(el => el.addEventListener("input", () => runScenario(baseline)));

  runScenario(baseline);
};

function runScenario(baseline) {
  const get = (id) => parseFloat(document.getElementById(id)?.value || 0);

  const income = get("sc-income");
  const expenses = get("sc-expenses");
  const currentSavings = get("sc-savings");
  const totalDebt = get("sc-debt");
  const extraSavings = get("sc-extra-savings");
  const extraInvest = get("sc-extra-invest");
  const extraDebt = get("sc-extra-debt");

  // Baseline scenario
  const baseCashFlow = income - expenses;

  // Scenario: cash flow after adjustments
  const scenarioCashFlow = baseCashFlow - extraSavings - extraInvest - extraDebt;

  // Projection over 12 months
  const months = 60; // 5 years
  const baseProjection = [];
  const scProjection = [];

  let baseSav = currentSavings;
  let scSav = currentSavings;
  let baseDebt = totalDebt;
  let scDebt = totalDebt;

  for (let i = 0; i <= months; i++) {
    baseProjection.push({ month: i, savings: baseSav, debt: baseDebt });
    scProjection.push({ month: i, savings: scSav, debt: scDebt });
    baseSav += Math.max(0, baseCashFlow * 0.5); // assume 50% of cashflow goes to savings
    scSav += extraSavings + extraInvest + Math.max(0, scenarioCashFlow * 0.5);
    baseDebt = Math.max(0, baseDebt * 1.003 - baseline.extra_debt_payments - 350); // approximate
    scDebt = Math.max(0, scDebt * 1.003 - baseline.extra_debt_payments - 350 - extraDebt);
  }

  // Update result cards
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setEl("sc-res-base-cf", fmt(baseCashFlow));
  setEl("sc-res-scen-cf", fmt(scenarioCashFlow));
  const cfDiff = scenarioCashFlow - baseCashFlow;
  const cfDiffEl = document.getElementById("sc-res-cf-diff");
  if (cfDiffEl) {
    cfDiffEl.textContent = (cfDiff >= 0 ? "+" : "") + fmt(cfDiff);
    cfDiffEl.style.color = cfDiff >= 0 ? "var(--success)" : "var(--danger)";
  }

  const baseSav12 = baseProjection[12].savings;
  const scSav12 = scProjection[12].savings;
  setEl("sc-res-base-sav12", fmt(baseSav12));
  setEl("sc-res-scen-sav12", fmt(scSav12));
  const savDiff = scSav12 - baseSav12;
  const savDiffEl = document.getElementById("sc-res-sav-diff");
  if (savDiffEl) {
    savDiffEl.textContent = (savDiff >= 0 ? "+" : "") + fmt(savDiff);
    savDiffEl.style.color = savDiff >= 0 ? "var(--success)" : "var(--danger)";
  }

  const baseDebt12 = baseProjection[12].debt;
  const scDebt12 = scProjection[12].debt;
  setEl("sc-res-base-debt12", fmt(baseDebt12));
  setEl("sc-res-scen-debt12", fmt(scDebt12));
  const debtDiff = scDebt12 - baseDebt12;
  const debtDiffEl = document.getElementById("sc-res-debt-diff");
  if (debtDiffEl) {
    debtDiffEl.textContent = fmt(Math.abs(debtDiff)) + (debtDiff < 0 ? " less" : " more");
    debtDiffEl.style.color = debtDiff <= 0 ? "var(--success)" : "var(--danger)";
  }

  // Render projection chart
  renderScenarioChart(baseProjection, scProjection);
}

let scenarioChart = null;

function renderScenarioChart(base, scenario) {
  const ctx = document.getElementById("scenario-chart");
  if (!ctx) return;

  const labels = base.map(p => p.month === 0 ? "Now" : `Mo ${p.month}`).filter((_, i) => i % 6 === 0);
  const baseData = base.filter((_, i) => i % 6 === 0).map(p => Math.round(p.savings));
  const scData = scenario.filter((_, i) => i % 6 === 0).map(p => Math.round(p.savings));

  if (scenarioChart) scenarioChart.destroy();

  scenarioChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Baseline Savings",
          data: baseData,
          borderColor: "#94a3b8",
          backgroundColor: "rgba(148,163,184,.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Scenario Savings",
          data: scData,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,.12)",
          tension: 0.4,
          fill: true,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: { callback: v => "$" + (v / 1000).toFixed(0) + "k" },
          grid: { color: "#f1f5f9" },
        },
        x: { grid: { display: false } },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.raw)}` } },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Security: escape HTML
// ---------------------------------------------------------------------------

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
