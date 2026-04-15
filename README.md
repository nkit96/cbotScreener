# Multi-Market Supertrend Screener WebView Plugin Files

This package converts the chart-rendered cBot UI into a hosted web app starter for cTrader WebView plugins.

## Files
- `index.html` - UI shell
- `style.css` - styling and responsive layout
- `config.js` - market, exchange, timeframe, and ADX rank config ported from the cBot
- `indicators.js` - JavaScript port of Supertrend and ADX tag logic
- `sdk.js` - plugin context reader and cTrader bridge stub with demo fallback
- `app.js` - scan engine, filters, sorting, progress updates, TradingView links

## What was ported from your cBot
- US/EU/UK/DE market configs and exchange lists
- ATR Length, Multiplier, ADX Period
- Two Supertrend filters
- ADX HTF labels: Ranged/Weak/Strong/Mature Bull/Bear
- Sort by ADX tag order
- TradingView links built from exchange + ticker + LTF timeframe
- Progress text and active jobs panel
- Tag filters on result panel

## What is still stubbed
- Live cTrader WV Plugin SDK market data requests in `sdk.js`
- Live symbol universe loading from cTrader instead of demo arrays

## Next code step
Replace the `getSymbolsForMarket()` and `getBars()` functions in `sdk.js` with real cTrader WV Plugin SDK calls based on the exact SDK methods from the latest cTrader docs.
