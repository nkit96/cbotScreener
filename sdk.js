
window.CTraderBridge = (function () {
  function readContextFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
      id: params.get('id') || '',
      theme: params.get('theme') || 'light',
      symbol: params.get('symbol') || '',
      platform: params.get('platform') || 'browser',
      placement: params.get('placement') || '',
      mode: params.get('mode') || ''
    };
  }

  function detectPluginEnvironment() {
    const context = readContextFromQuery();
    const hasPluginSignals = Boolean(context.id || context.platform !== 'browser' || context.placement || context.mode === 'plugin');
    return { isPlugin: hasPluginSignals, context };
  }

  async function init() {
    const env = detectPluginEnvironment();
    return {
      ...env,
      sdkReady: false,
      note: env.isPlugin
        ? 'Plugin context detected. Replace stub calls in sdk.js with WV Plugin SDK calls from cTrader docs.'
        : 'Browser demo mode. No cTrader SDK detected.'
    };
  }

  async function getSymbolsForMarket(marketKey) {
    const demo = window.SCREENER_CONFIG.demoSymbolsByMarket[marketKey] || [];
    return demo;
  }

  async function getBars(symbol, timeframe) {
    const bars = [];
    const seed = Array.from(symbol + timeframe).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    let price = 80 + (seed % 140);
    for (let i = 0; i < 220; i++) {
      const wave = Math.sin((i + seed / 10) / 8) * 1.8 + Math.cos((i + seed / 13) / 13) * 1.1;
      const drift = ((seed % 7) - 3) * 0.03;
      const open = price;
      const close = Math.max(1, open + wave + drift);
      const high = Math.max(open, close) + 0.8 + ((i + seed) % 3) * 0.35;
      const low = Math.max(0.5, Math.min(open, close) - 0.8 - ((i + seed) % 2) * 0.25);
      bars.push({ open, high, low, close, time: Date.now() - (220 - i) * 3600000 });
      price = close;
    }
    return bars;
  }

  return { init, getSymbolsForMarket, getBars, readContextFromQuery, detectPluginEnvironment };
})();
