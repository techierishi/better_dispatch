const GitHubAPI = (() => {
  const API_BASE = 'https://api.github.com';

  async function getHeaders() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['github_token'], (result) => {
        const headers = {
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        };
        if (result.github_token) {
          headers['Authorization'] = `token ${result.github_token}`;
        }
        resolve(headers);
      });
    });
  }

  async function getWorkflowContent(owner, repo, path, ref) {
    const headers = await getHeaders();
    const url = `${API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch workflow: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = atob(data.content);
    return content;
  }

  async function dispatchWorkflow(owner, repo, workflowId, ref, inputs) {
    const headers = await getHeaders();
    headers['Content-Type'] = 'application/json';

    const url = `${API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

    const body = JSON.stringify({
      ref: ref,
      inputs: inputs
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dispatch failed: ${response.status} - ${errorText}`);
    }

    return { success: true };
  }

  async function listWorkflows(owner, repo) {
    const headers = await getHeaders();
    const url = `${API_BASE}/repos/${owner}/${repo}/actions/workflows`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to list workflows: ${response.status}`);
    }

    const data = await response.json();
    return data.workflows || [];
  }

  return { getWorkflowContent, dispatchWorkflow, listWorkflows };
})();

if (typeof module !== 'undefined') {
  module.exports = GitHubAPI;
}
