
window.SCREENER_CONFIG = {
  markets: {
    US: { suffix: '.US', exchanges: ['NYSE', 'NASDAQ', 'AMEX'] },
    EU: { suffix: '.EU', exchanges: ['XETR', 'EURONEXT', 'FWB'] },
    UK: { suffix: '.UK', exchanges: ['LSE'] },
    DE: { suffix: '.DE', exchanges: ['XETR', 'FWB'] }
  },
  timeframes: ['Minute5', 'Minute15', 'Minute30', 'Hour', 'Hour4', 'Daily', 'Weekly'],
  sentiments: ['Any', 'Bullish', 'Bearish'],
  timeframeToTv: {
    Minute5: '5',
    Minute15: '15',
    Minute30: '30',
    Hour: '60',
    Hour4: '240',
    Daily: '1D',
    Weekly: '1W'
  },
  adxTagRank: {
    'Strong Bull': 1,
    'Weak Bull': 2,
    'Mature Bull': 3,
    'Ranged Bull': 4,
    'Strong Bear': 5,
    'Weak Bear': 6,
    'Mature Bear': 7,
    'Ranged Bear': 8,
    'NiLL': 9
  },
  demoSymbolsByMarket: {
    US: ['AAPL.US','MSFT.US','NVDA.US','TSLA.US','META.US','AMD.US','PLTR.US','AMZN.US','GOOGL.US','JPM.US'],
    EU: ['ADS.EU','MC.EU','RMS.EU','AIR.EU','SAN.EU','OR.EU'],
    UK: ['BARC.UK','VOD.UK','SHEL.UK','BP.UK','HSBA.UK'],
    DE: ['SAP.DE','BMW.DE','SIE.DE','ALV.DE','MBG.DE']
  }
};
