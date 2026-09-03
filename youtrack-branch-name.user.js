// ==UserScript==
// @name         YouTrack → Git branch név
// @namespace    fotexnet
// @version      1.9.4
// @description  Egy kattintással git branch nevet generál YouTrack ticketekből: azonosító + cím → ehr-102-uj-jelenleti-iv-nem-hozhato-letre
// @author       Fotexnet
// @match        https://fotexnet.youtrack.cloud/*
// @homepageURL  https://github.com/matekerges/youtrack-userscripts
// @supportURL   https://github.com/matekerges/youtrack-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/matekerges/youtrack-userscripts/main/youtrack-branch-name.user.js
// @updateURL    https://raw.githubusercontent.com/matekerges/youtrack-userscripts/main/youtrack-branch-name.user.js
// @grant        GM_setClipboard
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  /* -------- SETTINGS -------- */
  const CONFIG = {
    // Max length of the whole branch name, id included.
    // Reference: "ehr-102-uj-jelenleti-iv-nem-hozhato-letre" = 41 characters.
    // Truncation always happens on a word boundary (a dash); the id is never cut.
    maxLength: 80,

    // Fixed prefix if needed (e.g. 'feature/' or 'kergesmate/'). Empty = no prefix.
    prefix: '',

    // Lowercase the id? (false → EHR-102-uj-jelenleti-...)
    lowercaseId: true,

    // Strip a leading [Tag] / (Tag) block from the title.
    // false → "ehr-86-attendanceperiods-uj-jelenleti-gomb-..."
    // true  → "ehr-86-uj-jelenleti-gomb-..."
    stripLeadingTags: false,

    // What Alt + click copies instead of the bare branch name.
    altClickTemplate: 'git checkout -b {branch}',

    // Icon colors, matched to the YouTrack toolbar.
    colors: {
      base: '#6c707e',
      hover: '#ff008c',
    },
  };

  /* -------- SLUG -------- */
  function slugify(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function truncateSlug(slug, budget) {
    if (budget <= 0) return '';
    if (slug.length <= budget) return slug;
    const cut = slug.slice(0, budget + 1);
    const lastDash = cut.lastIndexOf('-');
    const out = lastDash > 0 ? cut.slice(0, lastDash) : slug.slice(0, budget);
    return out.replace(/-+$/, '');
  }

  function stripTags(text) {
    const t = String(text || '');
    return CONFIG.stripLeadingTags ? t.replace(/^\s*(?:[\[(][^\])]*[\])]\s*)+/, '') : t;
  }

  function buildBranchName(id, title) {
    const idPart = CONFIG.lowercaseId ? id.toLowerCase() : id;
    const head = CONFIG.prefix + idPart;
    const slug = truncateSlug(slugify(title), CONFIG.maxLength - head.length - 1);
    return slug ? `${head}-${slug}` : head;
  }

  /* -------- TICKET DATA (REST API + DOM FALLBACK) -------- */
  const ID_RE = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;
  const HREF_ID_RE = /\/issue\/([A-Za-z][A-Za-z0-9_]*-\d+)(?:[/?#]|$)/;
  const summaryCache = new Map(); // id -> Promise<string>

  function fetchSummary(id) {
    if (summaryCache.has(id)) return summaryCache.get(id);
    const url = `${location.origin}/api/issues/${encodeURIComponent(id)}?fields=idReadable,summary`;
    const p = fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!data || !data.summary) throw new Error('nincs summary');
        return data.summary;
      })
      .catch((err) => {
        summaryCache.delete(id); // make it retryable
        const fallback = summaryFromDom(id);
        if (fallback) return fallback;
        throw err;
      });
    summaryCache.set(id, p);
    return p;
  }

  // If the API is unreachable, fall back to reading the title from the DOM.
  function summaryFromDom(id) {
    const sel = [
      '[data-test~="ticket-summary"]',
      '[data-test*="summary"]',
      '[data-test*="issue-summary"]',
      'h1',
    ];
    for (const s of sel) {
      for (const el of document.querySelectorAll(s)) {
        const t = (el.textContent || '').trim();
        if (t && t.length > 2 && !ID_RE.test(t)) return t;
      }
    }
    // document.title variants such as "EHR-102: Title ... - YouTrack"
    let t = document.title
      .replace(/\s*[-–—|]\s*YouTrack\s*$/i, '')
      .replace(new RegExp(`^\\s*${id}\\s*[:.\\-–—]\\s*`, 'i'), '')
      .trim();
    return t && !ID_RE.test(t) ? t : '';
  }

  /* -------- CLIPBOARD + TOAST -------- */
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) { /* fall through */ }
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return true;
      }
    } catch (_) { /* fall through */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  let toastEl = null;
  let toastTimer = null;
  function toast(message, isError) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ytbn-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.toggle('ytbn-toast--error', !!isError);
    toastEl.classList.add('ytbn-toast--show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('ytbn-toast--show'), 2600);
  }

  /* -------- TOOLTIP -------- */
  const TIP_DELAY = 1000;
  let tipEl = null;
  let tipTimer = null;

  function showTip(anchor, text) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'ytbn-tip';
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = text;

    // We need its size before positioning; it still has layout at opacity 0.
    const a = anchor.getBoundingClientRect();
    const t = tipEl.getBoundingClientRect();
    let left = a.left + a.width / 2 - t.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
    let top = a.bottom + 6;
    if (top + t.height > window.innerHeight - 8) top = a.top - t.height - 6;
    tipEl.style.left = `${Math.round(left)}px`;
    tipEl.style.top = `${Math.round(top)}px`;
    tipEl.classList.add('ytbn-tip--show');
  }

  function hideTip() {
    clearTimeout(tipTimer);
    if (tipEl) tipEl.classList.remove('ytbn-tip--show');
  }

  window.addEventListener('scroll', hideTip, { passive: true, capture: true });
  window.addEventListener('blur', hideTip);

  /* -------- BUTTON -------- */
  const ICON = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5.6 4.6V3.1a1.6 1.6 0 0 1 1.6-1.6h5.7a1.6 1.6 0 0 1 1.6 1.6v5.7a1.6 1.6 0 0 1-1.6 1.6h-1.5"/>
      <rect x="1.5" y="4.6" width="9.9" height="9.9" rx="1.6"/>
      <path d="M4.3 6.7v5.6"/>
      <path d="M4.3 9.9h2.7a1.6 1.6 0 0 0 1.6-1.6V6.7"/>
    </svg>`;

  function makeButton(id) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ytbn-btn';
    btn.innerHTML = ICON;
    const tipText = `Branch név másolása (${id})\nAlt + klikk: ${CONFIG.altClickTemplate.replace('{branch}', '…')}`;
    btn.setAttribute('aria-label', `Branch név másolása: ${id}`);

    btn.addEventListener('mouseenter', () => {
      fetchSummary(id).catch(() => {}); // warm up so the click is instant
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => showTip(btn, tipText), TIP_DELAY);
    }, { passive: true });
    btn.addEventListener('mouseleave', hideTip, { passive: true });
    btn.addEventListener('blur', hideTip, { passive: true });

    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'dblclick']) {
      btn.addEventListener(type, (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    }

    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideTip();
      btn.classList.add('ytbn-btn--busy');
      try {
        const branch = buildBranchName(id, stripTags(await fetchSummary(id)));
        const text = ev.altKey ? CONFIG.altClickTemplate.replace('{branch}', branch) : branch;
        const ok = await copy(text);
        toast(ok ? text : `Nem sikerült a vágólapra másolni: ${text}`, !ok);
      } catch (err) {
        toast(`Nem sikerült lekérni a(z) ${id} címét (${err.message})`, true);
      } finally {
        btn.classList.remove('ytbn-btn--busy');
      }
    });

    return btn;
  }

  /* -------- INJECTION -------- */
  const ID_PARAMS = ['issue', 'preview', 'issueId'];

  function currentIssueId() {
    for (const src of [location.search, location.hash]) {
      const params = new URLSearchParams(src.replace(/^[?#]/, ''));
      for (const key of ID_PARAMS) {
        const v = params.get(key);
        if (v && ID_RE.test(v)) return v;
      }
    }
    const m = location.pathname.match(HREF_ID_RE);
    return m ? m[1] : null;
  }

  function holderFor(id) {
    const holder = document.createElement('span');
    holder.className = 'ytbn-holder';
    holder.dataset.ytbnId = id;
    holder.appendChild(makeButton(id));
    return holder;
  }

  function place(id, host, before) {
    if (!host) return false;
    const existing = [...host.children].find((c) => c.classList && c.classList.contains('ytbn-holder'));
    if (existing) {
      if (existing.dataset.ytbnId === id) return true; // already there, right ticket
      existing.remove();
    }
    const holder = holderFor(id);
    holder.classList.add('ytbn-holder--row');
    if (before) host.insertBefore(holder, before);
    else host.appendChild(holder);
    return true;
  }

  function isIconBtn(el) {
    if (!el || el.classList.contains('ytbn-btn') || el.closest('.ytbn-holder')) return false;
    const isBtn = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.tagName === 'A';
    if (!isBtn && !(el.children.length <= 2 && el.querySelector(':scope > svg'))) return false;
    return (el.textContent || '').trim().length <= 1 && !!el.querySelector('svg');
  }

  const TOOLBAR_SEL = '[data-test~="issue-toolbar"]';

  function idNearToolbar(el) {
    let n = el.parentElement;
    for (let i = 0; i < 10 && n; i++, n = n.parentElement) {
      for (const a of n.querySelectorAll('a[href*="/issue/"]')) {
        const m = (a.getAttribute('href') || '').match(HREF_ID_RE);
        if (m && (a.textContent || '').trim() === m[1]) return m[1];
      }
    }
    return null;
  }

  function resolveIconRow(toolbar) {
    const iconsIn = (el) => [...el.querySelectorAll('button, [role="button"], a')].filter(isIconBtn);

    const first = iconsIn(toolbar)[0];
    if (!first) return { host: toolbar, first: toolbar.firstElementChild };

    let row = first.parentElement;
    while (row && row !== toolbar && iconsIn(row).length < 2) row = row.parentElement;
    if (!row) row = toolbar;

    let anchor = first;
    while (anchor.parentElement && anchor.parentElement !== row) anchor = anchor.parentElement;

    return { host: row, first: anchor };
  }

  const injectedIds = new Set();

  function injectMain() {
    injectedIds.clear();

    const toolbars = document.querySelectorAll(TOOLBAR_SEL);
    if (toolbars.length) {
      for (const toolbar of toolbars) {
        const id = idNearToolbar(toolbar) || currentIssueId();
        if (!id) continue;
        const { host, first } = resolveIconRow(toolbar);
        for (const stale of toolbar.querySelectorAll('.ytbn-holder')) {
          if (stale.parentElement !== host) stale.remove();
        }
        if (place(id, host, first)) injectedIds.add(id);
      }
      return;
    }

    const id = currentIssueId();
    if (!id) return;
    const roots = issueRootsFor(id);
    for (const root of roots) {
      const titleEl = findTitleEl(root);
      if (!titleEl) continue;
      const row = findIconRow(titleEl);
      if (row && place(id, row.host, row.first)) { injectedIds.add(id); return; }
    }
    for (const root of roots) {
      const titleEl = findTitleEl(root);
      if (!titleEl) continue;
      const next = titleEl.nextElementSibling;
      if (next && next.classList.contains('ytbn-holder')) {
        if (next.dataset.ytbnId === id) { injectedIds.add(id); return; }
        next.remove();
      }
      titleEl.insertAdjacentElement('afterend', holderFor(id));
      injectedIds.add(id);
      return;
    }
  }

  /* -------- FALLBACK HELPERS -------- */

  const TITLE_SEL = ['[data-test~="ticket-summary"]', '[data-test*="issue-summary"]', 'h1', 'h2'];

  function findTitleEl(root) {
    for (const s of TITLE_SEL) {
      for (const el of root.querySelectorAll(s)) {
        if ((el.textContent || '').trim().length > 1) return el;
      }
    }
    return null;
  }

  function issueRootsFor(id) {
    const roots = [];
    const idEls = [...document.querySelectorAll('a[href*="/issue/"]')].filter((a) => {
      const m = (a.getAttribute('href') || '').match(HREF_ID_RE);
      return m && m[1] === id && (a.textContent || '').trim() === id;
    });
    for (const el of idEls) {
      let n = el.parentElement;
      for (let i = 0; i < 8 && n; i++, n = n.parentElement) {
        if (findTitleEl(n)) { roots.push(n); break; }
      }
    }
    roots.push(document.body);
    return roots;
  }

  function findIconRow(titleEl) {
    let node = titleEl;
    for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
      const parent = node.parentElement;
      if (!parent) break;

      const direct = [...parent.children].filter((c) => c !== node && !c.contains(titleEl) && isIconBtn(c));
      if (direct.length >= 2) return { host: parent, first: direct[0] };

      for (const sib of parent.children) {
        if (sib === node || sib.contains(titleEl)) continue;
        const btns = [...sib.querySelectorAll('button, [role="button"], a')].filter(isIconBtn);
        if (btns.length < 2) continue;
        let common = btns[0].parentElement;
        while (common && !btns.every((b) => common.contains(b))) common = common.parentElement;
        if (common && !common.contains(titleEl)) return { host: common, first: common.firstElementChild };
      }
    }
    return null;
  }

  function injectByAnchors() {
    for (const a of document.querySelectorAll('a[href*="/issue/"]')) {
      if (a.dataset.ytbn) continue;
      const m = (a.getAttribute('href') || '').match(HREF_ID_RE);
      if (!m) continue;
      const id = m[1];
      if ((a.textContent || '').trim() !== id) continue;
      if (injectedIds.has(id)) continue;
      a.dataset.ytbn = '1';
      a.insertAdjacentElement('afterend', holderFor(id));
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      try {
        injectMain();
        injectByAnchors();
      } catch (err) {
        console.warn('[ytbn]', err);
      }
    }, 150);
  }

  /* -------- STYLES -------- */
  const style = document.createElement('style');
  style.textContent = `
    .ytbn-holder { display:inline-flex; align-items:center; vertical-align:middle; margin:0 0 0 4px; }
    .ytbn-btn {
      display:inline-flex; align-items:center; justify-content:center;
      width:20px; height:20px; padding:0; border:0; border-radius:4px;
      background:transparent; color:${CONFIG.colors.base};
      cursor:pointer; line-height:0; transition:color .12s;
    }
    .ytbn-btn svg { width:16px; height:16px; display:block; margin-top:2px }
    .ytbn-btn:hover { color:${CONFIG.colors.hover}; }
    /* Separate rule: older Safari doesn't know :focus-visible and would drop the
       whole selector list, taking the hover color with it. */
    .ytbn-btn:focus-visible { color:${CONFIG.colors.hover}; outline:none; }
    .ytbn-btn--busy { opacity:.45; cursor:progress; }

    /* In the toolbar: YouTrack icons are 16x16 inside a 16x24 span, aligned to the
       top of the box. flex:0 0 auto keeps ours from stretching. */
    .ytbn-holder--row {
      margin:0; align-self:flex-start; flex:0 0 auto;
      width:16px; min-width:16px; height:24px;
    }
    .ytbn-holder--row .ytbn-btn {
      width:16px; height:24px; border-radius:0; align-items:flex-start;
    }

    /* Exact YouTrack (Ring UI) tooltip style: .ring-ui-tooltip plus the
       ring-ui-theme-dark class. It is dark in both themes, so the colors are
       fixed. Measured: 14px system-ui, #FFF, #2B2D30, 6px 8px padding, and
       34px height on a single line → 22px line-height. */
    .ytbn-tip {
      position:fixed; left:0; top:0; z-index:2147483647;
      padding:6px 8px; border-radius:4px;
      background:#2B2D30; color:#FFFFFF;
      font:400 14px/22px var(--ring-font-family, system-ui, Arial, sans-serif);
      white-space:pre; max-width:min(320px, 90vw);
      box-shadow:0 2px 8px rgba(0,0,0,.25);
      opacity:0; pointer-events:none; transition:opacity .1s;
    }
    .ytbn-tip--show { opacity:1; }

    .ytbn-toast {
      position:fixed; left:50%; bottom:24px; z-index:2147483647;
      transform:translate(-50%, 12px);
      max-width:min(560px, 90vw); padding:9px 14px;
      border-radius:8px; background:#1f2329; color:#f5f6f7;
      font:13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
      box-shadow:0 6px 24px rgba(0,0,0,.28);
      opacity:0; pointer-events:none; transition:opacity .15s, transform .15s;
      word-break:break-all;
    }
    .ytbn-toast--show { opacity:1; transform:translate(-50%, 0); }
    .ytbn-toast--error { background:#8b2c2c; }
  `;
  (document.head || document.documentElement).appendChild(style);

  /* -------- START -------- */
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  schedule();
})();
