
(function () {
  const cfg = window.SCREENER_CONFIG;
  const indicators = window.ScreenerIndicators;
  const bridge = window.CTraderBridge;

  const state = {
    plugin: null,
    matchedSymbols: [],
    isScanning: false,
    isSortedByAdx: false,
    jobs: new Map(),
    completedCount: 0,
    symbolsToScan: [],
    nextIndexToStart: 0
  };

  const els = {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    captureElements();
    if (!hasRequiredElements()) {
      console.error('Screener init failed: required DOM elements are missing. Check that index.html matches app.js IDs.');
      return;
    }
    bindThemeToggle();
    populateStaticControls();
    bindEvents();
    applyMarketSelection();
    state.plugin = await bridge.init();
    applyPluginContext();
    renderResults();
  }

  function captureElements() {
    [
      'marketSelect','modeSelect','exchange1Select','exchange2Select','tf1Select','sentiment1Select','tf2Select','sentiment2Select',
      'atrLengthInput','multiplierInput','adxPeriodInput','batchSizeInput','slowSymbolInput','maxResultsInput',
      'showProgressCheck','scanButton','sortButton','statusText','activeJobsText','pluginContextText',
      'filterRanged','filterWeak','filterStrong','filterMature','resultSummary','orderSummary','resultsBody','mobileCards','themeToggle'
    ].forEach(id => els[id] = document.getElementById(id));
  }


  function hasRequiredElements() {
    const required = [
      'marketSelect','modeSelect','exchange1Select','exchange2Select','tf1Select','sentiment1Select','tf2Select','sentiment2Select',
      'atrLengthInput','multiplierInput','adxPeriodInput','batchSizeInput','slowSymbolInput','maxResultsInput',
      'showProgressCheck','scanButton','sortButton','statusText','activeJobsText','pluginContextText',
      'filterRanged','filterWeak','filterStrong','filterMature','resultSummary','orderSummary','resultsBody','mobileCards'
    ];
    return required.every(id => els[id]);
  }

  function populateStaticControls() {
    fillSelect(els.marketSelect, Object.keys(cfg.markets), 'US');
    fillSelect(els.tf1Select, cfg.timeframes, 'Daily');
    fillSelect(els.tf2Select, cfg.timeframes, 'Hour');
    fillSelect(els.sentiment1Select, cfg.sentiments, 'Bullish');
    fillSelect(els.sentiment2Select, cfg.sentiments, 'Bearish');
  }

  function fillSelect(select, options, selected) {
    select.innerHTML = '';
    options.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = value === selected;
      select.appendChild(option);
    });
  }

  function bindEvents() {
    els.marketSelect.addEventListener('change', applyMarketSelection);
    els.scanButton.addEventListener('click', startScan);
    els.sortButton.addEventListener('click', sortMatchedSymbolsByAdxTag);
    [els.filterRanged, els.filterWeak, els.filterStrong, els.filterMature].forEach(el => el.addEventListener('change', () => {
      if (!state.isScanning) renderResults();
    }));
  }

  function bindThemeToggle() {
    els.themeToggle?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  function resolveTheme(themeValue) {
    const value = String(themeValue || '').toLowerCase();
    if (['dark', 'black', 'night'].includes(value)) return 'dark';
    return 'light';
  }

  function applyTheme(themeValue) {
    document.documentElement.setAttribute('data-theme', resolveTheme(themeValue));
  }

  function applyPluginContext() {
    const c = state.plugin.context;
    applyTheme(c.theme);
    if (c.mode === 'plugin') els.modeSelect.value = 'plugin';
    els.pluginContextText.textContent = JSON.stringify({ ...state.plugin }, null, 2);
  }

  function applyMarketSelection() {
    const market = els.marketSelect.value || 'US';
    const config = cfg.markets[market] || cfg.markets.US;
    fillSelect(els.exchange1Select, config.exchanges, config.exchanges[0]);
    fillSelect(els.exchange2Select, config.exchanges, config.exchanges[1] || config.exchanges[0]);
  }

  async function startScan() {
    if (state.isScanning) {
      updateStatus('Scan already running...');
      return;
    }

    state.matchedSymbols = [];
    state.jobs = new Map();
    state.completedCount = 0;
    state.nextIndexToStart = 0;
    state.isScanning = true;
    state.isSortedByAdx = false;
    els.sortButton.disabled = true;
    els.scanButton.disabled = true;

    const market = els.marketSelect.value;
    state.symbolsToScan = await bridge.getSymbolsForMarket(market);
    updateStatus(`Started scan for ${state.symbolsToScan.length} symbols on ${market}.`);
    updateActiveJobs('Active: launching first batch...');
    renderResults();

    await fillBatchSlots();
    finishScan();
  }

  async function fillBatchSlots() {
    const batchSize = parseInt(els.batchSizeInput.value, 10) || 5;
    while (state.nextIndexToStart < state.symbolsToScan.length) {
      const slice = state.symbolsToScan.slice(state.nextIndexToStart, state.nextIndexToStart + batchSize);
      const jobs = slice.map((symbol, idx) => runSymbolJob(symbol, state.nextIndexToStart + idx + 1, state.symbolsToScan.length));
      state.nextIndexToStart += slice.length;
      await Promise.all(jobs);
      refreshStatus();
    }
  }

  async function runSymbolJob(symbol, position, total) {
    const tf1 = els.tf1Select.value;
    const tf2 = els.tf2Select.value;
    const sentiment1 = els.sentiment1Select.value;
    const sentiment2 = els.sentiment2Select.value;
    const atrLength = parseInt(els.atrLengthInput.value, 10) || 10;
    const multiplier = parseFloat(els.multiplierInput.value) || 3;
    const adxPeriod = parseInt(els.adxPeriodInput.value, 10) || 14;

    state.jobs.set(symbol, { symbol, position, stage: 'Loading ST1' });
    refreshStatus();

    const barsTf1 = await bridge.getBars(symbol, tf1);
    if (!barsTf1 || barsTf1.length < Math.max(Math.max(atrLength + 5, adxPeriod + 5), 20)) return skipJob(symbol, position, total, 'not enough ST1 data');

    const htfAdxLabel = indicators.getHtfAdxLabel(barsTf1, adxPeriod);
    const tf1State = indicators.getSupertrendState(barsTf1, atrLength, multiplier);
    if (!matchesSentiment(tf1State, sentiment1)) return skipJob(symbol, position, total, 'ST1 filter not matched');

    if (tf1 === tf2) {
      if (matchesSentiment(tf1State, sentiment2)) {
        state.matchedSymbols.push({ symbolName: symbol, htfAdxLabel, tf1State, tf2State: tf1State });
        updatePartialResults();
      }
      return completeJob(symbol, position, total, 'done');
    }

    state.jobs.set(symbol, { symbol, position, stage: 'Loading ST2' });
    refreshStatus();

    const barsTf2 = await bridge.getBars(symbol, tf2);
    if (!barsTf2 || barsTf2.length < Math.max(atrLength + 5, 20)) return skipJob(symbol, position, total, 'not enough ST2 data');

    const tf2State = indicators.getSupertrendState(barsTf2, atrLength, multiplier);
    if (matchesSentiment(tf2State, sentiment2)) {
      state.matchedSymbols.push({ symbolName: symbol, htfAdxLabel, tf1State, tf2State });
      updatePartialResults();
    }

    completeJob(symbol, position, total, 'done');
  }

  function completeJob(symbol, position, total, reason) {
    state.jobs.delete(symbol);
    state.completedCount++;
    updateStatus(`[${position}/${total}] ${symbol} completed: ${reason}`);
    refreshStatus();
  }

  function skipJob(symbol, position, total, reason) {
    state.jobs.delete(symbol);
    state.completedCount++;
    updateStatus(`[${position}/${total}] ${symbol} skipped: ${reason}`);
    refreshStatus();
  }

  function refreshStatus() {
    updateStatus(`Progress ${state.completedCount} / ${state.symbolsToScan.length} | Active: ${state.jobs.size} | Matches: ${state.matchedSymbols.length}`);
    if (!els.showProgressCheck.checked) {
      els.activeJobsText.style.display = 'none';
      els.statusText.style.display = 'none';
      return;
    }
    els.activeJobsText.style.display = 'block';
    els.statusText.style.display = 'block';
    if (state.jobs.size === 0) {
      updateActiveJobs('Active: -');
      return;
    }
    const lines = Array.from(state.jobs.values())
      .sort((a, b) => a.position - b.position)
      .slice(0, 12)
      .map(j => `[${j.position}] ${j.symbol} | ${j.stage}`);
    updateActiveJobs(`Active:
${lines.join('
')}`);
  }

  function finishScan() {
    state.isScanning = false;
    els.scanButton.disabled = false;
    els.sortButton.disabled = state.matchedSymbols.length === 0;
    renderResults();
    updateStatus(`Scan complete. Matched: ${state.matchedSymbols.length}`);
    updateActiveJobs('Active: -');
  }

  function updatePartialResults() {
    renderResults();
  }

  function renderResults() {
    const filtered = state.matchedSymbols.filter(m => isTagAllowed(m.htfAdxLabel));
    els.resultSummary.textContent = `Matched symbols: ${filtered.length}`;
    els.orderSummary.textContent = `Order: ${state.isSortedByAdx ? 'ADX Tag Sorted' : 'Scan Order'}`;
    els.resultsBody.innerHTML = '';
    els.mobileCards.innerHTML = '';

    if (filtered.length === 0) {
      els.resultsBody.innerHTML = '<tr><td colspan="5" class="empty-state">Results will appear here during scan.</td></tr>';
      els.mobileCards.innerHTML = '<div class="empty-state">Results will appear here during scan.</div>';
      return;
    }

    const maxResults = parseInt(els.maxResultsInput.value, 10) || 150;
    filtered.slice(0, maxResults).forEach(item => {
      els.resultsBody.appendChild(buildResultRow(item));
      els.mobileCards.appendChild(buildMobileCard(item));
    });
  }

  function buildResultRow(item) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="symbol-line">${escapeHtml(item.symbolName)}</div></td>
      <td>${buildTagHtml(item.htfAdxLabel)}</td>
      <td>${stateToText(item.tf1State)}</td>
      <td>${stateToText(item.tf2State)}</td>
      <td>${buildLinksHtml(item.symbolName)}</td>
    `;
    wireCopyButton(tr, item.symbolName);
    return tr;
  }

  function buildMobileCard(item) {
    const div = document.createElement('article');
    div.className = 'result-card';
    div.innerHTML = `
      <h3>${escapeHtml(item.symbolName)}</h3>
      <div class="result-meta">
        ${buildTagHtml(item.htfAdxLabel)}
        <span class="tag nil">ST1: ${stateToText(item.tf1State)}</span>
        <span class="tag nil">ST2: ${stateToText(item.tf2State)}</span>
      </div>
      ${buildLinksHtml(item.symbolName)}
    `;
    wireCopyButton(div, item.symbolName);
    return div;
  }

  function buildLinksHtml(symbolName) {
    const ticker = symbolName.split('.')[0];
    const ex1 = els.exchange1Select.value || '';
    const ex2 = els.exchange2Select.value || '';
    const ltfInterval = cfg.timeframeToTv[els.tf2Select.value] || '60';
    const links = [];
    if (ex1) links.push(`<a target="_blank" rel="noopener noreferrer" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(ex1 + ':' + ticker)}&interval=${encodeURIComponent(ltfInterval)}">EX1</a>`);
    if (ex2) links.push(`<a target="_blank" rel="noopener noreferrer" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(ex2 + ':' + ticker)}&interval=${encodeURIComponent(ltfInterval)}">EX2</a>`);
    links.push(`<button class="copy-button" type="button" data-symbol="${escapeHtml(symbolName)}">Copy</button>`);
    return `<div class="link-group">${links.join('')}</div>`;
  }

  function wireCopyButton(root, symbolName) {
    const button = root.querySelector('.copy-button');
    if (!button) return;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(symbolName);
        button.textContent = 'Copied';
        setTimeout(() => button.textContent = 'Copy', 1200);
      } catch (_) {
        button.textContent = 'Copy failed';
      }
    });
  }

  function buildTagHtml(label) {
    const cls = label.toLowerCase().includes('ranged') ? 'ranged'
      : label.toLowerCase().includes('weak') ? 'weak'
      : label.toLowerCase().includes('strong') ? 'strong'
      : label.toLowerCase().includes('mature') ? 'mature'
      : 'nil';
    return `<span class="tag ${cls}">${escapeHtml(label)}</span>`;
  }

  function sortMatchedSymbolsByAdxTag() {
    if (state.isScanning) {
      updateStatus('Wait for scan completion before sorting.');
      return;
    }
    if (state.matchedSymbols.length === 0) {
      updateStatus('No results to sort.');
      return;
    }
    state.matchedSymbols.sort((a, b) => {
      const rankCompare = (cfg.adxTagRank[a.htfAdxLabel] || 99) - (cfg.adxTagRank[b.htfAdxLabel] || 99);
      if (rankCompare !== 0) return rankCompare;
      return a.symbolName.localeCompare(b.symbolName);
    });
    state.isSortedByAdx = true;
    renderResults();
    updateStatus('Results sorted by ADX tag.');
  }

  function isTagAllowed(tag) {
    if (!tag) return false;
    const ranged = tag.toLowerCase().startsWith('ranged');
    const weak = tag.toLowerCase().startsWith('weak');
    const strong = tag.toLowerCase().startsWith('strong');
    const mature = tag.toLowerCase().startsWith('mature');
    if (ranged && !els.filterRanged.checked) return false;
    if (weak && !els.filterWeak.checked) return false;
    if (strong && !els.filterStrong.checked) return false;
    if (mature && !els.filterMature.checked) return false;
    return ranged || weak || strong || mature;
  }

  function matchesSentiment(stateValue, sentiment) {
    if (sentiment === 'Any') return true;
    if (sentiment === 'Bullish') return stateValue === 1;
    if (sentiment === 'Bearish') return stateValue === -1;
    return false;
  }

  function stateToText(value) {
    if (value === 1) return 'Bullish';
    if (value === -1) return 'Bearish';
    return 'Neutral';
  }

  function updateStatus(text) { els.statusText.textContent = text; }
  function updateActiveJobs(text) { els.activeJobsText.textContent = text; }
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
