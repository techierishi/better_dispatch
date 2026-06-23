chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  if (type === 'OPEN_BETTER_DISPATCH') {
    const { owner, repo, ref, workflowPath, workflowFilename, config } = payload;
    const tabUrl = chrome.runtime.getURL('tab/index.html') +
      `?owner=${encodeURIComponent(owner)}` +
      `&repo=${encodeURIComponent(repo)}` +
      `&ref=${encodeURIComponent(ref)}` +
      `&workflowPath=${encodeURIComponent(workflowPath)}` +
      `&workflowFilename=${encodeURIComponent(workflowFilename)}` +
      `&config=${encodeURIComponent(config ? JSON.stringify(config) : '')}`;
    chrome.tabs.create({ url: tabUrl, active: true });
    sendResponse({ success: true });
  }

  if (type === 'GET_SECRETS') {
    chrome.storage.local.get(['secrets', 'github_token'], (result) => {
      sendResponse({
        secrets: result.secrets || {},
        github_token: result.github_token || ''
      });
    });
    return true;
  }

  if (type === 'FETCH_WORKFLOW') {
    const { owner, repo, path, ref } = payload;
    fetchWorkflowContent(owner, repo, path, ref)
      .then(content => sendResponse({ success: true, content }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (type === 'DISPATCH_WORKFLOW') {
    const { owner, repo, workflowId, ref, inputs } = payload;
    dispatchWorkflow(owner, repo, workflowId, ref, inputs)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (type === 'FETCH_DATASOURCE') {
    const { url, method, headers, body } = payload;
    fetchDataSource(url, method, headers, body)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function fetchWorkflowContent(owner, repo, path, ref) {
  const { github_token } = await chrome.storage.local.get(['github_token']);
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (github_token) headers['Authorization'] = `token ${github_token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GitHub API ${response.status} fetching ${path} on ${ref}${text ? ': ' + text.slice(0, 200) : ''}`);
  }

  const data = await response.json();
  return atob(data.content);
}

async function dispatchWorkflow(owner, repo, workflowId, ref, inputs) {
  const { github_token } = await chrome.storage.local.get(['github_token']);
  if (!github_token) throw new Error('GitHub PAT not configured. Open Better Dispatch settings.');

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'Authorization': `token ${github_token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref, inputs })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dispatch failed (${response.status}): ${errorText}`);
  }

  return { success: true };
}

async function fetchDataSource(url, method, headers, body) {
  const fetchOptions = {
    method: method || 'GET',
    headers: headers || {}
  };
  if (body && method !== 'GET') {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) throw new Error(`Datasource fetch failed: ${response.status}`);
  return await response.json();
}
