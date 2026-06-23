const BAR_ID = 'bd-bar';
const DRAWER_ID = 'bd-drawer';
let injected = false;

function init() {
  if (!isActionsPage()) return;
  observePage();
  tryInject();
}

function isActionsPage() {
  return /^\/[^/]+\/[^/]+\/actions/.test(location.pathname);
}

function getRepoInfo() {
  const p = location.pathname.split('/');
  return { owner: p[1], repo: p[2] };
}

function observePage() {
  const obs = new MutationObserver(() => {
    clearTimeout(obs._t);
    obs._t = setTimeout(tryInject, 400);
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

function tryInject() {
  if (injected) return;
  if (!isActionsPage()) return;

  const file = getWorkflowFile();
  if (!file) return;

  injected = true;
  doInject(file);
}

function getWorkflowFile() {
  const m = location.pathname.match(/\/workflows\/([^/]+\.(?:yml|yaml))/i);
  if (m) return m[1];

  const params = new URLSearchParams(location.search);
  const qp = params.get('workflow');
  if (qp) return /\.(yml|yaml)$/i.test(qp) ? qp : `${qp}.yml`;

  return null;
}

function getRef() {
  const picker = document.querySelector(
    '[data-menu-trigger="branch-picker"], [data-testid="branch-picker"], ' +
    '#branch-picker-repos-header-ref-selector, summary[aria-label*="branch"], ' +
    '[id*="branch-picker"] summary, [data-targets*="branch"]'
  );
  if (picker) {
    const text = picker.textContent?.trim().split(/\s+/)[0];
    if (text && text.length < 50) return text;
  }

  const branchLabel = document.querySelector('[class*="branch"] [class*="name"], [data-testid*="branch"] span');
  if (branchLabel) {
    const text = branchLabel.textContent?.trim();
    if (text && text.length < 50) return text;
  }

  const m = location.pathname.match(/\/tree\/(.+?)(?:\/|$)/);
  if (m) return decodeURIComponent(m[1]);

  const params = new URLSearchParams(location.search);
  const queryBranch = params.get('branch');
  if (queryBranch) return queryBranch;

  return 'master';
}

function doInject(filename) {
  if (document.getElementById(BAR_ID)) return;

  const { owner, repo } = getRepoInfo();
  const ref = getRef();
  const path = `.github/workflows/${filename}`;

  injectStyles();

  const bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.style.cssText =
    'display:flex;flex-direction:column;align-items:stretch;gap:8px;' +
    'position:fixed;right:0;top:50%;transform:translateY(-50%);' +
    'z-index:99997;padding:12px 8px;';

  const btn = document.createElement('button');
  btn.textContent = '⚡';
  btn.title = 'Open Better Dispatch';
  btn.style.cssText =
    'display:block;background:linear-gradient(135deg,#238636,#2ea043);' +
    'color:#fff;border:1px solid #2ea043;border-radius:6px 0 0 6px;padding:12px 8px;' +
    'font-size:16px;cursor:pointer;line-height:1;font-family:inherit;';

  btn.addEventListener('click', () => openDrawer(owner, repo, ref, path, filename));

  bar.appendChild(btn);
  document.body.appendChild(bar);
}

function injectStyles() {
  if (document.getElementById('bd-styles')) return;

  const style = document.createElement('style');
  style.id = 'bd-styles';
  style.textContent = `
    .bd-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg,#238636,#2ea043);
      color: #fff; border: 1px solid #2ea043;
      border-radius: 6px; padding: 6px 16px;
      font-size: 13px; font-weight: 500;
      cursor: pointer; line-height: 20px;
      font-family: inherit;
    }
    .bd-btn:hover { opacity: 0.9; }
    #${DRAWER_ID}-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 99998;
      opacity: 0;
      transition: opacity 0.2s;
    }
    #${DRAWER_ID}-backdrop.open { opacity: 1; }
    #${DRAWER_ID}-panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 640px; max-width: 90vw;
      background: #0d1117;
      border-left: 1px solid #30363d;
      z-index: 99999;
      display: flex; flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.25s ease;
      box-shadow: -8px 0 24px rgba(0,0,0,0.3);
    }
    #${DRAWER_ID}-panel.open { transform: translateX(0); }
    #${DRAWER_ID}-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #30363d;
      background: #161b22;
    }
    #${DRAWER_ID}-header span {
      font-size: 14px; font-weight: 600; color: #e6edf3;
    }
    #${DRAWER_ID}-close {
      background: none; border: none; color: #8b949e;
      font-size: 20px; cursor: pointer; padding: 4px 8px;
      line-height: 1; font-family: inherit;
    }
    #${DRAWER_ID}-close:hover { color: #f0f6fc; }
    #${DRAWER_ID}-body {
      flex: 1; overflow: hidden;
    }
    #${DRAWER_ID}-body iframe {
      width: 100%; height: 100%; border: none;
    }
  `;
  document.head.appendChild(style);
}

function openDrawer(owner, repo, ref, path, filename) {
  if (document.getElementById(DRAWER_ID)) return;

  const tabUrl = chrome.runtime.getURL('tab/index.html') +
    `?owner=${encodeURIComponent(owner)}` +
    `&repo=${encodeURIComponent(repo)}` +
    `&ref=${encodeURIComponent(ref)}` +
    `&workflowPath=${encodeURIComponent(path)}` +
    `&workflowFilename=${encodeURIComponent(filename)}`;

  const backdrop = document.createElement('div');
  backdrop.id = DRAWER_ID + '-backdrop';
  backdrop.addEventListener('click', closeDrawer);

  const panel = document.createElement('div');
  panel.id = DRAWER_ID + '-panel';

  panel.innerHTML = `
    <div id="${DRAWER_ID}-header">
      <span>Better Dispatch ⚡</span>
      <button id="${DRAWER_ID}-close" class="${DRAWER_ID}-close-btn">&times;</button>
    </div>
    <div id="${DRAWER_ID}-body">
      <iframe src="${tabUrl}"></iframe>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  panel.querySelector('.' + DRAWER_ID + '-close-btn').addEventListener('click', closeDrawer);

  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    panel.classList.add('open');
  });
}

function closeDrawer() {
  const backdrop = document.getElementById(DRAWER_ID + '-backdrop');
  const panel = document.getElementById(DRAWER_ID + '-panel');

  if (backdrop) backdrop.classList.remove('open');
  if (panel) panel.classList.remove('open');

  setTimeout(() => {
    backdrop?.remove();
    panel?.remove();
  }, 250);
}

let lastUrl = location.href;
const urlObs = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    document.getElementById(BAR_ID)?.remove();
    document.getElementById(DRAWER_ID)?.remove();
    document.getElementById(DRAWER_ID + '-backdrop')?.remove();
    injected = false;
    if (isActionsPage()) setTimeout(tryInject, 800);
  }
});
urlObs.observe(document.body, { subtree: true, childList: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
