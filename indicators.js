
window.ScreenerIndicators = (function () {
  function getSupertrendState(bars, atrLength, multiplier) {
    if (!bars || bars.length < Math.max(atrLength + 5, 20)) return 0;
    const count = bars.length;
    const tr = new Array(count).fill(0);
    const atr = new Array(count).fill(0);
    const upperBand = new Array(count).fill(0);
    const lowerBand = new Array(count).fill(0);
    const superTrend = new Array(count).fill(0);
    const trendDirection = new Array(count).fill(0);

    for (let i = 1; i < count; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;
      tr[i] = Math.max(high - low, Math.max(Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }

    const atrSeedEnd = Math.min(atrLength, count - 1);
    if (atrSeedEnd <= 1) return 0;

    let firstAtr = 0;
    for (let i = 1; i <= atrSeedEnd; i++) firstAtr += tr[i];
    firstAtr /= atrLength;
    atr[atrSeedEnd] = firstAtr;

    for (let i = atrSeedEnd + 1; i < count; i++) {
      atr[i] = ((atr[i - 1] * (atrLength - 1)) + tr[i]) / atrLength;
    }

    for (let i = 1; i < count; i++) {
      if (atr[i] === 0) continue;
      const hl2 = (bars[i].high + bars[i].low) / 2;
      const basicUpperBand = hl2 + multiplier * atr[i];
      const basicLowerBand = hl2 - multiplier * atr[i];

      if (i === 1 || upperBand[i - 1] === 0 || lowerBand[i - 1] === 0) {
        upperBand[i] = basicUpperBand;
        lowerBand[i] = basicLowerBand;
        trendDirection[i] = 1;
        superTrend[i] = lowerBand[i];
        continue;
      }

      const prevUpperBand = upperBand[i - 1];
      const prevLowerBand = lowerBand[i - 1];
      const prevClose = bars[i - 1].close;
      const close = bars[i].close;

      upperBand[i] = (basicUpperBand < prevUpperBand || prevClose > prevUpperBand) ? basicUpperBand : prevUpperBand;
      lowerBand[i] = (basicLowerBand > prevLowerBand || prevClose < prevLowerBand) ? basicLowerBand : prevLowerBand;

      const prevSuperTrend = superTrend[i - 1];
      const wasDownTrend = Math.abs(prevSuperTrend - prevUpperBand) < 1e-10;
      const wasUpTrend = Math.abs(prevSuperTrend - prevLowerBand) < 1e-10;

      if (wasDownTrend) trendDirection[i] = close > upperBand[i] ? 1 : -1;
      else if (wasUpTrend) trendDirection[i] = close < lowerBand[i] ? -1 : 1;
      else trendDirection[i] = trendDirection[i - 1];

      superTrend[i] = trendDirection[i] === 1 ? lowerBand[i] : upperBand[i];
    }

    const closedIndex = count - 2;
    if (closedIndex < 1) return 0;
    return trendDirection[closedIndex];
  }

  function getHtfAdxLabel(bars, adxPeriod) {
    if (!bars || bars.length < adxPeriod + 5) return 'NiLL';
    const dms = calculateDms(bars, adxPeriod);
    const index = bars.length - 2;
    if (index < 1 || !dms.adx[index]) return 'NiLL';

    const adx = dms.adx[index];
    const diPlus = dms.diPlus[index];
    const diMinus = dms.diMinus[index];
    if (Math.abs(diPlus - diMinus) < 1e-10) return 'NiLL';

    const direction = diPlus > diMinus ? 'Bull' : 'Bear';
    let strength = 'NiLL';
    if (adx <= 20) strength = 'Ranged';
    else if (adx <= 25) strength = 'Weak';
    else if (adx <= 50) strength = 'Strong';
    else strength = 'Mature';
    return `${strength} ${direction}`;
  }

  function calculateDms(bars, period) {
    const len = bars.length;
    const tr = new Array(len).fill(0);
    const plusDM = new Array(len).fill(0);
    const minusDM = new Array(len).fill(0);
    const trSmoothed = new Array(len).fill(0);
    const plusSmoothed = new Array(len).fill(0);
    const minusSmoothed = new Array(len).fill(0);
    const diPlus = new Array(len).fill(0);
    const diMinus = new Array(len).fill(0);
    const dx = new Array(len).fill(0);
    const adx = new Array(len).fill(0);

    for (let i = 1; i < len; i++) {
      const upMove = bars[i].high - bars[i - 1].high;
      const downMove = bars[i - 1].low - bars[i].low;
      plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
      minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
      tr[i] = Math.max(
        bars[i].high - bars[i].low,
        Math.max(Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close))
      );
    }

    let trSeed = 0, plusSeed = 0, minusSeed = 0;
    for (let i = 1; i <= period && i < len; i++) {
      trSeed += tr[i];
      plusSeed += plusDM[i];
      minusSeed += minusDM[i];
    }
    if (len <= period + 1) return { adx, diPlus, diMinus };

    trSmoothed[period] = trSeed;
    plusSmoothed[period] = plusSeed;
    minusSmoothed[period] = minusSeed;

    for (let i = period + 1; i < len; i++) {
      trSmoothed[i] = trSmoothed[i - 1] - (trSmoothed[i - 1] / period) + tr[i];
      plusSmoothed[i] = plusSmoothed[i - 1] - (plusSmoothed[i - 1] / period) + plusDM[i];
      minusSmoothed[i] = minusSmoothed[i - 1] - (minusSmoothed[i - 1] / period) + minusDM[i];
      diPlus[i] = trSmoothed[i] === 0 ? 0 : (100 * plusSmoothed[i] / trSmoothed[i]);
      diMinus[i] = trSmoothed[i] === 0 ? 0 : (100 * minusSmoothed[i] / trSmoothed[i]);
      const denom = diPlus[i] + diMinus[i];
      dx[i] = denom === 0 ? 0 : (100 * Math.abs(diPlus[i] - diMinus[i]) / denom);
    }

    let dxSeed = 0;
    const adxStart = period * 2;
    for (let i = period + 1; i <= adxStart && i < len; i++) dxSeed += dx[i];
    if (adxStart < len) adx[adxStart] = dxSeed / period;

    for (let i = adxStart + 1; i < len; i++) {
      adx[i] = ((adx[i - 1] * (period - 1)) + dx[i]) / period;
    }

    return { adx, diPlus, diMinus };
  }

  return { getSupertrendState, getHtfAdxLabel };
})();
