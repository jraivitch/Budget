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

// ---------------------------------------------------------------------------
// Bill reminder bell (runs on every page)
// ---------------------------------------------------------------------------

(async function initNotifBell() {
  const btn      = document.getElementById("notif-btn");
  const badge    = document.getElementById("notif-badge");
  const dropdown = document.getElementById("notif-dropdown");
  const list     = document.getElementById("notif-list");
  const sub      = document.getElementById("notif-sub");
  if (!btn) return;

  const DAYS_AHEAD = 7;

  async function loadReminders() {
    try {
      const [billData, spendData, limData] = await Promise.all([
        apiFetch("/api/calendar/bills"),
        apiFetch("/api/spending?month=" + new Date().toISOString().slice(0, 7)),
        apiFetch("/api/limits"),
      ]);

      const today = new Date();
      const todayDay = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

      const upcoming = billData.bills.filter(b => {
        const due = Math.min(b.due_day, daysInMonth);
        return due >= todayDay && due <= todayDay + DAYS_AHEAD;
      }).sort((a, b) => a.due_day - b.due_day);

      const overdue = billData.bills.filter(b => {
        const due = Math.min(b.due_day, daysInMonth);
        return due < todayDay;
      }).sort((a, b) => b.due_day - a.due_day);

      // Find categories over or near their limit
      const limitAlerts = limData.limits.map(l => {
        const actual = spendData.by_category[l.category]?.actual || 0;
        const pct = actual / l.monthly_limit * 100;
        if (pct >= 80) return { ...l, actual, pct, over: pct >= 100 };
        return null;
      }).filter(Boolean).sort((a, b) => b.pct - a.pct);

      const total = upcoming.length + overdue.length + limitAlerts.length;

      if (total > 0) {
        badge.textContent = total > 9 ? "9+" : total;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }

      const hasAnything = billData.bills.length || limData.limits.length;
      if (!hasAnything) {
        sub.textContent = "";
        list.innerHTML = `<div class="notif-empty"><i class="fas fa-calendar-check" style="display:block;font-size:1.5rem;margin-bottom:.4rem;color:var(--text-light)"></i>No bills tracked.<br><a href="/calendar" style="color:var(--primary)">Set up Bill Calendar</a></div>`;
        return;
      }

      sub.textContent = `Next ${DAYS_AHEAD} days`;

      let html = "";

      if (limitAlerts.length) {
        html += `<div style="padding:.35rem 1.1rem;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${limitAlerts.some(a=>a.over)?"var(--danger)":"var(--warning)"};background:${limitAlerts.some(a=>a.over)?"var(--danger-light)":"var(--warning-light)"}">Spending limits</div>`;
        html += limitAlerts.map(a => {
          const icon = a.over ? "fa-triangle-exclamation" : "fa-circle-exclamation";
          const color = a.over ? "var(--danger)" : "var(--warning)";
          const label = a.over ? `${fmt(a.actual - a.monthly_limit)} over` : `${a.pct.toFixed(0)}% used`;
          return `<a class="notif-item" href="/spending">
            <div style="width:36px;height:36px;border-radius:8px;background:${a.over?"var(--danger-light)":"var(--warning-light)"};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas ${icon}" style="color:${color};font-size:.85rem"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.82rem">${escHtml(a.category)}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${fmt(a.actual)} of ${fmt(a.monthly_limit)} limit</div>
            </div>
            <span style="color:${color};font-size:.72rem;font-weight:600">${label}</span>
          </a>`;
        }).join("");
      }

      if (overdue.length) {
        html += `<div style="padding:.35rem 1.1rem;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--danger);background:var(--danger-light)">Overdue this month</div>`;
        html += overdue.map(b => billRow(b, "overdue", daysInMonth, todayDay)).join("");
      }

      if (upcoming.length) {
        html += `<div style="padding:.35rem 1.1rem;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--primary);background:var(--primary-light)">Coming up</div>`;
        html += upcoming.map(b => billRow(b, "upcoming", daysInMonth, todayDay)).join("");
      }

      if (!overdue.length && !upcoming.length && !limitAlerts.length) {
        html = `<div class="notif-empty"><i class="fas fa-circle-check" style="display:block;font-size:1.5rem;margin-bottom:.4rem;color:var(--success)"></i>All clear — no bills due or limits exceeded</div>`;
      }

      list.innerHTML = html;
    } catch (e) {
      list.innerHTML = `<div class="notif-empty">Could not load reminders</div>`;
    }
  }

  function billRow(b, type, daysInMonth, todayDay) {
    const due = Math.min(b.due_day, daysInMonth);
    const diff = due - todayDay;
    const isToday = diff === 0;
    const label = type === "overdue"
      ? `<span style="color:var(--danger);font-size:.72rem">${Math.abs(diff)}d ago</span>`
      : isToday
      ? `<span style="color:var(--warning);font-weight:600;font-size:.72rem">Today</span>`
      : `<span style="color:var(--primary);font-size:.72rem">in ${diff}d</span>`;

    return `<a class="notif-item" href="/calendar">
      <div style="width:36px;height:36px;border-radius:8px;background:var(--primary-light);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="fas fa-calendar-day" style="color:var(--primary);font-size:.85rem"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">Due day ${due} · ${fmt(b.monthly_amount)}</div>
      </div>
      ${label}
    </a>`;
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!document.getElementById("notif-wrap")?.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });

  await loadReminders();
})();

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
// Spending / Budget-vs-Actual page
// ---------------------------------------------------------------------------

window.initSpending = async function () {
  const picker = $("#month-picker");
  if (picker) {
    picker.value = new Date().toISOString().slice(0, 7);
  }

  await loadSpending();

  picker?.addEventListener("change", loadSpending);

  // Limits modal
  $("#btn-set-limits")?.addEventListener("click", async () => {
    await loadLimitsList();
    openModal("limits-modal");
  });

  $("#btn-add-limit")?.addEventListener("click", async () => {
    const cat = $("#limit-cat-select")?.value;
    const amt = parseFloat($("#limit-amount-input")?.value);
    if (!cat || !amt || amt <= 0) { showToast("Enter a valid category and amount", "error"); return; }
    try {
      await apiFetch("/api/limits", { method: "POST", body: JSON.stringify({ category: cat, monthly_limit: amt }) });
      $("#limit-amount-input").value = "";
      showToast(`Limit set for ${cat}`);
      await loadLimitsList();
      await loadSpending();
    } catch (err) { showToast(err.message, "error"); }
  });

  $("#btn-add-txn")?.addEventListener("click", () => {
    const modal = $("#txn-modal");
    if (modal) modal.dataset.editId = "";
    $("#txn-modal-title").textContent = "Add Transaction";
    $("#txn-date").value = new Date().toISOString().split("T")[0];
    $("#txn-amount").value = "";
    openModal("txn-modal");
  });

  $("#txn-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const modal = $("#txn-modal");
    const editId = modal?.dataset.editId;
    const payload = {
      date: $("#txn-date").value,
      description: $("#txn-desc").value.trim(),
      amount: parseFloat($("#txn-amount").value),
      category: $("#txn-category").value,
    };
    try {
      if (editId) {
        await apiFetch(`/api/spending/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Transaction updated.");
      } else {
        await apiFetch("/api/spending", { method: "POST", body: JSON.stringify(payload) });
        showToast("Transaction added.");
      }
      closeModal("txn-modal");
      await loadSpending();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
};

async function loadLimitsList() {
  const data = await apiFetch("/api/limits");
  const list = $("#limits-list");
  if (!list) return;
  if (!data.limits.length) {
    list.innerHTML = `<div class="notif-empty" style="padding:1.5rem">No limits set yet. Add one above.</div>`;
    return;
  }
  list.innerHTML = data.limits.map(l => `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 1.25rem;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-weight:600;font-size:.85rem">${escHtml(l.category)}</div>
        <div style="font-size:.78rem;color:var(--text-muted)">${fmt(l.monthly_limit)} / month</div>
      </div>
      <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);font-size:.75rem" onclick="deleteLimit(${l.id})">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join("");
}

window.deleteLimit = async function(id) {
  try {
    await apiFetch(`/api/limits/${id}`, { method: "DELETE" });
    showToast("Limit removed");
    await loadLimitsList();
    await loadSpending();
  } catch (err) { showToast(err.message, "error"); }
};

async function loadSpending() {
  const month = $("#month-picker")?.value;
  const data = await apiFetch(`/api/spending${month ? "?month=" + month : ""}`);

  const statBudgeted = $("#stat-budgeted");
  const statActual = $("#stat-actual");
  const statRemaining = $("#stat-remaining");
  const statPct = $("#stat-pct-used");

  if (statBudgeted) statBudgeted.textContent = fmt(data.total_budgeted);
  if (statActual) statActual.textContent = fmt(data.total_actual);
  if (statRemaining) {
    statRemaining.textContent = fmt(Math.abs(data.total_remaining));
    statRemaining.className = "stat-value " + (data.total_remaining >= 0 ? "positive" : "negative");
  }
  if (statPct) {
    const pct = data.total_budgeted > 0 ? (data.total_actual / data.total_budgeted) * 100 : 0;
    statPct.textContent = fmtPct(pct);
    statPct.className = "stat-value " + (pct > 100 ? "negative" : pct > 80 ? "warning" : "");
  }

  renderCategoryBreakdown(data.by_category, data.limits || {});
  renderTransactions(data.transactions);
}

function renderCategoryBreakdown(byCategory, limits) {
  const container = $("#category-breakdown");
  if (!container) return;

  const entries = Object.entries(byCategory).filter(([, v]) => v.budgeted > 0 || v.actual > 0);

  if (entries.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-chart-bar"></i><p>No budget data. Add expenses on the Expenses page.</p></div>`;
    return;
  }

  container.innerHTML = entries.map(([cat, v]) => {
    const pct = v.budgeted > 0 ? Math.min(100, (v.actual / v.budgeted) * 100) : 0;
    const over = v.actual > v.budgeted && v.budgeted > 0;
    const barClass = over ? "danger" : pct > 80 ? "warning" : "success";
    const diffColor = v.diff >= 0 ? "var(--success)" : "var(--danger)";
    const diffLabel = v.diff >= 0 ? "left" : "over";

    // Spending limit indicator
    let limitHtml = "";
    if (limits[cat]) {
      const lim = limits[cat];
      const limPct = Math.min(100, (v.actual / lim) * 100);
      const limOver = v.actual > lim;
      const limNear = !limOver && limPct >= 80;
      const limColor = limOver ? "var(--danger)" : limNear ? "var(--warning)" : "var(--success)";
      const limBarClass = limOver ? "danger" : limNear ? "warning" : "success";
      const limLabel = limOver
        ? `<span style="color:var(--danger);font-weight:600;font-size:.72rem"><i class="fas fa-triangle-exclamation"></i> ${fmt(v.actual - lim)} over limit</span>`
        : limNear
        ? `<span style="color:var(--warning);font-weight:600;font-size:.72rem"><i class="fas fa-circle-exclamation"></i> Near limit</span>`
        : `<span style="color:var(--text-muted);font-size:.72rem">${fmt(lim - v.actual)} under limit</span>`;

      limitHtml = `
        <div style="margin-top:.5rem;padding:.5rem .6rem;border-radius:6px;background:${limOver ? "var(--danger-light)" : limNear ? "var(--warning-light)" : "var(--bg)"};border:1px solid ${limColor}30">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
            <span style="font-size:.72rem;color:var(--text-muted)">Limit: ${fmt(lim)}</span>
            ${limLabel}
          </div>
          <div class="progress-bar-wrap" style="height:4px">
            <div class="progress-bar ${limBarClass}" style="width:${limPct}%"></div>
          </div>
        </div>`;
    }

    return `
      <div class="bva-row">
        <div class="bva-header">
          <span class="bva-cat">${escHtml(cat)}</span>
          <span class="bva-diff" style="color:${diffColor}">${fmt(Math.abs(v.diff))} ${diffLabel}</span>
        </div>
        <div class="progress-bar-wrap" style="height:6px;margin-bottom:.3rem">
          <div class="progress-bar ${barClass}" style="width:${pct}%"></div>
        </div>
        <div class="bva-amounts">
          <span>${fmt(v.actual)} spent</span>
          <span>${fmt(v.budgeted)} budgeted</span>
        </div>
        ${limitHtml}
      </div>
    `;
  }).join("");
}

function renderTransactions(transactions) {
  const container = $("#txn-list");
  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>No transactions this month yet.</p></div>`;
    return;
  }

  const rows = transactions.map(t => `
    <tr>
      <td class="text-sm text-muted" style="white-space:nowrap">${txnFmtDate(t.date)}</td>
      <td class="fw-700">${escHtml(t.description)}</td>
      <td><span class="badge badge-neutral">${escHtml(t.category)}</span></td>
      <td class="amount negative-amount" style="text-align:right">${fmt(t.amount)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="editTxn(${t.id})" title="Edit">
            <i class="fas fa-pencil"></i>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteTxn(${t.id})" title="Delete" style="color:var(--danger)">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th style="text-align:right">Amount</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function txnFmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

window.editTxn = async function (id) {
  const month = $("#month-picker")?.value;
  const data = await apiFetch(`/api/spending${month ? "?month=" + month : ""}`);
  const item = data.transactions.find(t => t.id === id);
  if (!item) return;
  const modal = $("#txn-modal");
  modal.dataset.editId = id;
  $("#txn-modal-title").textContent = "Edit Transaction";
  $("#txn-date").value = item.date;
  $("#txn-amount").value = item.amount;
  $("#txn-desc").value = item.description;
  $("#txn-category").value = item.category;
  openModal("txn-modal");
};

window.deleteTxn = async function (id) {
  if (!confirm("Delete this transaction?")) return;
  await apiFetch(`/api/spending/${id}`, { method: "DELETE" });
  showToast("Transaction deleted.");
  await loadSpending();
};

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

// ---------------------------------------------------------------------------
// Bill Calendar page
// ---------------------------------------------------------------------------

const CAT_COLORS = {
  Housing: "#6366f1", Car: "#f59e0b", Food: "#10b981", Insurance: "#3b82f6",
  Subscriptions: "#8b5cf6", "Student Loans": "#ef4444", Savings: "#10b981",
  Investing: "#0ea5e9", Utilities: "#f97316", Healthcare: "#ec4899",
  Entertainment: "#a855f7", Personal: "#14b8a6", Other: "#94a3b8",
};

window.initCalendar = async function () {
  let bills = [];
  let allExpenses = [];
  let viewDate = new Date();
  viewDate.setDate(1);

  async function loadBills() {
    const data = await apiFetch("/api/calendar/bills");
    bills = data.bills;
    render();
  }

  async function loadAllExpenses() {
    const data = await apiFetch("/api/calendar/all-expenses");
    allExpenses = data.expenses;
    renderManageList();
  }

  function render() {
    renderStats();
    renderGrid();
    renderList();
  }

  function renderStats() {
    const today = new Date();
    const isCurrentMonth =
      viewDate.getFullYear() === today.getFullYear() &&
      viewDate.getMonth() === today.getMonth();

    const total = bills.reduce((s, b) => s + b.monthly_amount, 0);
    const ahead = isCurrentMonth
      ? bills.filter(b => b.due_day > today.getDate()).reduce((s, b) => s + b.monthly_amount, 0)
      : 0;
    const past = isCurrentMonth
      ? bills.filter(b => b.due_day <= today.getDate()).reduce((s, b) => s + b.monthly_amount, 0)
      : total;

    $("#stat-bill-count").textContent = bills.length;
    $("#stat-bill-total").textContent = fmt(total);
    $("#stat-bill-ahead").textContent = fmt(ahead);
    $("#stat-bill-past").textContent = fmt(past);
  }

  function renderGrid() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const label = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    $("#cal-month-label").textContent = label;

    const today = new Date();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun

    const grid = $("#cal-grid");
    grid.innerHTML = "";

    // Bill lookup: due_day -> bills[]
    const byDay = {};
    bills.forEach(b => {
      const d = Math.min(b.due_day, daysInMonth);
      (byDay[d] = byDay[d] || []).push(b);
    });

    // Leading empty cells
    for (let i = 0; i < firstDow; i++) {
      const cell = document.createElement("div");
      cell.style.cssText = "min-height:90px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:#f8fafc";
      grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day;
      const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const cell = document.createElement("div");
      cell.style.cssText = `min-height:90px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:.35rem .4rem;position:relative;background:${isToday ? "var(--primary-light)" : "var(--surface)"}`;

      const dayNum = document.createElement("div");
      dayNum.style.cssText = `font-size:.78rem;font-weight:${isToday ? "700" : "500"};color:${isToday ? "var(--primary)" : isPast ? "var(--text-muted)" : "var(--text)"};margin-bottom:.3rem`;
      dayNum.textContent = day;
      cell.appendChild(dayNum);

      (byDay[day] || []).forEach(b => {
        const chip = document.createElement("div");
        const color = CAT_COLORS[b.category] || "#94a3b8";
        chip.style.cssText = `background:${color}18;border-left:3px solid ${color};border-radius:4px;padding:.15rem .35rem;margin-bottom:.2rem;cursor:pointer;font-size:.68rem;line-height:1.3`;
        chip.innerHTML = `<div style="font-weight:600;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</div><div style="color:var(--text-muted)">${fmt(b.monthly_amount)}</div>`;
        chip.title = `${b.name} — ${fmt(b.monthly_amount)}/mo — Click to edit due day`;
        chip.addEventListener("click", () => openDueDayModal(b));
        cell.appendChild(chip);
      });

      grid.appendChild(cell);
    }

    // Trailing empty cells to fill last row
    const totalCells = firstDow + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        const cell = document.createElement("div");
        cell.style.cssText = "min-height:90px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:#f8fafc";
        grid.appendChild(cell);
      }
    }
  }

  function renderList() {
    const list = $("#bill-list");
    if (!bills.length) {
      list.innerHTML = `<div class="empty-state" style="padding:2rem;text-align:center">
        <i class="fas fa-calendar-plus" style="font-size:2rem;color:var(--text-light);margin-bottom:.5rem"></i>
        <div style="font-weight:600;margin-bottom:.25rem">No bills tracked yet</div>
        <div class="text-sm text-muted" style="margin-bottom:1rem">Use "Manage Bills" to choose which expenses appear here</div>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-manage-bills').click()"><i class="fas fa-sliders"></i> Manage Bills</button>
      </div>`;
      return;
    }

    const sorted = [...bills].sort((a, b) => a.due_day - b.due_day);
    list.innerHTML = sorted.map(b => {
      const color = CAT_COLORS[b.category] || "#94a3b8";
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const due = Math.min(b.due_day, daysInMonth);
      const diff = due - today.getDate();
      const badge = diff < 0
        ? `<span style="font-size:.65rem;background:var(--success-light);color:var(--success);border-radius:4px;padding:.1rem .4rem">Passed</span>`
        : diff === 0
        ? `<span style="font-size:.65rem;background:var(--warning-light);color:var(--warning);border-radius:4px;padding:.1rem .4rem">Today</span>`
        : `<span style="font-size:.65rem;background:var(--primary-light);color:var(--primary);border-radius:4px;padding:.1rem .4rem">in ${diff}d</span>`;

      return `<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 1rem;border-bottom:1px solid var(--border);cursor:pointer" onclick='openDueDayModal(${JSON.stringify(b)})'>
        <div style="width:4px;height:36px;border-radius:2px;background:${color};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${escHtml(b.category)} · Day ${due}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:600;font-size:.85rem">${fmt(b.monthly_amount)}</div>
          ${badge}
        </div>
      </div>`;
    }).join("");
  }

  function renderManageList() {
    const list = $("#manage-list");
    if (!allExpenses.length) {
      list.innerHTML = `<div class="empty-state" style="padding:2rem">No expenses found. Add some on the Expenses page.</div>`;
      return;
    }

    // Group by category
    const byCategory = {};
    allExpenses.forEach(e => {
      (byCategory[e.category] = byCategory[e.category] || []).push(e);
    });

    list.innerHTML = Object.entries(byCategory).map(([cat, items]) => {
      const color = CAT_COLORS[cat] || "#94a3b8";
      const rows = items.map(e => {
        const checked = e.track_on_calendar;
        return `<div style="display:flex;align-items:center;gap:.75rem;padding:.55rem 1.25rem;border-bottom:1px solid var(--border)">
          <label style="display:flex;align-items:center;gap:.75rem;flex:1;cursor:pointer;min-width:0">
            <input type="checkbox" ${checked ? "checked" : ""}
              style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer;flex-shrink:0"
              onchange="toggleCalendarTracking(${e.id}, this.checked)" />
            <span style="flex:1;min-width:0">
              <span style="font-weight:500;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${escHtml(e.name)}</span>
              <span style="font-size:.75rem;color:var(--text-muted)">${fmt(e.monthly_amount)}/mo · ${escHtml(e.frequency)}</span>
            </span>
          </label>
          ${checked ? `<button class="btn btn-outline btn-sm" style="font-size:.72rem;padding:.2rem .6rem" onclick='openDueDayModal(${JSON.stringify(e)})'>Day ${e.due_day}</button>` : ""}
        </div>`;
      }).join("");

      return `<div>
        <div style="padding:.4rem 1.25rem;font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:${color};background:${color}12;border-bottom:1px solid var(--border)">${escHtml(cat)}</div>
        ${rows}
      </div>`;
    }).join("");
  }

  let editingBill = null;

  window.openDueDayModal = function (bill) {
    editingBill = bill;
    $("#due-day-bill-name").textContent = bill.name;
    $("#due-day-input").value = bill.due_day;
    openModal("due-day-modal");
  };

  window.toggleCalendarTracking = async function (id, tracked) {
    try {
      const updated = await apiFetch(`/api/calendar/bills/${id}`, {
        method: "PUT",
        body: JSON.stringify({ track_on_calendar: tracked }),
      });
      // Update local allExpenses list
      const idx = allExpenses.findIndex(e => e.id === id);
      if (idx !== -1) allExpenses[idx] = updated;
      renderManageList();
      await loadBills();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  $("#due-day-save")?.addEventListener("click", async () => {
    if (!editingBill) return;
    const day = parseInt($("#due-day-input").value, 10);
    if (!day || day < 1 || day > 31) {
      showToast("Enter a day between 1 and 31", "error");
      return;
    }
    try {
      const updated = await apiFetch(`/api/calendar/bills/${editingBill.id}`, {
        method: "PUT",
        body: JSON.stringify({ due_day: day }),
      });
      // Sync back into allExpenses so the manage list stays fresh
      const idx = allExpenses.findIndex(e => e.id === editingBill.id);
      if (idx !== -1) allExpenses[idx] = updated;
      closeModal("due-day-modal");
      showToast("Due day updated");
      renderManageList();
      await loadBills();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  $("#btn-manage-bills")?.addEventListener("click", async () => {
    await loadAllExpenses();
    openModal("manage-modal");
  });

  $("#btn-prev-month")?.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    render();
  });

  $("#btn-next-month")?.addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    render();
  });

  await loadBills();
};
