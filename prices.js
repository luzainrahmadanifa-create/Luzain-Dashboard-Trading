// Vercel Serverless Function: harga harian Kompas100 dari Yahoo Finance.
// Daftar konstituen KOMPAS100 periode 3 Agu 2026 - 29 Jan 2027 (BEI). Perbarui tiap Feb & Agu.
const TICKERS = "AADI ACES ADMR ADRO AKRA AMMN AMRT ANTM ARCI ARTO ASII BBCA BBNI BBRI BBTN BBYB BFIN BIPI BKSL BMRI BNBR BRIS BRMS BRPT BSDE BUKA BULL BUMI BUVA CBDK CMRY COIN CPIN CTRA CUAN DEWA DSNG ELSA EMAS EMTK ENRG ERAA ESSA EXCL GGRM GOTO HEAL HRTA HRUM ICBP IMPC INCO INDF INDY INET INKP ISAT ITMG JPFA JSMR KIJA KLBF KPIG LSIP MAPA MAPI MBMA MDKA MEDC MIKA MINA MYOR NCKL PANI PGAS PGEO PNLF PSAB PTBA PTRO PWON RAJA RATU RMKE SCMA SGER SMGR SMIL SMRA SSIA TAPG TINS TLKM TOBA TOWR TPIA UNTR UNVR WIFI WIRG".split(' ').map(s => s + '.JK');
const DEFAULT_RANGE = '3y'; // opsi: 1y, 2y, 3y, 5y (5y bisa mendekati batas 4,5 MB respons Vercel)

async function fetchOne(sym, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=1d&includePrePost=false`;
  for (let k = 0; k < 2; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; luzain-dashboard)', Accept: 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j.chart && j.chart.result && j.chart.result[0];
      if (!res) return null;
      const q = res.indicators.quote[0], ts = res.timestamp || [];
      const o = { t: [], o: [], h: [], l: [], c: [] };
      for (let i = 0; i < ts.length; i++) {
        if ([q.open[i], q.high[i], q.low[i], q.close[i]].some(v => v == null)) continue;
        o.t.push(Math.floor(ts[i] / 86400));
        o.o.push(Math.round(q.open[i])); o.h.push(Math.round(q.high[i]));
        o.l.push(Math.round(q.low[i]));  o.c.push(Math.round(q.close[i]));
      }
      return o;
    } catch (e) { /* coba lagi */ }
  }
  return null;
}

module.exports = async (req, res) => {
  const range = ['1y', '2y', '3y', '5y'].includes(req.query.range) ? req.query.range : DEFAULT_RANGE;
  const data = {}, failed = [];
  let idx = 0;
  async function worker() {
    while (idx < TICKERS.length) {
      const s = TICKERS[idx++];
      const d = await fetchOne(s, range);
      if (d && d.t.length > 60) data[s] = d; else failed.push(s);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  // Cache CDN 15 menit: data selalu segar tiap hari tanpa cron.
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  res.status(200).json({ updated: new Date().toISOString(), count: Object.keys(data).length, failed, data });
};
