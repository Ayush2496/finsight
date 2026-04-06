// app.js — FinSight Frontend
const API = 'http://127.0.0.1:3000/api';

// ─── Tailwind config ───────────────────────────────────────────────────────
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-high"   : "#1d1f2c",
        "surface-container"        : "#171924",
        "surface-container-low"    : "#11131c",
        "surface-container-lowest" : "#000000",
        "surface"                  : "#0d0e16",
        "on-surface"               : "#e4e4f9",
        "on-surface-variant"       : "#a9a9bd",
        "outline"                  : "#737487",
        "outline-variant"          : "#454758",
        "primary"                  : "#b884ff",
        "primary-container"        : "#9d50ff",
        "on-primary-container"     : "#000000",
        "secondary"                : "#49d7f4",
        "tertiary"                 : "#24f07e",
        "error"                    : "#fd6f85",
      },
      fontFamily: { "headline": ["Lexend"], "body": ["Lexend"], "label": ["Lexend"] },
    },
  },
};

// ─── API fetch wrapper ─────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API}${endpoint}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('apiFetch error:', err);
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent      = msg;
  el.style.display    = 'block';
  el.style.background = isError ? '#fd6f85' : '#24f07e';
  el.style.color      = isError ? '#490013' : '#004820';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ─── Currency format ───────────────────────────────────────────────────────
function fmt(n) { return '₹' + Math.abs(Number(n)).toLocaleString('en-IN'); }

// ─── Category icons ────────────────────────────────────────────────────────
const CAT_ICONS = {
  Food:'🍔', Travel:'✈️', Shopping:'🛍️', Bills:'⚡',
  Entertainment:'🎬', Groceries:'🛒', Healthcare:'💊', Miscellaneous:'💰',
};

// ─── Auth guard ────────────────────────────────────────────────────────────
async function requireAuth() {
  const { ok, data } = await apiFetch('/auth/me');
  if (!ok) { window.location.href = 'regis.html'; return null; }
  return data.user;
}

// ─── Counter animation ─────────────────────────────────────────────────────
function animateValue(el, target, pre = '') {
  const dec = target % 1 !== 0 ? 1 : 0;
  let start = 0;
  const step = target / 60;
  const tick = () => {
    start = Math.min(start + step, target);
    el.textContent = pre + start.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (start < target) requestAnimationFrame(tick);
  };
  tick();
}

// ─── Chart helpers ─────────────────────────────────────────────────────────
function loadCharts(cb) {
  if (window.Chart) return cb();
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
  s.onload = cb;
  document.head.appendChild(s);
}
function grad(ctx, c1, c2) {
  const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
  g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
}
function mkChart(id, type, data, opts = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ex = Chart.getChart(canvas);
  if (ex) ex.destroy();
  new Chart(canvas, {
    type, data,
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: !!opts.legend, position: opts.legendBottom ? 'bottom' : 'top', labels: { color:'#a9a9bd', font:{ family:'Lexend', size:11 }, boxWidth:10 } },
        tooltip: { callbacks: { label: ctx => opts.yTick ? opts.yTick(ctx.raw) : ctx.raw } }
      },
      scales: (type==='doughnut'||type==='pie') ? {} : {
        x: { grid:{ color:'rgba(255,255,255,.04)' }, ticks:{ color:'#a9a9bd', font:{ family:'Lexend', size:10 } } },
        y: { grid:{ color:'rgba(255,255,255,.04)' }, ticks:{ color:'#a9a9bd', font:{ family:'Lexend', size:10 }, callback: opts.yTick||(v=>v) } }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE: regis.html
// ══════════════════════════════════════════════════════════════════════════
function initRegisPage() {
  const tabs   = document.querySelectorAll('.auth-tab');
  const panels = document.querySelectorAll('.auth-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(b => {
        const on = b === tab;
        b.classList.toggle('bg-surface-container-high', on);
        b.classList.toggle('text-primary', on);
        b.classList.toggle('text-on-surface-variant', !on);
      });
      panels.forEach(p => { p.hidden = p.id !== tab.dataset.target; });
    });
  });

  if (window.location.hash === '#register') {
    document.querySelector('.auth-tab[data-target="register-panel"]')?.click();
  }

  document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const input = toggle.parentElement.querySelector('input');
      const icon  = toggle.querySelector('.material-symbols-outlined');
      const isPw  = input.type === 'password';
      input.type       = isPw ? 'text' : 'password';
      icon.textContent = isPw ? 'visibility_off' : 'visibility';
    });
  });

  // Login
  document.getElementById('login-panel')?.addEventListener('submit', async e => {
    e.preventDefault();
    const inputs = e.target.querySelectorAll('input');
    const email = inputs[0].value.trim();
    const password = inputs[1].value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Signing in...'; btn.disabled = true;

    const { ok, data } = await apiFetch('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    });

    if (ok) {
      window.location.href = 'dashboard.html';
    } else {
      btn.textContent = 'Authorize Access'; btn.disabled = false;
      alert(data.error || 'Login failed. Check your credentials.');
    }
  });

  // Register
  document.getElementById('register-panel')?.addEventListener('submit', async e => {
    e.preventDefault();
    const inputs   = e.target.querySelectorAll('input');
    const name     = inputs[0].value.trim();
    const email    = inputs[1].value.trim();
    const password = inputs[2].value;
    const confirm  = inputs[3].value;

    if (password !== confirm) { alert('Passwords do not match.'); return; }
    if (password.length < 6)  { alert('Password must be at least 6 characters.'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Creating account...'; btn.disabled = true;

    const { ok, data } = await apiFetch('/auth/register', {
      method: 'POST', body: JSON.stringify({ name, email, password })
    });

    if (ok) {
      window.location.href = 'dashboard.html';
    } else {
      btn.textContent = 'Create Account'; btn.disabled = false;
      alert(data.error || 'Registration failed.');
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE: dashboard.html
// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// REPLACE YOUR initDashboardPage function in app.js with this entire block
// ══════════════════════════════════════════════════════════════════════════

async function initDashboardPage() {
  const user = await requireAuth();
  if (!user) return;

  // Real name greeting
  const h1 = document.getElementById('greeting');
  if (h1) h1.textContent = `Good morning, ${user.name} 👋`;

  const sub = document.getElementById('dashSubtitle');
  const now = new Date();
  if (sub) sub.textContent = `${now.toLocaleString('default',{month:'long'})} ${now.getFullYear()} — your vault summary.`;

  // Fetch real dashboard data
  const { ok, data } = await apiFetch('/dashboard');
  if (!ok) { toast('Failed to load dashboard data.', true); return; }

  // ── Stat cards — direct IDs, no guessing ──────────────────────────────
  function animateStat(id, value, prefix = '₹') {
    const el = document.getElementById(id);
    if (!el) return;
    const target = Math.abs(parseFloat(value) || 0);
    const isPercent = prefix === '%';
    const dec = target % 1 !== 0 ? 1 : 0;
    let cur = 0;
    const step = target / 60;
    const tick = () => {
      cur = Math.min(cur + step, target);
      el.innerHTML = isPercent
        ? `${cur.toFixed(dec)}<span class="text-xl text-on-surface-variant">%</span>`
        : `${prefix}${cur.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`;
      if (cur < target) requestAnimationFrame(tick);
    };
    tick();
  }

  animateStat('stat-balance',  data.totalBalance,  '₹');
  animateStat('stat-income',   data.totalIncome,   '₹');
  animateStat('stat-expenses', data.totalExpenses, '₹');
  animateStat('stat-savings',  data.savingsYield,  '%');

  // ── Recent transactions ─────────────────────────────────────────────────
  const txnList = document.getElementById('txnList');
  if (txnList) {
    if (!data.recentTransactions?.length) {
      txnList.innerHTML = '<p style="color:#a9a9bd;font-size:.85rem;padding:1rem 0">No transactions yet. Add one above!</p>';
    } else {
      txnList.innerHTML = data.recentTransactions.map(t => `
        <div class="txn-row" data-type="${t.type}">
          <div class="txn-ico">${CAT_ICONS[t.category] || '💳'}</div>
          <div class="txn-meta">
            <div class="txn-name">${t.description}</div>
            <div class="txn-cat">${t.category} · ${String(t.date).split('T')[0]}</div>
          </div>
          <div class="txn-right">
            <div class="txn-amt ${t.type==='income'?'positive':'negative'}">${t.type==='income'?'+':''}${fmt(t.amount)}</div>
            <div class="txn-date">${t.type}</div>
          </div>
        </div>`).join('');
    }

    document.querySelectorAll('.pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active','bg-primary','text-black'));
        pill.classList.add('active','bg-primary','text-black');
        const f = pill.dataset.filter;
        document.querySelectorAll('.txn-row').forEach(row => {
          row.style.display = (f==='all'||row.dataset.type===f) ? 'flex' : 'none';
        });
      });
    });
  }

  // ── Smart budgets with editable limits ─────────────────────────────────
  const DEFAULT_BUDGETS = { Food:8000, Shopping:10000, Travel:12000, Bills:5000, Entertainment:4000, Groceries:6000, Healthcare:5000, Miscellaneous:3000 };

  // Load saved budgets from localStorage (persists across sessions)
  let budgets = { ...DEFAULT_BUDGETS };
  try {
    const saved = localStorage.getItem('finsight_budgets');
    if (saved) budgets = { ...budgets, ...JSON.parse(saved) };
  } catch(e) {}

  function renderBudgets() {
    const budgetList = document.getElementById('budgetList');
    if (!budgetList) return;
    if (!data.categoryBreakdown?.length) {
      budgetList.innerHTML = '<p style="color:#a9a9bd;font-size:.85rem">No expense data yet.</p>';
      return;
    }
    budgetList.innerHTML = data.categoryBreakdown.slice(0,6).map(c => {
      const limit = budgets[c.category] || 5000;
      const pct   = Math.min((c.total / limit) * 100, 100).toFixed(0);
      const cls   = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
      return `<div class="budget-item">
        <div class="budget-row">
          <span class="budget-name">${CAT_ICONS[c.category]||'💳'} ${c.category}</span>
          <span class="budget-amounts"><strong>${fmt(c.total)}</strong> / ${fmt(limit)}</span>
        </div>
        <div class="prog-wrap"><div class="prog-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  renderBudgets();

  // ML prediction display
  if (data.predictedNextMonth && data.enoughDataForML) {
    const predEl = document.getElementById('mlPrediction');
    const predText = document.getElementById('mlPredictionText');
    if (predEl && predText) {
      predEl.classList.remove('hidden');
      predText.textContent = `Predicted next month: ${fmt(data.predictedNextMonth)}${data.overspendingAlert ? ' ⚠ Overspending likely!' : ' ✓ On track'}`;
      predText.style.color = data.overspendingAlert ? '#fd6f85' : '#24f07e';
    }
  }

  // Edit budgets modal
  document.getElementById('editBudgetBtn')?.addEventListener('click', () => {
    // Pre-fill modal inputs with current budget values
    Object.keys(DEFAULT_BUDGETS).forEach(cat => {
      const input = document.getElementById(`b-${cat}`);
      if (input) input.value = budgets[cat] || DEFAULT_BUDGETS[cat];
    });
    openModal('budgetModal');
  });

  document.getElementById('budgetForm')?.addEventListener('submit', e => {
    e.preventDefault();
    Object.keys(DEFAULT_BUDGETS).forEach(cat => {
      const val = parseInt(document.getElementById(`b-${cat}`)?.value);
      if (!isNaN(val) && val > 0) budgets[cat] = val;
    });
    localStorage.setItem('finsight_budgets', JSON.stringify(budgets));
    closeModal('budgetModal');
    renderBudgets();
    toast('Budget limits updated!');
  });

  // ── Charts ──────────────────────────────────────────────────────────────
  loadCharts(() => {
    if (data.monthlyTrend?.length) {
      mkChart('monthlyChart', 'bar', {
        labels  : data.monthlyTrend.map(m => m.month),
        datasets: [
          { label:'Income',   data:data.monthlyTrend.map(m=>m.income),   backgroundColor:'rgba(110,247,160,.4)',  borderColor:'#6ef7a0', borderWidth:1.5, borderRadius:4 },
          { label:'Expenses', data:data.monthlyTrend.map(m=>m.expenses), backgroundColor:'rgba(247,110,124,.35)', borderColor:'#f76e7c', borderWidth:1.5, borderRadius:4 }
        ]
      }, { legend:true, yTick:v=>'₹'+(v/1000)+'K' });
    }
    if (data.categoryBreakdown?.length) {
      mkChart('catDonut', 'doughnut', {
        labels  : data.categoryBreakdown.map(c=>c.category),
        datasets: [{ data:data.categoryBreakdown.map(c=>c.total), backgroundColor:['#b884ff','#f7c56e','#6ef7c5','#f76e7c','#6ea8f7','#c56ef7','#49d7f4','#24f07e'], borderColor:'transparent', hoverOffset:7 }]
      }, { legendBottom:true });
    }
  });

  // ── Modal controls ──────────────────────────────────────────────────────
  document.querySelectorAll('[data-open]').forEach(btn  => btn.addEventListener('click', () => openModal(btn.dataset.open)));
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));

  // Type toggle
  let currentType = 'expense';
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('is-expense','is-income'));
      btn.classList.add(currentType==='expense'?'is-expense':'is-income');
    });
  });

  // ML preview — show predicted category as user types description
  let mlPreviewTimer;
  document.getElementById('txnName')?.addEventListener('input', e => {
    clearTimeout(mlPreviewTimer);
    const badge = document.getElementById('mlPreviewBadge');
    const catSelect = document.getElementById('txnCategory');
    if (catSelect?.value) { if(badge) badge.style.display='none'; return; } // manual selected
    mlPreviewTimer = setTimeout(async () => {
      const desc = e.target.value.trim();
      if (desc.length < 3) { if(badge) badge.style.display='none'; return; }
      try {
        const r = await fetch(`${API.replace('/api','')}/api/transactions/preview-category`, {
          method:'POST', credentials:'include',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ description: desc })
        });
        if (r.ok) {
          const d = await r.json();
          if (badge) {
            badge.style.display = 'block';
            badge.textContent = `✨ ML predicts: ${d.category} (${d.confidence} confidence)`;
          }
        }
      } catch(err) { /* Flask might be off, ignore */ }
    }, 600);
  });

  // Hide ML preview when category manually selected
  document.getElementById('txnCategory')?.addEventListener('change', e => {
    const badge = document.getElementById('mlPreviewBadge');
    if (badge) badge.style.display = e.target.value ? 'none' : 'block';
  });

  // Add transaction form
  document.getElementById('addTxnForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const description = document.getElementById('txnName').value.trim();
    const amount      = document.getElementById('txnAmount').value;
    const date        = document.getElementById('txnDate').value || new Date().toISOString().split('T')[0];
    const category    = document.getElementById('txnCategory').value; // may be empty → ML

    if (!description || !amount) { toast('Fill in description and amount.', true); return; }

    const btn = e.target.querySelector('.btn-primary');
    btn.textContent = category ? 'Saving...' : 'Classifying with ML...';
    btn.disabled = true;

    const { ok, data: res } = await apiFetch('/transactions/add', {
      method:'POST', body: JSON.stringify({ description, amount, date, type:currentType, category })
    });

    btn.textContent = 'Record Entry'; btn.disabled = false;
    if (ok) {
      closeModal('addModal'); e.target.reset();
      document.getElementById('mlPreviewBadge').style.display = 'none';
      const conf = res.transaction.ml_confidence === 'manual' ? 'manual' : `ML: ${res.transaction.ml_confidence}`;
      toast(`✅ ${res.transaction.category} · ${fmt(res.transaction.amount)} (${conf})`);
      setTimeout(() => location.reload(), 1500);
    } else {
      toast(res.error || 'Failed to add transaction.', true);
    }
  });

  // Logout
  document.querySelectorAll('a[href="regis.html"]').forEach(link => {
    link.addEventListener('click', async e => {
      e.preventDefault();
      await apiFetch('/auth/logout', { method:'POST' });
      window.location.href = 'regis.html';
    });
  });

  // Burger
  document.getElementById('burger')?.addEventListener('click', () => {
    const m = document.getElementById('mobileMenu');
    m?.classList.remove('hidden'); m?.classList.add('flex');
  });
}


// ══════════════════════════════════════════════════════════════════════════
// PAGE: transactions.html
// ══════════════════════════════════════════════════════════════════════════
async function initTransactionsPage() {
  const user = await requireAuth();
  if (!user) return;

  let allTransactions = [];
  let PAGE = 1;
  const PER = 8;

  async function loadTransactions() {
    const { ok, data } = await apiFetch('/transactions');
    if (!ok) { toast('Failed to load transactions.', true); return; }
    allTransactions = data.transactions || [];
    PAGE = 1; render();
  }

  function filtered() {
    const q    = document.getElementById('txnSearch')?.value.toLowerCase() || '';
    const cat  = document.getElementById('filterCat')?.value  || 'all';
    const type = document.getElementById('filterType')?.value || 'all';
    const sort = document.getElementById('filterSort')?.value || 'date';
    let list   = [...allTransactions];
    if (q)            list = list.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    if (cat  !== 'all') list = list.filter(t => t.category === cat);
    if (type !== 'all') list = list.filter(t => t.type === type);
    if (sort === 'desc') list.sort((a,b) => Math.abs(b.amount)-Math.abs(a.amount));
    if (sort === 'asc')  list.sort((a,b) => Math.abs(a.amount)-Math.abs(b.amount));
    return list;
  }

  function render() {
    const list  = filtered();
    const pages = Math.max(Math.ceil(list.length/PER), 1);
    PAGE = Math.min(PAGE, pages);
    const slice = list.slice((PAGE-1)*PER, PAGE*PER);

    document.getElementById('txnCount').textContent = `${list.length} records`;

    document.getElementById('txnTableBody').innerHTML = slice.length === 0
      ? `<tr><td colspan="7" style="text-align:center;color:#a9a9bd;padding:2rem">No transactions found.</td></tr>`
      : slice.map(t => `
        <tr>
          <td><div style="width:32px;height:32px;background:rgba(255,255,255,.05);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1rem">${CAT_ICONS[t.category]||'💳'}</div></td>
          <td style="font-weight:600">${t.description}</td>
          <td style="color:#a9a9bd;font-size:.82rem">${t.category}</td>
          <td style="color:#a9a9bd;font-size:.82rem">${String(t.date).split('T')[0]}</td>
          <td class="${t.type==='income'?'positive':'negative'}" style="font-weight:700">${t.type==='income'?'+':''}${fmt(t.amount)}</td>
          <td><span style="padding:.2rem .58rem;border-radius:99px;font-size:.68rem;font-weight:600;background:${t.type==='income'?'rgba(110,247,160,.09)':'rgba(247,110,124,.09)'};color:${t.type==='income'?'#24f07e':'#fd6f85'};border:1px solid ${t.type==='income'?'rgba(110,247,160,.18)':'rgba(247,110,124,.18)'}">${t.type}</span></td>
          <td><button class="btn-danger btn-sm" onclick="deleteTxn(${t.transaction_id})">✕</button></td>
        </tr>`).join('');

    document.getElementById('pagination').innerHTML = pages > 1
      ? Array.from({length:pages},(_,i)=>`<button onclick="goPage(${i+1})" style="width:28px;height:28px;border-radius:50%;font-size:.78rem;font-weight:600;background:${PAGE===i+1?'#b884ff':'rgba(255,255,255,.05)'};color:${PAGE===i+1?'#000':'#a9a9bd'};border:none;cursor:pointer">${i+1}</button>`).join('')
      : '';
  }

  window.goPage = p => { PAGE=p; render(); };
  window.deleteTxn = async id => {
    if (!confirm('Delete this transaction?')) return;
    const { ok } = await apiFetch(`/transactions/${id}`, { method:'DELETE' });
    if (ok) { toast('Transaction deleted.'); await loadTransactions(); }
    else toast('Failed to delete.', true);
  };

  ['txnSearch','filterCat','filterType','filterSort'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  () => { PAGE=1; render(); });
    document.getElementById(id)?.addEventListener('change', () => { PAGE=1; render(); });
  });

  document.querySelectorAll('[data-open]').forEach(btn  => btn.addEventListener('click',  () => openModal(btn.dataset.open)));
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click',  () => closeModal(btn.dataset.close)));

  let currentType = 'expense';
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('is-expense','is-income'));
      btn.classList.add(currentType==='expense'?'is-expense':'is-income');
    });
  });

  document.getElementById('addTxnForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const description = document.getElementById('txnName').value.trim();
    const amount      = document.getElementById('txnAmount').value;
    const date        = document.getElementById('txnDate').value || new Date().toISOString().split('T')[0];
    const btn         = e.target.querySelector('.btn-primary');
    btn.textContent = 'Saving...'; btn.disabled = true;

    const { ok, data } = await apiFetch('/transactions/add', {
      method:'POST', body: JSON.stringify({ description, amount, date, type:currentType })
    });

    btn.textContent = 'Record Entry'; btn.disabled = false;
    if (ok) {
      closeModal('addModal'); e.target.reset();
      toast(`✅ Added · ${data.transaction.category} (${data.transaction.ml_confidence} confidence)`);
      await loadTransactions();
    } else {
      toast(data.error || 'Failed to add.', true);
    }
  });

  document.querySelectorAll('a[href="regis.html"]').forEach(link => {
    link.addEventListener('click', async e => {
      e.preventDefault();
      await apiFetch('/auth/logout', { method:'POST' });
      window.location.href = 'regis.html';
    });
  });

  document.getElementById('burger')?.addEventListener('click', () => {
    const m = document.getElementById('mobileMenu');
    m?.classList.remove('hidden'); m?.classList.add('flex');
  });

  await loadTransactions();
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE: analytics.html
// ══════════════════════════════════════════════════════════════════════════
async function initAnalyticsPage() {
  const user = await requireAuth();
  if (!user) return;

  const { ok, data } = await apiFetch('/dashboard');
  if (!ok) { toast('Failed to load analytics.', true); return; }

  const { ok:tok, data:td } = await apiFetch('/transactions');
  const countEl = document.querySelector('[data-count="248"]');
  if (countEl && tok) { countEl.textContent = td.count || 0; }

  loadCharts(() => {
    const months   = data.monthlyTrend?.map(m=>m.month)   || [];
    const incomes  = data.monthlyTrend?.map(m=>m.income)  || [];
    const expenses = data.monthlyTrend?.map(m=>m.expenses)|| [];
    const savings  = data.monthlyTrend?.map(m => m.income>0 ? parseFloat((((m.income-m.expenses)/m.income)*100).toFixed(1)) : 0) || [];

    mkChart('trendChart','line',{
      labels:months,
      datasets:[{ data:expenses, borderColor:'#7c6ef7', backgroundColor:ctx=>grad(ctx,'rgba(124,110,247,.22)','rgba(124,110,247,0)'), borderWidth:2.5, fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#7c6ef7' }]
    },{ yTick:v=>'₹'+(v/1000)+'K' });

    mkChart('incomeExpChart','bar',{
      labels:months,
      datasets:[
        { label:'Income',  data:incomes,  backgroundColor:'rgba(110,247,160,.4)',  borderColor:'#6ef7a0', borderWidth:1.5, borderRadius:4 },
        { label:'Expense', data:expenses, backgroundColor:'rgba(247,110,124,.35)', borderColor:'#f76e7c', borderWidth:1.5, borderRadius:4 }
      ]
    },{ legend:true, yTick:v=>'₹'+(v/1000)+'K' });

    if (data.categoryBreakdown?.length) {
      mkChart('catChart','doughnut',{
        labels  : data.categoryBreakdown.map(c=>c.category),
        datasets: [{ data:data.categoryBreakdown.map(c=>c.total), backgroundColor:['#7c6ef7','#f7c56e','#6ef7c5','#f76e7c','#6ea8f7','#c56ef7','#49d7f4','#24f07e'], borderColor:'transparent', hoverOffset:7 }]
      },{ legendBottom:true });
    }

    mkChart('savingsChart','line',{
      labels:months,
      datasets:[{ data:savings, borderColor:'#6ef7a0', backgroundColor:ctx=>grad(ctx,'rgba(110,247,160,.18)','rgba(110,247,160,0)'), borderWidth:2.5, fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#6ef7a0' }]
    },{ yTick:v=>v+'%' });

    mkChart('dowChart','bar',{
      labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets:[{ data:[2800,3200,2600,3900,5400,7200,4100], backgroundColor:ctx=>{ const v=ctx.raw; return v>=7000?'#f7c56e':v>=5000?'#f76e7c':'rgba(124,110,247,.5)'; }, borderRadius:4 }]
    },{ yTick:v=>'₹'+(v/1000)+'K' });
  });

  // Category breakdown table
  const catTable = document.getElementById('catTable');
  if (catTable && data.categoryBreakdown?.length) {
    const total = data.categoryBreakdown.reduce((s,c)=>s+c.total, 0);
    catTable.innerHTML = data.categoryBreakdown.map(c => {
      const pct = (c.total/total*100).toFixed(1);
      return `<tr>
        <td style="font-weight:600">${CAT_ICONS[c.category]||'💳'} ${c.category}</td>
        <td style="color:#a9a9bd">—</td>
        <td style="font-weight:700">${fmt(c.total)}</td>
        <td style="color:#a9a9bd">—</td>
        <td><div style="display:flex;align-items:center;gap:.4rem"><div class="prog-wrap" style="width:68px"><div class="prog-fill" style="width:${pct}%"></div></div><span style="font-size:.76rem;color:#a9a9bd">${pct}%</span></div></td>
        <td style="color:#a9a9bd">—</td>
      </tr>`;
    }).join('');
  }

  document.querySelectorAll('a[href="regis.html"]').forEach(link => {
    link.addEventListener('click', async e => {
      e.preventDefault();
      await apiFetch('/auth/logout', { method:'POST' });
      window.location.href = 'regis.html';
    });
  });

  document.getElementById('burger')?.addEventListener('click', () => {
    const m = document.getElementById('mobileMenu');
    m?.classList.remove('hidden'); m?.classList.add('flex');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Router
// ══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if      (page==='regis.html' || page==='login.html' || page==='signup.html') initRegisPage();
  else if (page==='dashboard.html')    initDashboardPage();
  else if (page==='transactions.html') initTransactionsPage();
  else if (page==='analytics.html')    initAnalyticsPage();
});