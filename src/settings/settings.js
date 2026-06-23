document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('github-token');
  const toggleTokenBtn = document.getElementById('toggle-token');
  const tokenStatus = document.getElementById('token-status');
  const secretsList = document.getElementById('secrets-list');
  const newKeyInput = document.getElementById('new-secret-key');
  const newValueInput = document.getElementById('new-secret-value');
  const addSecretBtn = document.getElementById('add-secret');
  const saveStatus = document.getElementById('save-status');

  loadSettings();

  let saveTimeout;
  tokenInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set({ github_token: tokenInput.value }, () => {
        showSaveStatus();
      });
    }, 500);
  });

  toggleTokenBtn.addEventListener('click', () => {
    const isPassword = tokenInput.type === 'password';
    tokenInput.type = isPassword ? 'text' : 'password';
    toggleTokenBtn.textContent = isPassword ? '🔒' : '👁';
  });

  addSecretBtn.addEventListener('click', () => {
    const key = newKeyInput.value.trim();
    const value = newValueInput.value.trim();

    if (!key) {
      showFieldError(newKeyInput, 'Key is required');
      return;
    }

    chrome.storage.local.get(['secrets'], (result) => {
      const secrets = result.secrets || {};
      secrets[key] = value;
      chrome.storage.local.set({ secrets }, () => {
        newKeyInput.value = '';
        newValueInput.value = '';
        renderSecrets(secrets);
        showSaveStatus();
      });
    });
  });

  function loadSettings() {
    chrome.storage.local.get(['github_token', 'secrets'], (result) => {
      if (result.github_token) {
        tokenInput.value = result.github_token;
        tokenStatus.textContent = 'Token configured';
        tokenStatus.className = 'status saved';
      } else {
        tokenStatus.textContent = 'No token set';
        tokenStatus.className = 'status error';
      }
      renderSecrets(result.secrets || {});
    });
  }

  function renderSecrets(secrets) {
    secretsList.innerHTML = '';
    const entries = Object.entries(secrets);

    if (entries.length === 0) {
      secretsList.innerHTML = '<p class="hint">No secrets configured yet.</p>';
      return;
    }

    for (const [key, value] of entries) {
      const row = document.createElement('div');
      row.className = 'secret-row';

      const keySpan = document.createElement('span');
      keySpan.className = 'key-display';
      keySpan.textContent = key;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'value-display';
      valueSpan.textContent = value ? '••••••••' : '(empty)';
      valueSpan.title = value;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        delete secrets[key];
        chrome.storage.local.set({ secrets }, () => {
          renderSecrets(secrets);
          showSaveStatus();
        });
      });

      row.appendChild(keySpan);
      row.appendChild(valueSpan);
      row.appendChild(deleteBtn);
      secretsList.appendChild(row);
    }
  }

  function showFieldError(input, message) {
    input.style.borderColor = '#f85149';
    setTimeout(() => { input.style.borderColor = ''; }, 2000);
  }

  function showSaveStatus() {
    saveStatus.textContent = 'Settings saved';
    saveStatus.classList.add('visible');
    setTimeout(() => {
      saveStatus.classList.remove('visible');
    }, 2000);
  }
});
