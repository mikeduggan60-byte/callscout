import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg0:#07090f;--bg1:#0b0f1c;--bg2:#0f1624;--bg3:#16202f;--bg4:#1c2a3d;
  --border:#1a2540;--border2:#223050;
  --green:#00e676;--gdim:rgba(0,230,118,.11);--gglow:rgba(0,230,118,.25);
  --amber:#ffa726;--adim:rgba(255,167,38,.12);
  --red:#ef5350;--rdim:rgba(239,83,80,.1);
  --blue:#42a5f5;--bdim:rgba(66,165,245,.1);
  --t1:#e2eaf8;--t2:#7a8ba0;--t3:#3d5068;
  --mono:'IBM Plex Mono',monospace;--ui:'Sora',sans-serif;
}
html,body{background:var(--bg0);color:var(--t1);font-family:var(--ui);min-height:100%;}
input,button{font-family:var(--ui);}
input{
  background:var(--bg0);border:1px solid var(--border2);color:var(--t1);
  font-family:var(--mono);padding:10px 14px;border-radius:6px;outline:none;
  font-size:14px;transition:border-color .2s,box-shadow .2s;width:100%;
}
input:focus{border-color:var(--green);box-shadow:0 0 0 3px var(--gdim);}
input::placeholder{color:var(--t3);}
.btn{border:none;border-radius:6px;cursor:pointer;transition:all .18s;font-weight:600;letter-spacing:.3px;}
.btn-p{background:var(--green);color:#07090f;padding:11px 26px;font-size:14px;}
.btn-p:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 6px 22px var(--gglow);}
.btn-p:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none;filter:none;}
.btn-g{background:transparent;border:1px solid var(--border2);color:var(--t2);padding:8px 16px;font-size:13px;}
.btn-g:hover{border-color:var(--green);color:var(--green);}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;}
.pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:.5px;font-family:var(--mono);text-transform:uppercase;}
.pg{color:var(--green);background:var(--gdim);}
.pa{color:var(--amber);background:var(--adim);}
.pr{color:var(--red);background:var(--rdim);}
.pb{color:var(--blue);background:var(--bdim);}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.fu{animation:fadeUp .3s ease forwards;}
.skel{background:linear-gradient(90deg,var(--bg2) 25%,var(--bg3) 50%,var(--bg2) 75%);background-size:600px 100%;animation:shimmer 1.6s infinite;border-radius:8px;}
.spin{animation:spin .7s linear infinite;}
.scroll{overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--border2) transparent;}
.scroll::-webkit-scrollbar{height:4px;width:4px;}
.scroll::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
`;

// ─────────────────────────────────────────────
// SEEDED RNG & MOCK DATA
// ─────────────────────────────────────────────
// Fallback prices used only if Yahoo Finance is unreachable
const FALLBACK_PRICES = {
  NVDA:120,AAPL:195,TSLA:250,AMD:105,META:580,MSFT:450,AMZN:205,GOOGL:175,
  NFLX:680,CRM:320,UBER:82,COIN:230,PLTR:26,SOFI:9,RBLX:44,SHOP:82,
  BABA:90,NIO:5,SNAP:10,HOOD:20,RIVN:12,LCID:3,GME:22,AMC:4,
};

// ─── Yahoo Finance price fetching (via /api/price proxy) ───────────────
async function fetchYahooPrice(ticker) {
  try {
    const r = await fetch(`/api/price?ticker=${ticker}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.price ? d : null;
  } catch { return null; }
}

async function fetchYahooPrices(tickers) {
  const results = await Promise.all(tickers.map(async t => {
    const data = await fetchYahooPrice(t);
    return { ticker: t, data };
  }));
  const map = {};
  results.forEach(({ ticker, data }) => {
    if (data) map[ticker] = data;
  });
  return map;
}

function seededRng(seed) {
  let h = 0;
  for (const c of String(seed)) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}

function buildChain(ticker, price) {
  const rng = seededRng(ticker + Math.floor(price));
  const today = new Date();
  const exps = [];
  for (const days of [7, 14, 30, 45, 60, 90]) {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    const dte = Math.round((d - today) / 86400000);
    const strikes = [];
    for (let pct = 0.78; pct <= 1.22; pct += 0.02) {
      const strike = Math.round(price * pct / 5) * 5;
      const m = strike / price;
      const delta = Math.max(0.04, Math.min(0.96, 0.5 + (1 - m) * 2.6 + rng() * 0.04 - 0.02));
      const iv = Math.max(0.15, Math.min(0.9, 0.22 + Math.abs(m - 1) * 0.2 + rng() * 0.05));
      const intrinsic = Math.max(0, price - strike);
      const tv = price * iv * Math.sqrt(dte / 365) * delta * 0.42;
      const mid = intrinsic + tv;
      const spread = Math.max(0.05, mid * 0.025 + 0.03);
      const bid = Math.max(0.01, mid - spread / 2);
      const ask = mid + spread / 2;
      const isATM = Math.abs(m - 1) < 0.03;
      const vol = isATM ? Math.floor(rng() * 9000 + 2000) : Math.floor(rng() * 3000 + 50);
      const theta = -(mid * iv * 0.013 * Math.sqrt(365 / (dte + 1)));
      const gamma = (delta * (1 - delta)) / (price * iv * Math.sqrt(dte / 365) + 0.001);
      const vega = price * Math.sqrt(dte / 365) * 0.004;
      strikes.push({
        strike, atm: isATM, dte,
        bid: +bid.toFixed(2), ask: +ask.toFixed(2), last: +mid.toFixed(2),
        delta: +delta.toFixed(3), gamma: +gamma.toFixed(5),
        theta: +theta.toFixed(3), vega: +vega.toFixed(3),
        iv: +(iv * 100).toFixed(1),
        volume: vol, oi: vol * (2 + Math.floor(rng() * 10)),
        breakeven: +(strike + ask).toFixed(2),
      });
    }
    exps.push({ date: d.toISOString().slice(0, 10), dte, strikes });
  }
  return exps;
}

// ─────────────────────────────────────────────
// API LAYER
// ─────────────────────────────────────────────
// ─── Tradier API ─────────────────────────────
const TRADIER = 'https://api.tradier.com/v1';

async function tradier_validate(token) {
  try {
    const r = await fetch(`${TRADIER}/markets/quotes?symbols=SPY`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!r.ok) return { ok: false, msg: `Invalid token (${r.status})` };
    const d = await r.json();
    return d?.quotes?.quote ? { ok: true } : { ok: false, msg: 'Token accepted but no data returned' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

async function tradier_full_chain(symbol, token, stockPrice) {
  try {
    // Step 1: get expirations
    const expR = await fetch(
      `${TRADIER}/markets/options/expirations?symbol=${symbol}&includeAllRoots=true`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!expR.ok) return null;
    const expData = await expR.json();
    const rawDates = expData?.expirations?.date;
    if (!rawDates) return null;
    const dates = (Array.isArray(rawDates) ? rawDates : [rawDates]).slice(0, 6);

    // Step 2: fetch all chains in parallel
    const today = new Date();
    const chains = await Promise.all(dates.map(date =>
      fetch(`${TRADIER}/markets/options/chains?symbol=${symbol}&expiration=${date}&greeks=true`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }).then(r => r.ok ? r.json() : null).catch(() => null)
    ));

    // Step 3: transform to internal format
    const expirations = [];
    dates.forEach((date, i) => {
      const data = chains[i];
      if (!data?.options?.option) return;
      const opts = Array.isArray(data.options.option) ? data.options.option : [data.options.option];
      const calls = opts.filter(o => o.option_type === 'call' && o.strike && o.ask != null);
      if (!calls.length) return;
      const exp = new Date(date + 'T12:00:00');
      const dte = Math.max(0, Math.round((exp - today) / 86400000));
      const strikes = calls
        .sort((a, b) => a.strike - b.strike)
        .map(c => ({
          strike: c.strike,
          atm: stockPrice ? Math.abs(c.strike - stockPrice) / stockPrice < 0.025 : false,
          dte,
          bid: +(c.bid || 0).toFixed(2),
          ask: +(c.ask || 0).toFixed(2),
          last: +(c.last || 0).toFixed(2),
          delta: c.greeks?.delta != null ? +c.greeks.delta.toFixed(3) : '—',
          gamma: c.greeks?.gamma != null ? +c.greeks.gamma.toFixed(5) : '—',
          theta: c.greeks?.theta != null ? +c.greeks.theta.toFixed(3) : '—',
          vega:  c.greeks?.vega  != null ? +c.greeks.vega.toFixed(3)  : '—',
          iv: c.greeks?.mid_iv   != null ? +(c.greeks.mid_iv * 100).toFixed(1) : '—',
          volume: c.volume || 0,
          oi: c.open_interest || 0,
          breakeven: +(c.strike + (c.ask || 0)).toFixed(2),
        }));
      if (strikes.length) expirations.push({ date, dte, strikes });
    });
    return expirations.length ? expirations : null;
  } catch (e) { console.error('Tradier chain error:', e); return null; }
}

async function reddit_trending() {
  try {
    const r = await fetch('/api/reddit?path=r/wallstreetbets/hot.json%3Flimit%3D30');
    if (!r.ok) return [];
    const d = await r.json();
    const SKIP = new Set('THE AND FOR ARE BUT NOT YOU ALL CAN WAS ONE OUR OUT DAY GET HAS HOW ITS NEW NOW SEE TWO WAY WHO DID MAY PUT SAY TOO USE WSB DD IMO LOL ETF CEO IPO EPS ATH GPU USA EUR GDP FED SEC YTD YOLO EDIT THIS WITH FROM THEY BEEN HAVE WILL WHAT WHEN THEN THAT INTO SOME ALSO JUST OVER LIKE BACK ONLY VERY EVEN HIGH MUCH GOOD KEEP LAST LONG MADE MAKE MANY MOVE NEED NEXT KNOW COME BULL BEAR CALL PUTS HODL FOMO ATM OTM ITM PLAY HUGE BOND RATE ZERO HOLD SELL MORE LESS BOTH EACH DOWN WENT LOST GAIN SOLD PAID HITS BUY SPY QQQ IWM VIX SPX NDX'.split(' '));
    const counts = {};
    d.data?.children?.forEach(c => {
      (c.data.title.match(/\b([A-Z]{2,5})\b/g) || []).forEach(t => {
        if (!SKIP.has(t)) counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([ticker, mentions]) => ({ ticker, mentions }));
  } catch { return []; }
}

async function reddit_search(ticker) {
  const subs = ['wallstreetbets', 'options', 'stocks'];
  const posts = [];
  for (const sub of subs) {
    try {
      const path = `r/${sub}/search.json%3Fq%3D${encodeURIComponent(ticker)}%26sort%3Dhot%26limit%3D5%26restrict_sr%3Don%26t%3Dweek`;
      const r = await fetch(`/api/reddit?path=${path}`);
      if (!r.ok) continue;
      const d = await r.json();
      d.data?.children?.forEach(c => posts.push({
        title: c.data.title, score: c.data.score,
        comments: c.data.num_comments,
        url: `https://reddit.com${c.data.permalink}`,
        sub, flair: c.data.link_flair_text,
      }));
    } catch { /* continue */ }
  }
  return posts.sort((a, b) => b.score - a.score);
}

async function st_trending() {
  try {
    const r = await fetch('/api/stocktwits?path=trending/symbols.json');
    if (!r.ok) return [];
    const d = await r.json();
    return (d.response?.symbols || []).map(s => s.symbol);
  } catch { return []; }
}

async function st_sentiment(ticker) {
  try {
    const r = await fetch(`/api/stocktwits?path=streams/symbol/${ticker}.json`);
    if (!r.ok) return null;
    const d = await r.json();
    const msgs = d.messages || [];
    const bull = msgs.filter(m => m.entities?.sentiment?.basic === 'Bullish').length;
    const bear = msgs.filter(m => m.entities?.sentiment?.basic === 'Bearish').length;
    const total = bull + bear;
    return {
      bullPct: total > 0 ? Math.round((bull / total) * 100) : 50,
      messages: msgs.slice(0, 6).map(m => ({
        body: m.body, sentiment: m.entities?.sentiment?.basic || null, user: m.user?.username,
      })),
    };
  } catch { return null; }
}

async function claude_home_recs(tickers) {
  try {
    const r = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are a concise options research assistant. Today is ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.

These tickers are currently trending on Reddit/StockTwits: ${tickers.join(', ')}.

Select the 3 most interesting for a LONG CALL play. Use realistic, current option pricing. Return ONLY a valid JSON array — no markdown fences, no preamble:

[{
  "ticker": "NVDA",
  "price": 875,
  "strike": 880,
  "expiry": "2025-07-18",
  "dte": 30,
  "ask": 28.50,
  "delta": 0.48,
  "breakeven": 908.50,
  "confidence": "HIGH",
  "tag": "Momentum",
  "thesis": "2-3 clear sentences on why this call is attractive right now, mentioning a specific catalyst or pattern.",
  "risk": "One sentence describing the key risk for this position."
}]`,
        }],
      }),
    });
    const d = await r.json();
    console.log('Claude home response:', JSON.stringify(d).slice(0, 200));
    const txt = d.content?.find(c => c.type === 'text')?.text || '[]';
    return JSON.parse(txt.replace(/```json|```/g, '').trim());
  } catch (e) { console.error('Claude home recs error:', e); return []; }
}

async function claude_ticker_recs(ticker, price, chain, posts, stData, maxCost = null) {
  try {
    // If a budget is set, filter the sample to only include contracts within budget
    const maxAsk = maxCost ? maxCost / 100 : null;
    const sample = chain.slice(0, 4).flatMap(e =>
      e.strikes
        .filter((_, i) => i % 3 === 1)
        .filter(s => maxAsk === null || s.ask <= maxAsk)
        .slice(0, 5)
        .map(s => ({
          expiry: e.date, dte: e.dte, strike: s.strike,
          ask: s.ask, contractCost: Math.round(s.ask * 100),
          delta: s.delta, iv: s.iv,
          volume: s.volume, oi: s.oi, breakeven: s.breakeven, theta: s.theta,
        }))
    );
    const rdSnip = posts.slice(0, 5).map(p => `r/${p.sub}: "${p.title}" (${p.score}↑)`).join('\n') || 'No recent posts found.';
    const budgetLine = maxCost
      ? `HARD BUDGET CONSTRAINT: Only recommend contracts where ask × 100 ≤ $${maxCost}. Do not suggest any contract costing more than $${maxCost} total.`
      : '';

    const r = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1400,
        messages: [{
          role: 'user',
          content: `You are a concise options research assistant. Today: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.

Stock: ${ticker} at $${price}
${budgetLine}

Sample call options data (contractCost = ask × 100):
${JSON.stringify(sample, null, 2)}

Reddit posts this week:
${rdSnip}

StockTwits: ${stData?.bullPct ?? 'N/A'}% bullish sentiment

Identify the TOP 3 most interesting LONG CALL contracts from the data above${maxCost ? ` that cost $${maxCost} or less per contract` : ''}. Return ONLY a valid JSON array — no markdown, no extra text:

[{
  "rank": 1,
  "strike": 190,
  "expiry": "2025-07-18",
  "dte": 30,
  "ask": 5.20,
  "delta": 0.48,
  "breakeven": 195.20,
  "confidence": "HIGH",
  "tag": "Momentum",
  "thesis": "2-3 sentences explaining why this specific contract looks attractive, referencing delta, pricing, or sentiment.",
  "risk": "Single most important risk for this position."
}]`,
        }],
      }),
    });
    const d = await r.json();
    const txt = d.content?.find(c => c.type === 'text')?.text || '[]';
    return JSON.parse(txt.replace(/```json|```/g, '').trim());
  } catch (e) { console.error('Claude rec error:', e); return []; }
}

// ─────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────
function Spinner({ size = 14, color = 'var(--green)' }) {
  return (
    <div className="spin" style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid var(--border2)`, borderTopColor: color,
      display: 'inline-block', flexShrink: 0,
    }} />
  );
}

function LiveDot() {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: 'var(--green)', animation: 'blink 1.4s ease infinite',
    }} />
  );
}

// ─────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────
function LoginScreen({ onLogin, busy, err }) {
  const [token, setToken] = useState('');
  const go = () => !busy && token.trim() && onLogin(token.trim());

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(0,230,118,.06) 0%, transparent 65%)',
    }}>
      <style>{CSS}</style>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--green)', letterSpacing: 5, marginBottom: 16, opacity: .8 }}>
            OPTIONS RESEARCH TERMINAL
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>
            Call<span style={{ color: 'var(--green)' }}>Scout</span>
          </div>
          <div style={{ color: 'var(--t2)', fontSize: 14, marginTop: 10, fontWeight: 300 }}>
            AI-powered long call research · Live options chains via Tradier
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)', letterSpacing: 2, marginBottom: 8 }}>
              TRADIER API TOKEN
            </label>
            <input
              type="password" value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && go()}
              placeholder="Paste your Tradier access token..."
              style={{ fontFamily: 'var(--mono)', letterSpacing: token ? 2 : 0 }}
            />
          </div>

          {/* How to get token */}
          <div style={{ marginBottom: 26, padding: '10px 12px', background: 'var(--bg1)', borderRadius: 6, fontSize: 12, color: 'var(--t3)', lineHeight: 1.7 }}>
            Don't have a token?{' '}
            <a href="https://tradier.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', textDecoration: 'none' }}>Open a free Tradier account</a>
            {' '}→ click your name (top right) → <span style={{ color: 'var(--t2)' }}>API Access</span> → copy your Production Access Token.
            <br />Requires a Tradier brokerage account for live data.
          </div>

          {err && (
            <div style={{ background: 'var(--rdim)', border: '1px solid rgba(239,83,80,.2)', borderRadius: 6, padding: '10px 14px', marginBottom: 18, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
              {err}
            </div>
          )}

          <button className="btn btn-p" style={{ width: '100%' }} onClick={go} disabled={busy || !token.trim()}>
            {busy
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner size={13} color="#07090f" /> VERIFYING TOKEN...</span>
              : 'CONNECT TO TRADIER'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="btn btn-g" style={{ fontSize: 12 }} onClick={() => onLogin('demo')}>
              Try Demo Mode (synthetic chain)
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)', lineHeight: 2 }}>
          Token used this session only · Never stored · Research purposes only
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TOP BAR
// ─────────────────────────────────────────────
function TopBar({ onHome, onSearch, username, demo, liveChain }) {
  const [val, setVal] = useState('');
  const submit = () => { const t = val.trim().toUpperCase(); if (t) { onSearch(t); setVal(''); } };
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50, height: 54,
      background: 'rgba(7,9,15,.96)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border)', display: 'flex',
      alignItems: 'center', gap: 14, padding: '0 20px',
    }}>
      <button onClick={onHome} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: 'var(--t1)', flexShrink: 0, letterSpacing: -0.5 }}>
        Call<span style={{ color: 'var(--green)' }}>Scout</span>
      </button>
      {liveChain
        ? <span className="pill pg" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><LiveDot />LIVE</span>
        : demo && <span className="pill pa">DEMO</span>}
      <div style={{ display: 'flex', gap: 6, flex: 1, maxWidth: 300 }}>
        <input
          value={val} onChange={e => setVal(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="SEARCH TICKER..." style={{ padding: '6px 12px', fontSize: 13, textTransform: 'uppercase' }}
        />
        <button className="btn btn-p" style={{ padding: '6px 14px', fontSize: 12, flexShrink: 0 }} onClick={submit}>GO</button>
      </div>
      <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t3)' }}>{username}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HOME SCREEN
// ─────────────────────────────────────────────
function TickerChip({ ticker, mentions, price, changePct, live, onClick }) {
  const [hov, setHov] = useState(false);
  const hasChange = changePct != null;
  const up = changePct >= 0;
  return (
    <button onClick={() => onClick(ticker)} className="card" style={{
      border: `1px solid ${hov ? 'var(--green)' : 'var(--border)'}`,
      padding: '14px 16px', cursor: 'pointer', textAlign: 'left', position: 'relative',
      background: hov ? 'var(--bg3)' : 'var(--bg2)', width: '100%', transition: 'all .18s',
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {live && <span style={{ position: 'absolute', top: 8, right: 8, width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'block' }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600 }}>{ticker}</span>
        {price
          ? <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--t1)' }}>${typeof price === 'number' ? price.toFixed(2) : price}</span>
          : <span className="skel" style={{ width: 52, height: 13, display: 'inline-block' }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>
          {mentions > 0 ? `${mentions} mentions` : 'trending'}
        </span>
        {hasChange
          ? <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: up ? 'var(--green)' : 'var(--red)' }}>
              {up ? '+' : ''}{changePct}%
            </span>
          : <span className="skel" style={{ width: 34, height: 11, display: 'inline-block' }} />}
      </div>
    </button>
  );
}

function HomeRecCard({ rec, onSelect }) {
  const [hov, setHov] = useState(false);
  const conf = (rec.confidence || '').toUpperCase();
  const cc = conf === 'HIGH' ? 'pg' : conf === 'MEDIUM' ? 'pa' : 'pr';
  return (
    <div className={`card fu`} onClick={() => onSelect(rec.ticker)} style={{
      padding: 22, cursor: 'pointer',
      border: `1px solid ${hov ? 'var(--green)' : 'var(--border)'}`, transition: 'border-color .18s',
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600 }}>{rec.ticker}</span>
          <span className={`pill ${cc}`}>{conf}</span>
          {rec.tag && <span className="pill pb">{rec.tag}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--green)', marginBottom: 2 }}>${rec.ask}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>ASK · ${rec.strike}C · {rec.dte}DTE</div>
        </div>
      </div>
      <p style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>{rec.thesis}</p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, fontFamily: 'var(--mono)' }}>
        {[['DELTA', rec.delta], ['BREAKEVEN', `$${rec.breakeven}`], ['EXPIRY', rec.expiry]].map(([l, v]) => (
          <span key={l}><span style={{ color: 'var(--t3)', fontSize: 9, letterSpacing: 1 }}>{l} </span>{v}</span>
        ))}
        <span><span style={{ color: 'var(--red)', fontSize: 9, letterSpacing: 1 }}>RISK </span><span style={{ color: 'var(--t2)' }}>{rec.risk}</span></span>
      </div>
    </div>
  );
}

function HomeScreen({ onSearch, trending, homeRecs, loading }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px' }}>
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Market Overview</h2>
        <p style={{ color: 'var(--t2)', fontSize: 13 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {' · '}Live trends from Reddit & StockTwits
        </p>
      </div>

      {/* Trending */}
      <section style={{ marginBottom: 38 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h3 style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)', letterSpacing: 2 }}>TRENDING NOW</h3>
          {loading && <Spinner size={11} />}
          {!loading && trending.length > 0 && <LiveDot />}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
          {trending.length > 0
            ? trending.map(t => <TickerChip key={t.ticker} {...t} onClick={onSearch} />)
            : Array(9).fill(0).map((_, i) => <div key={i} className="skel" style={{ height: 72 }} />)}
        </div>
      </section>

      {/* AI Recs */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h3 style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)', letterSpacing: 2 }}>AI-RECOMMENDED CALLS</h3>
          {!loading && homeRecs.length > 0 && <><span className="pill pg">LIVE</span><LiveDot /></>}
          {loading && <Spinner size={11} />}
        </div>
        {homeRecs.length > 0
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {homeRecs.map((r, i) => <HomeRecCard key={i} rec={r} onSelect={onSearch} />)}
            </div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[180, 180, 180].map((h, i) => <div key={i} className="skel" style={{ height: h }} />)}
              <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t3)', paddingTop: 4 }}>
                AI analyzing trending tickers and current options pricing...
              </div>
            </div>}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// OPTIONS CHAIN
// ─────────────────────────────────────────────
function Chain({ expirations, price }) {
  const [expIdx, setExpIdx] = useState(2);
  const [hl, setHl] = useState(null);
  if (!expirations?.length) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Building chain...</div>;
  const exp = expirations[Math.min(expIdx, expirations.length - 1)];
  const COL = ['STRIKE', 'BID', 'ASK', 'LAST', 'Δ DELTA', 'θ THETA', 'IV %', 'VOLUME', 'OPEN INT', 'BREAKEVEN'];
  return (
    <div>
      <div className="scroll" style={{ display: 'flex', gap: 8, marginBottom: 18, paddingBottom: 4 }}>
        {expirations.map((e, i) => (
          <button key={e.date} onClick={() => { setExpIdx(i); setHl(null); }} className="btn" style={{
            background: expIdx === i ? 'var(--green)' : 'var(--bg3)',
            color: expIdx === i ? '#07090f' : 'var(--t2)',
            border: `1px solid ${expIdx === i ? 'var(--green)' : 'var(--border2)'}`,
            padding: '5px 14px', fontSize: 12, fontFamily: 'var(--mono)', whiteSpace: 'nowrap',
            fontWeight: expIdx === i ? 600 : 400,
          }}>
            {e.date} <span style={{ opacity: .6 }}>({e.dte}d)</span>
          </button>
        ))}
      </div>
      <div className="scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {COL.map(h => <th key={h} style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--t3)', fontSize: 10, fontWeight: 500, letterSpacing: .4, whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {exp.strikes.map((s, i) => {
              const isHL = hl === i;
              const bg = isHL ? 'rgba(0,230,118,.1)' : s.atm ? 'rgba(0,230,118,.04)' : 'transparent';
              return (
                <tr key={s.strike} onClick={() => setHl(isHL ? null : i)} style={{ background: bg, borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                  onMouseEnter={e => { if (!isHL) e.currentTarget.style.background = 'rgba(255,255,255,.025)'; }}
                  onMouseLeave={e => { if (!isHL) e.currentTarget.style.background = s.atm ? 'rgba(0,230,118,.04)' : 'transparent'; }}>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: s.atm ? 'var(--green)' : 'var(--t1)', fontWeight: s.atm ? 600 : 400 }}>
                    ${s.strike}{s.atm && <span style={{ fontSize: 8, marginLeft: 4, opacity: .6 }}>ATM</span>}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--t2)' }}>{s.bid.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{s.ask.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--t2)' }}>{s.last.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: s.delta > .5 ? 'var(--green)' : s.delta < .25 ? 'var(--t3)' : 'var(--t1)' }}>{s.delta.toFixed(3)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--red)' }}>{s.theta.toFixed(3)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: s.iv > 45 ? 'var(--amber)' : 'var(--t2)' }}>{s.iv}%</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: s.volume > 1000 ? 'var(--green)' : 'var(--t2)' }}>{s.volume.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--t2)' }}>{s.oi.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--t2)' }}>${s.breakeven.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>
        Click any row to highlight · Green row = At The Money · Amber IV = elevated volatility · Green volume = high activity
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RESEARCH RECOMMENDATIONS
// ─────────────────────────────────────────────
function RecCard({ rec, rank }) {
  const conf = (rec.confidence || '').toUpperCase();
  const clr = conf === 'HIGH' ? 'var(--green)' : conf === 'MEDIUM' ? 'var(--amber)' : 'var(--red)';
  const pc = conf === 'HIGH' ? 'pg' : conf === 'MEDIUM' ? 'pa' : 'pr';
  return (
    <div className="card fu" style={{ padding: 22, borderLeft: `3px solid ${clr}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: clr, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#07090f', flexShrink: 0 }}>
            #{rank}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600 }}>${rec.strike} CALL · {rec.expiry}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{rec.dte} days to expiration</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 20, color: 'var(--green)', marginBottom: 4 }}>${rec.ask}</div>
          <span className={`pill ${pc}`}>{conf} CONFIDENCE</span>
          {rec.tag && <span className="pill pb" style={{ marginLeft: 6 }}>{rec.tag}</span>}
        </div>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--t2)', borderLeft: '2px solid var(--border2)', paddingLeft: 14, marginBottom: 16 }}>
        {rec.thesis}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[['DELTA', rec.delta], ['BREAKEVEN', `$${rec.breakeven}`], ['CONTRACT COST', `$${rec.ask ? (rec.ask * 100).toFixed(0) : '—'}`], ['PLAY TYPE', rec.tag || '—']].map(([l, v]) => (
          <div key={l} style={{ background: 'var(--bg1)', padding: '10px 12px', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--t3)', letterSpacing: 1, marginBottom: 5 }}>{l}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--rdim)', border: '1px solid rgba(239,83,80,.15)', borderRadius: 6, padding: '9px 13px', fontSize: 12 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--red)', letterSpacing: 1 }}>⚠ KEY RISK </span>
        <span style={{ color: 'var(--t2)' }}>{rec.risk}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SENTIMENT PANEL
// ─────────────────────────────────────────────
function SentimentPanel({ reddit, stData, ticker }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {stData && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)', letterSpacing: 2, marginBottom: 16 }}>STOCKTWITS SENTIMENT · {ticker}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 600, color: stData.bullPct >= 50 ? 'var(--green)' : 'var(--red)' }}>
              {stData.bullPct}%
            </span>
            <span style={{ color: 'var(--t2)', fontSize: 14 }}>bullish sentiment</span>
          </div>
          <div style={{ height: 5, background: 'var(--bg1)', borderRadius: 3, overflow: 'hidden', marginBottom: 18 }}>
            <div style={{ height: '100%', width: `${stData.bullPct}%`, background: stData.bullPct >= 50 ? 'var(--green)' : 'var(--red)', borderRadius: 3, transition: 'width .7s ease' }} />
          </div>
          {stData.messages?.filter(m => m.body).slice(0, 4).map((m, i) => (
            <div key={i} style={{ background: 'var(--bg1)', padding: '10px 13px', borderRadius: 6, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>@{m.user}</span>
                {m.sentiment && (
                  <span className={`pill ${m.sentiment === 'Bullish' ? 'pg' : m.sentiment === 'Bearish' ? 'pr' : 'pa'}`} style={{ fontSize: 9 }}>
                    {m.sentiment}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.55 }}>{m.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)', letterSpacing: 2 }}>REDDIT DISCUSSION</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>WSB · options · stocks</span>
        </div>
        {reddit?.length > 0
          ? reddit.slice(0, 8).map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', background: 'var(--bg1)', padding: '12px 14px', borderRadius: 7, marginBottom: 8, transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg1)'}>
                <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.5, marginBottom: 7 }}>{p.title}</div>
                <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>
                  <span style={{ color: 'var(--green)' }}>▲ {p.score.toLocaleString()}</span>
                  <span>💬 {p.comments}</span>
                  <span>r/{p.sub}</span>
                  {p.flair && <span style={{ color: 'var(--amber)' }}>{p.flair}</span>}
                </div>
              </a>
            ))
          : <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
              No recent posts found for {ticker}
            </div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RESEARCH SCREEN
// ─────────────────────────────────────────────
const BUDGET_OPTIONS = [
  { label: 'All', value: null },
  { label: '< $500', value: 500 },
  { label: '< $1,000', value: 1000 },
  { label: '< $2,500', value: 2500 },
];

function ResearchScreen({ ticker, price, chain, chainLoading, liveChain, reddit, stData, sentimentLoading, recs, recsLoading, demo, onSearch, onReanalyze }) {
  const [tab, setTab] = useState('chain');
  const [budget, setBudget] = useState(null);
  const [localRecs, setLocalRecs] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);

  // Sync localRecs when parent recs change (new ticker search)
  const prevRecs = localRecs ?? recs;
  const displayRecs = localRecs ?? recs;

  const filteredRecs = budget
    ? (displayRecs || []).filter(r => r.ask * 100 <= budget)
    : displayRecs;

  const handleBudgetClick = (val) => {
    setBudget(val);
    setLocalRecs(null); // reset override — will show filtered view of existing recs
  };

  const handleReanalyze = async () => {
    setLocalLoading(true);
    const result = await onReanalyze(budget);
    setLocalRecs(result);
    setLocalLoading(false);
  };

  const isLoading = recsLoading || localLoading;
  const noMatchAfterFilter = !isLoading && budget && filteredRecs?.length === 0 && (displayRecs?.length ?? 0) > 0;
  const hasLocalOverride = localRecs !== null;

  const tabs = [
    { key: 'chain', label: 'Options Chain', loading: chainLoading },
    { key: 'recs', label: 'AI Picks', loading: isLoading },
    { key: 'sentiment', label: 'Sentiment', loading: sentimentLoading },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '22px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 700 }}>{ticker}</span>
          {price
            ? <span style={{ fontFamily: 'var(--mono)', fontSize: 24, color: 'var(--green)' }}>${price.toFixed(2)}</span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Spinner size={16} /><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--t3)' }}>fetching price...</span></span>}
          {liveChain
            ? <span className="pill pg" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LiveDot />LIVE CHAIN</span>
            : <span className="pill pa">SYNTHETIC CHAIN</span>}
          {demo && <span className="pill pa">DEMO</span>}
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className="btn" style={{
              background: tab === t.key ? 'var(--green)' : 'transparent',
              color: tab === t.key ? '#07090f' : 'var(--t2)',
              border: 'none', padding: '9px 18px', fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              {t.label}
              {t.loading && <Spinner size={11} color={tab === t.key ? '#07090f' : 'var(--green)'} />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="fu">
        {tab === 'chain' && (
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)', letterSpacing: 2 }}>CALL OPTIONS CHAIN · {ticker}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)' }}>Select expiration below · Click row to highlight</span>
            </div>
            {chainLoading
              ? <div style={{ padding: '50px 0', display: 'flex', justifyContent: 'center' }}><Spinner size={28} /></div>
              : <Chain expirations={chain} price={price} />}
          </div>
        )}

        {tab === 'recs' && (
          <div>
            {/* Budget filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--t3)', letterSpacing: 1.5, flexShrink: 0 }}>MAX BUDGET:</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BUDGET_OPTIONS.map(opt => (
                  <button key={String(opt.value)} onClick={() => handleBudgetClick(opt.value)} className="btn" style={{
                    background: budget === opt.value ? 'var(--green)' : 'var(--bg2)',
                    color: budget === opt.value ? '#07090f' : 'var(--t2)',
                    border: `1px solid ${budget === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                    padding: '5px 14px', fontSize: 12, fontFamily: 'var(--mono)', fontWeight: budget === opt.value ? 600 : 400,
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {budget && (
                <button onClick={handleReanalyze} disabled={localLoading} className="btn btn-g" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 7, marginLeft: 4 }}>
                  {localLoading ? <><Spinner size={11} /> Analyzing...</> : '⟳ Re-analyze with budget'}
                </button>
              )}
              {hasLocalOverride && !localLoading && (
                <span className="pill pg" style={{ marginLeft: 4 }}>Budget filtered</span>
              )}
            </div>

            {isLoading
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[220, 220, 220].map((h, i) => <div key={i} className="skel" style={{ height: h }} />)}
                  <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t3)', paddingTop: 4 }}>
                    {localLoading ? `Finding best calls under $${budget?.toLocaleString()} for ${ticker}...` : `Analyzing ${ticker} options chain, Greeks, and sentiment...`}
                  </div>
                </div>
              : noMatchAfterFilter
                ? <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--t2)', marginBottom: 16 }}>
                      No existing picks fit under ${budget?.toLocaleString()}.<br />
                      <span style={{ color: 'var(--t3)', fontSize: 11 }}>
                        {ticker} contracts can be pricey — a re-analyze will ask Claude to find cheaper strikes or shorter expirations.
                      </span>
                    </div>
                    <button onClick={handleReanalyze} className="btn btn-p" style={{ padding: '10px 22px', fontSize: 13 }}>
                      Re-analyze under ${budget?.toLocaleString()}
                    </button>
                  </div>
                : filteredRecs?.length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ background: 'var(--gdim)', border: '1px solid rgba(0,230,118,.15)', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: 'var(--t2)', lineHeight: 1.65 }}>
                        ⚡ Recommendations generated from options pricing, Greeks, and live market sentiment.{budget ? ` Filtered to contracts under $${budget.toLocaleString()}.` : ''} For research purposes only.
                      </div>
                      {filteredRecs.map((r, i) => <RecCard key={i} rec={r} rank={i + 1} />)}
                    </div>
                  : <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
                      No recommendations available. Try searching a different ticker.
                    </div>}
          </div>
        )}

        {tab === 'sentiment' && (
          sentimentLoading
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[200, 300].map((h, i) => <div key={i} className="skel" style={{ height: h }} />)}
              </div>
            : <SentimentPanel reddit={reddit} stData={stData} ticker={ticker} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('login');
  const [username, setUsername] = useState('');
  const [demo, setDemo] = useState(false);
  const [apiToken, setApiToken] = useState(null);
  const [liveChain, setLiveChain] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState(null);

  // Home state
  const [trending, setTrending] = useState([]);
  const [homeRecs, setHomeRecs] = useState([]);
  const [homeLoading, setHomeLoading] = useState(false);

  // Research state
  const [ticker, setTicker] = useState('');
  const [price, setPrice] = useState(null);
  const [chain, setChain] = useState(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [reddit, setReddit] = useState(null);
  const [stData, setStData] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [recs, setRecs] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);

  // ── Login ──
  const handleLogin = async (token) => {
    setLoginBusy(true);
    setLoginErr(null);
    if (token === 'demo') {
      setUsername('Demo Mode'); setDemo(true); setApiToken(null);
      setLiveChain(false); setScreen('home'); setLoginBusy(false); return;
    }
    const res = await tradier_validate(token);
    if (res.ok) {
      setApiToken(token); setDemo(false); setUsername('Tradier'); setScreen('home');
    } else {
      setLoginErr(res.msg || 'Token invalid. Check your Tradier API Access page.');
    }
    setLoginBusy(false);
  };

  // ── Home data ──
  useEffect(() => {
    if (screen !== 'home') return;
    const load = async () => {
      setHomeLoading(true);

      // Step 1: get trending lists — wrapped individually so one failure doesn't block the rest
      let rtData = [], stT = [];
      try { rtData = await reddit_trending(); } catch { rtData = []; }
      try { stT = await st_trending(); } catch { stT = []; }

      const map = {};
      rtData.forEach(({ ticker: t, mentions }) => { map[t] = { ticker: t, mentions, price: null, changePct: null, live: false }; });
      stT.slice(0, 10).forEach(t => { if (!map[t]) map[t] = { ticker: t, mentions: 0, price: null, changePct: null, live: false }; });
      ['NVDA','AAPL','TSLA','AMD','META','MSFT'].forEach(t => {
        if (!map[t]) map[t] = { ticker: t, mentions: 0, price: null, changePct: null, live: false };
      });
      const list = Object.values(map).slice(0, 9);

      // Show trending immediately with fallback prices
      setTrending(list.map(t => ({ ...t, price: FALLBACK_PRICES[t.ticker] || null })));

      // Step 2: fetch real prices
      let priceMap = {};
      try { priceMap = await fetchYahooPrices(list.map(t => t.ticker)); } catch { priceMap = {}; }
      const listWithPrices = list.map(t => ({
        ...t,
        price: priceMap[t.ticker]?.price ?? FALLBACK_PRICES[t.ticker] ?? null,
        changePct: priceMap[t.ticker]?.changePct ?? null,
        live: !!priceMap[t.ticker]?.live,
      }));
      setTrending(listWithPrices);

      // Step 3: AI home recs — always fire regardless of price fetch result
      const topForRecs = listWithPrices.filter(t => t.price).slice(0, 6).map(t => t.ticker);
      const recsInput = topForRecs.length >= 3
        ? topForRecs
        : ['NVDA', 'AAPL', 'TSLA', 'AMD', 'META', 'MSFT'];
      try {
        const hr = await claude_home_recs(recsInput);
        setHomeRecs(hr);
      } catch (e) { console.error('Home recs error:', e); }

      setHomeLoading(false);
    };
    load().catch(e => { console.error('Home load error:', e); setHomeLoading(false); });
  }, [screen]);

  // ── Ticker research ──
  const handleSearch = async (sym) => {
    const t = sym.trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    setPrice(null); setChain(null); setReddit(null); setStData(null); setRecs(null);
    setLiveChain(false);
    setScreen('research');

    // Step 1: real price from Yahoo Finance
    setChainLoading(true);
    const yahooData = await fetchYahooPrice(t);
    const p = yahooData?.price ?? FALLBACK_PRICES[t] ?? 150;
    setPrice(p);

    // Step 2: real chain from Tradier if token present, else synthetic
    let built;
    if (apiToken) {
      const tradierData = await tradier_full_chain(t, apiToken, p);
      if (tradierData) {
        built = tradierData; setLiveChain(true);
      } else {
        built = buildChain(t, p); setLiveChain(false);
      }
    } else {
      built = buildChain(t, p);
    }
    setChain(built);
    setChainLoading(false);

    // Step 3: sentiment in parallel
    setSentimentLoading(true);
    const [rd, std] = await Promise.all([reddit_search(t), st_sentiment(t)]);
    setReddit(rd); setStData(std);
    setSentimentLoading(false);

    // Step 4: AI recs
    setRecsLoading(true);
    const recResult = await claude_ticker_recs(t, p, built, rd, std);
    setRecs(recResult);
    setRecsLoading(false);
  };

  // ── Render ──
  if (screen === 'login') return <LoginScreen onLogin={handleLogin} busy={loginBusy} err={loginErr} />;

  return (
    <>
      <style>{CSS}</style>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg0)' }}>
        <TopBar onHome={() => setScreen('home')} onSearch={handleSearch} username={username} demo={demo} liveChain={liveChain} />
        {screen === 'home' && (
          <HomeScreen onSearch={handleSearch} trending={trending} homeRecs={homeRecs} loading={homeLoading} />
        )}
        {screen === 'research' && (
          <ResearchScreen
            ticker={ticker} price={price}
            chain={chain} chainLoading={chainLoading} liveChain={liveChain}
            reddit={reddit} stData={stData} sentimentLoading={sentimentLoading}
            recs={recs} recsLoading={recsLoading}
            demo={demo} onSearch={handleSearch}
            onReanalyze={async (maxCost) => {
              const c = chain || buildChain(ticker, price);
              return await claude_ticker_recs(ticker, price, c, reddit || [], stData, maxCost);
            }}
          />
        )}
      </div>
    </>
  );
}
