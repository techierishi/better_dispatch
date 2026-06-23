import { extractBetterDispatchFromInput } from '../utils/yaml-parser.js';

const BUTTON_ID = 'bd-inject-button';
let observer = null;

function init() {
  if (!isActionsPage()) return;
  startObserving();
  tryInject();
}

function isActionsPage() {
  return /^\/[^/]+\/[^/]+\/actions/.test(window.location.pathname);
}

function getRepoInfo() {
  const parts = window.location.pathname.split('/');
  return { owner: parts[1], repo: parts[2] };
}

function startObserving() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(debounceTryInject);
  observer.observe(document.body, { childList: true, subtree: true });
}

let debounceTimer;
function debounceTryInject() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(tryInject, 500);
}

function tryInject() {
  if (document.getElementById(BUTTON_ID)) return;

  const runBtn = findRunWorkflowButton();
  if (!runBtn) return;

  const workflowFile = detectWorkflowFile();
  if (!workflowFile) return;

  checkAndInject(runBtn, workflowFile);
}

function findRunWorkflowButton() {
  const candidates = document.querySelectorAll('button, summary, [role="button"]');
  for (const el of candidates) {
    if (el.textContent.trim().includes('Run workflow')) return el;
  }
  return null;
}

function detectWorkflowFile() {
  const params = new URLSearchParams(window.location.search);
  const workflowParam = params.get('workflow');
  if (workflowParam) {
    return /\.(yml|yaml)$/.test(workflowParam) ? workflowParam : `${workflowParam}.yml`;
  }

  const links = document.querySelectorAll('a[href*="/workflows/"]');
  for (const link of links) {
    const match = link.getAttribute('href').match(/\/workflows\/([^/]+\.(?:yml|yaml))/);
    if (match) return match[1];
  }

  return null;
}

async function checkAndInject(button, workflowFilename) {
  const { owner, repo } = getRepoInfo();
  const ref = getCurrentRef();
  const workflowPath = `.github/workflows/${workflowFilename}`;

  try {
    const response = await sendMsg('FETCH_WORKFLOW', { owner, repo, path: workflowPath, ref });
    if (!response.success) return;

    const config = extractBetterDispatchFromInput(response.content);
    if (!config) return;

    injectButton(button, { owner, repo, ref, workflowPath, workflowFilename });
  } catch (e) {
    console.error('[Better Dispatch]', e);
  }
}

function getCurrentRef() {
  const branchLink = document.querySelector('a[href*="/tree/"]');
  if (branchLink) {
    const match = branchLink.getAttribute('href').match(/\/tree\/(.+)$/);
    if (match) return match[1];
  }
  return 'main';
}

function injectButton(runButton, context) {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.className = 'bd-button';
  btn.innerHTML = '<span class="bd-icon">⚡</span> Better Dispatch';
  btn.type = 'button';

  btn.addEventListener('click', () => {
    sendMsg('OPEN_BETTER_DISPATCH', {
      owner: context.owner,
      repo: context.repo,
      ref: context.ref,
      workflowPath: context.workflowPath,
      workflowFilename: context.workflowFilename
    });
  });

  const parent = runButton.parentElement;
  if (parent) {
    parent.style.display = 'flex';
    parent.style.alignItems = 'center';
    parent.appendChild(btn);
  }
}

function sendMsg(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, resolve);
  });
}

let lastUrl = window.location.href;
const urlWatcher = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();
    if (isActionsPage()) setTimeout(tryInject, 1000);
  }
});
urlWatcher.observe(document.body, { subtree: true, childList: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
