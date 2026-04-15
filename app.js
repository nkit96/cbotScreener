const marketConfigs = {
  US: { suffix: '.US', exchanges: ['NYSE', 'NASDAQ', 'AMEX'] },
  EU: { suffix: '.EU', exchanges: ['XETR', 'EURONEXT', 'FWB'] },
  UK: { suffix: '.UK', exchanges: ['LSE'] },
  DE: { suffix: '.DE', exchanges: ['XETR', 'FWB'] }
};

const timeframes = ['Minute5', 'Minute15', 'Minute30', 'Hour', 'Hour4', 'Daily', 'Weekly'];
const sentiments = ['Any', 'Bullish', 'Bearish'];
const tagFilters = ['Ranged', 'Weak', 'Strong', 'Mature'];

const demoResults = [
  { symbolName: 'AAPL.US', htfAdxLabel: 'Strong Bull', tf1State: 1, tf2State: 1 },
  { symbolName: 'MSFT.US', htfAdxLabel: 'Weak Bull', tf1State: 1, tf2State: 1 },
  { symbolName: 'TSLA.US', htfAdxLabel: 'Ranged Bear', tf1State: -1, tf2State: -1 },
  { symbolName: 'NVDA.US', htfAdxLabel: 'Mature Bull', tf1State: 1, tf2State: 1 },
  { symbolName: 'AMD.US', htfAdxLabel: 'Strong Bear', tf1State: -1, tf2State: -1 },
  { symbolName: 'META.US', htfAdxLabel: 'Weak Bear', tf1State: -1, tf2State: -1 }
];

const state = {
  theme: 'light',
  market: 'US',
  exchange1: 'NYSE',
  exchange2: 'NASDAQ',
  tf1: 'Daily',
  sentiment1: 'Bullish',
  tf2: 'Hour',
  sentiment2: 'Bearish',
  batchSize: 5,
  slowSeconds: 8,
  maxResults: 150,
  showProgress: true,
  isSortedByAdx: false,
  selectedTags: new Set(tagFilters),
  matchedSymbols: [...demoResults],
  status: 'Ready. Choose filters and click Scan.',
  activeJobs: ['Active: -']
};

const els = {
  marketSelect: document.getElementById('marketSelect'),
  exchange1Select: document.getElementById('exchange1Select'),
  exchange2Select: document.getElementById('exchange2Select'),
  tf1Select: document.getElementById('tf1Select'),
  sentiment1Select: document.getElementById('sentiment1Select'),
  tf2Select: document.getElementById('tf2Select'),
  sentiment2Select: document.getElementById('sentiment2Select'),
  batchSizeInput: document.getElementById('batchSizeInput'),
  slowSecondsInput: document.getElementById('slowSecondsInput'),
  maxResultsInput: document.getElementById('maxResultsInput'),
  showProgressInput: document.getElementById('showProgressInput'),
  scanBtn: document.getElementById('scanBtn'),
  sortBtn: document.getElementById('sortBtn'),
  statusText: document.getElementById('statusText'),
  activeJobsText: document.getElementById('activeJobsText'),
  metricsRow: document.getElementById('metricsRow'),
  resultsTableBody: document.getElementById('resultsTableBody'),
  mobileCards: document.getElementById('mobileCards'),
  emptyState: document.getElementById('emptyState'),
  tagFilters: document.getElementById('tagFilters'),
  themeToggle: document.getElementById('themeToggle')
};

function fillSelect(select, values, selected) {
  select.innerHTML = '';
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = value === selected;
    select.appendChild(option);
  });
}

function getTradingViewInterval(tf) {
  if (tf === 'Minute5') return '5';
  if (tf === 'Minute15') return '15';
  if (tf === 'Minute30') return '30';
  if (tf === 'Hour') return '60';
  if (tf === 'Hour4') return '240';
  if (tf === 'Daily') return '1D';
  if (tf === 'Weekly') return '1W';
  return '60';
}

function tickerFromSymbol(symbolName) {
  const idx = symbolName.indexOf('.');
  return idx > 0 ? symbolName.slice(0, idx) : symbolName;
}

function getTagClass(label) {
  if (label.startsWith('Strong')) return 'strong';
  if (label.startsWith('Weak')) return 'weak';
  if (label.startsWith('Mature')) return 'mature';
  if (label.startsWith('Ranged')) return 'ranged';
  return '';
}

function stateText(value) {
  if (value === 1) return '<span class="state-bull">Bullish</span>';
  if (value === -1) return '<span class="state-bear">Bearish</span>';
  return '<span class="state-neutral">Neutral</span>';
}

function getAdxTagRank(label) {
  switch (label) {
    case 'Strong Bull': return 1;
    case 'Weak Bull': return 2;
    case 'Mature Bull': return 3;
    case 'Ranged Bull': return 4;
    case 'Strong Bear': return 5;
    case 'Weak Bear': return 6;
    case 'Mature Bear': return 7;
    case 'Ranged Bear': return 8;
    case 'NiLL': return 9;
    default: return 99;
  }
}

function filteredResults() {
  return state.matchedSymbols
    .filter(item => {
      const prefix = item.htfAdxLabel.split(' ')[0];
      return state.selectedTags.has(prefix);
    })
    .slice(0, state.maxResults);
}

function buildTradingViewUrl(exchange, symbolName) {
  const ticker = tickerFromSymbol(symbolName);
  const interval = getTradingViewInterval(state.tf2);
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(exchange + ':' + ticker)}&interval=${encodeURIComponent(interval)}`;
}

function copySymbol(symbolName) {
  navigator.clipboard?.writeText(symbolName);
}

function renderTagFilters() {
  els.tagFilters.innerHTML = '';
  tagFilters.forEach(tag => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (state.selectedTags.has(tag) ? ' active' : '');
    btn.textContent = tag;
    btn.addEventListener('click', () => {
      if (state.selectedTags.has(tag)) {
        state.selectedTags.delete(tag);
      } else {
        state.selectedTags.add(tag);
      }
      renderAll();
    });
    els.tagFilters.appendChild(btn);
  });
}

function renderMetrics() {
  const rows = filteredResults();
  const bullish = rows.filter(r => r.htfAdxLabel.includes('Bull')).length;
  const bearish = rows.filter(r => r.htfAdxLabel.includes('Bear')).length;
  const html = [
    ['Filtered Matches', rows.length],
    ['Order', state.isSortedByAdx ? 'ADX' : 'Scan'],
    ['Bullish Rows', bullish],
    ['Bearish Rows', bearish]
  ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
  els.metricsRow.innerHTML = html;
}

function renderTable() {
  const rows = filteredResults();
  els.resultsTableBody.innerHTML = rows.map(item => {
    const ex1 = state.exchange1;
    const ex2 = state.exchange2;
    return `
      <tr>
        <td><strong>${item.symbolName}</strong></td>
        <td><span class="tag ${getTagClass(item.htfAdxLabel)}">${item.htfAdxLabel}</span></td>
        <td>${stateText(item.tf1State)}</td>
        <td>${stateText(item.tf2State)}</td>
        <td>
          <div class="action-links">
            <a href="${buildTradingViewUrl(ex1, item.symbolName)}" target="_blank" rel="noopener noreferrer">${ex1}</a>
            <a href="${buildTradingViewUrl(ex2, item.symbolName)}" target="_blank" rel="noopener noreferrer">${ex2}</a>
            <button type="button" data-copy="${item.symbolName}">Copy</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  els.emptyState.style.display = rows.length ? 'none' : 'block';

  els.resultsTableBody.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => copySymbol(btn.dataset.copy));
  });
}

function renderCards() {
  const rows = filteredResults();
  els.mobileCards.innerHTML = rows.map(item => {
    const ex1 = state.exchange1;
    const ex2 = state.exchange2;
    return `
      <article class="symbol-card">
        <div class="symbol-card-header">
          <strong>${item.symbolName}</strong>
          <span class="tag ${getTagClass(item.htfAdxLabel)}">${item.htfAdxLabel}</span>
        </div>
        <div class="symbol-meta">
          <div><small>ST1</small><br>${item.tf1State === 1 ? 'Bullish' : item.tf1State === -1 ? 'Bearish' : 'Neutral'}</div>
          <div><small>ST2</small><br>${item.tf2State === 1 ? 'Bullish' : item.tf2State === -1 ? 'Bearish' : 'Neutral'}</div>
        </div>
        <div class="action-links">
          <a href="${buildTradingViewUrl(ex1, item.symbolName)}" target="_blank" rel="noopener noreferrer">${ex1}</a>
          <a href="${buildTradingViewUrl(ex2, item.symbolName)}" target="_blank" rel="noopener noreferrer">${ex2}</a>
          <button type="button" data-copy="${item.symbolName}">Copy</button>
        </div>
      </article>
    `;
  }).join('');

  els.mobileCards.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => copySymbol(btn.dataset.copy));
  });
}

function renderStatus() {
  els.statusText.textContent = state.status;
  els.activeJobsText.textContent = state.showProgress ? state.activeJobs.join('\n') : 'Progress hidden';
}

function renderAll() {
  renderTagFilters();
  renderMetrics();
  renderTable();
  renderCards();
  renderStatus();
}

function applyMarketSelection() {
  const config = marketConfigs[state.market];
  fillSelect(els.exchange1Select, config.exchanges, config.exchanges[0]);
  fillSelect(els.exchange2Select, config.exchanges, config.exchanges[1] || config.exchanges[0]);
  state.exchange1 = els.exchange1Select.value;
  state.exchange2 = els.exchange2Select.value;
}

function simulateScan() {
  state.status = `Started scan for ${demoResults.length} symbols on ${state.market}.`;
  state.activeJobs = [
    '[1] AAPL.US | Loading ST1',
    '[2] MSFT.US | Loading ST2',
    '[3] TSLA.US | Calculating'
  ];
  state.matchedSymbols = [...demoResults].filter(item => item.symbolName.endsWith(marketConfigs[state.market].suffix));
  state.isSortedByAdx = false;
  renderAll();

  setTimeout(() => {
    state.status = `Scan complete. Matched: ${state.matchedSymbols.length}`;
    state.activeJobs = ['Active: -'];
    renderAll();
  }, 700);
}

function bindEvents() {
  els.marketSelect.addEventListener('change', () => {
    state.market = els.marketSelect.value;
    applyMarketSelection();
    renderAll();
  });
  els.exchange1Select.addEventListener('change', () => { state.exchange1 = els.exchange1Select.value; renderAll(); });
  els.exchange2Select.addEventListener('change', () => { state.exchange2 = els.exchange2Select.value; renderAll(); });
  els.tf1Select.addEventListener('change', () => { state.tf1 = els.tf1Select.value; });
  els.sentiment1Select.addEventListener('change', () => { state.sentiment1 = els.sentiment1Select.value; });
  els.tf2Select.addEventListener('change', () => { state.tf2 = els.tf2Select.value; renderAll(); });
  els.sentiment2Select.addEventListener('change', () => { state.sentiment2 = els.sentiment2Select.value; });
  els.batchSizeInput.addEventListener('input', () => { state.batchSize = Number(els.batchSizeInput.value || 5); });
  els.slowSecondsInput.addEventListener('input', () => { state.slowSeconds = Number(els.slowSecondsInput.value || 8); });
  els.maxResultsInput.addEventListener('input', () => { state.maxResults = Number(els.maxResultsInput.value || 150); renderAll(); });
  els.showProgressInput.addEventListener('change', () => { state.showProgress = els.showProgressInput.checked; renderStatus(); });
  els.scanBtn.addEventListener('click', simulateScan);
  els.sortBtn.addEventListener('click', () => {
    state.matchedSymbols.sort((a, b) => getAdxTagRank(a.htfAdxLabel) - getAdxTagRank(b.htfAdxLabel) || a.symbolName.localeCompare(b.symbolName));
    state.isSortedByAdx = true;
    state.status = 'Results sorted by ADX tag.';
    renderAll();
  });
  els.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    els.themeToggle.textContent = state.theme === 'light' ? '🌙' : '☀️';
    els.themeToggle.setAttribute('aria-label', state.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  });
}

function init() {
  fillSelect(els.marketSelect, Object.keys(marketConfigs), state.market);
  fillSelect(els.tf1Select, timeframes, state.tf1);
  fillSelect(els.tf2Select, timeframes, state.tf2);
  fillSelect(els.sentiment1Select, sentiments, state.sentiment1);
  fillSelect(els.sentiment2Select, sentiments, state.sentiment2);
  applyMarketSelection();
  bindEvents();
  renderAll();
}

init();
