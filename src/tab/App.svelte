<script>
  import { onMount } from 'svelte';
  import TextareaEditor from './components/TextareaEditor.svelte';
  import SearchableSelect from './components/SearchableSelect.svelte';
  import Multiselect from './components/Multiselect.svelte';
  import { extractBetterDispatchFromInput } from '../utils/yaml-parser.js';

  let loading = true;
  let error = null;
  let config = null;
  let owner = '';
  let repo = '';
  let ref = '';
  let workflowPath = '';
  let workflowFilename = '';
  let formValues = {};
  let datasources = {};
  let secrets = {};
  let submitting = false;
  let submitResult = null;

  $: elements = config?.elements || [];
  $: serializedValues = serializeAll(formValues, elements);

  onMount(async () => {
    const params = parseParams();
    owner = params.owner;
    repo = params.repo;
    ref = params.ref;
    workflowPath = params.workflowPath;
    workflowFilename = params.workflowFilename;

    try {
      const secretsResp = await sendMsg('GET_SECRETS');
      secrets = secretsResp.secrets || {};

      const workflowResp = await sendMsg('FETCH_WORKFLOW', {
        owner, repo, path: workflowPath, ref
      });
      if (!workflowResp.success) throw new Error(workflowResp.error);

      const parsed = extractBetterDispatchFromInput(workflowResp.content);
      if (!parsed) throw new Error('No Better Dispatch config found in workflow inputs');

      config = parsed;

      for (const el of elements) {
        formValues[el.id] = el.type === 'multiselect' ? [] : '';
        if (el.datasource) {
          await loadDatasource(el);
        }
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  function parseParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      owner: params.get('owner') || '',
      repo: params.get('repo') || '',
      ref: params.get('ref') || 'main',
      workflowPath: params.get('workflowPath') || '',
      workflowFilename: params.get('workflowFilename') || ''
    };
  }

  async function loadDatasource(el) {
    try {
      const resolvedUrl = await Interpolator.resolve(el.datasource.url, secrets);
      const resolvedHeaders = el.datasource.headers
        ? await Interpolator.resolveObject(el.datasource.headers, secrets)
        : {};

      const resp = await sendMsg('FETCH_DATASOURCE', {
        url: resolvedUrl,
        method: el.datasource.method || 'GET',
        headers: resolvedHeaders
      });

      if (resp.success) {
        const data = getByPath(resp.data, el.datasource.dataPath);
        const mapping = el.datasource.mapping || {};
        datasources[el.id] = (Array.isArray(data) ? data : []).map(item => ({
          label: String(mapping.label ? item[mapping.label] : item),
          value: String(mapping.value ? item[mapping.value] : item)
        }));
      }
    } catch (e) {
      console.error(`Datasource load failed for ${el.id}:`, e);
    }
  }

  function getByPath(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  function serializeValue(value, element) {
    if (element.type === 'multiselect') {
      return Array.isArray(value) ? value.join(',') : '';
    }
    return String(value || '');
  }

  function serializeAll(values, elems) {
    const result = {};
    for (const el of elems) {
      result[el.id] = serializeValue(values[el.id], el);
    }
    return result;
  }

  async function sendMsg(type, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, payload }, resolve);
    });
  }

  async function handleSubmit() {
    submitting = true;
    submitResult = null;

    try {
      const resp = await sendMsg('DISPATCH_WORKFLOW', {
        owner,
        repo,
        workflowId: workflowFilename,
        ref,
        inputs: serializedValues
      });

      if (resp.success) {
        submitResult = { type: 'success', message: 'Workflow dispatched successfully!' };
      } else {
        submitResult = { type: 'error', message: resp.error || 'Dispatch failed' };
      }
    } catch (e) {
      submitResult = { type: 'error', message: e.message };
    } finally {
      submitting = false;
    }
  }

  function getOptions(el) {
    if (el.datasource && datasources[el.id]) {
      return datasources[el.id];
    }
    if (el.options) {
      return el.options.map(o =>
        typeof o === 'string' ? { label: o, value: o } : o
      );
    }
    return [];
  }
</script>

<div class="app">
  <header class="app-header">
    <div class="header-left">
      <h1>Better Dispatch <span class="bolt">⚡</span></h1>
      <div class="workflow-info">
        <span class="repo">{owner}/{repo}</span>
        <span class="sep">·</span>
        <span class="ref">{ref}</span>
        <span class="sep">·</span>
        <span class="file">{workflowFilename}</span>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="state-panel">
      <div class="spinner"></div>
      <p>Loading workflow configuration...</p>
    </div>
  {:else if error}
    <div class="state-panel error-panel">
      <p class="error-title">Failed to load</p>
      <p>{error}</p>
    </div>
  {:else}
    <form class="form" on:submit|preventDefault={handleSubmit}>
      {#each elements as el (el.id)}
        <div class="field">
          <label class="field-label" for={el.id}>
            {el.id.replace(/_/g, ' ')}
          </label>
          {#if el.type === 'textarea'}
            <TextareaEditor
              {el}
              value={formValues[el.id]}
              on:change={(e) => formValues[el.id] = e.detail}
            />
          {:else if el.type === 'select'}
            <SearchableSelect
              {el}
              options={getOptions(el)}
              value={formValues[el.id]}
              on:change={(e) => formValues[el.id] = e.detail}
            />
          {:else if el.type === 'multiselect'}
            <Multiselect
              {el}
              options={getOptions(el)}
              value={formValues[el.id]}
              on:change={(e) => formValues[el.id] = e.detail}
            />
          {:else}
            <input
              type="text"
              class="text-input"
              id={el.id}
              placeholder={el.placeholder || ''}
              bind:value={formValues[el.id]}
            />
          {/if}
          {#if el.description}
            <p class="field-desc">{el.description}</p>
          {/if}
        </div>
      {/each}

      {#if submitResult}
        <div class="result" class:error={submitResult.type === 'error'} class:success={submitResult.type === 'success'}>
          {submitResult.message}
        </div>
      {/if}

      <button type="submit" class="submit-btn" disabled={submitting}>
        {submitting ? 'Dispatching...' : '⚡ Dispatch Workflow'}
      </button>
    </form>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117;
    color: #c9d1d9;
  }

  .app {
    max-width: 780px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .app-header {
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 1px solid #21262d;
  }

  .app-header h1 {
    font-size: 22px;
    font-weight: 600;
    color: #f0f6fc;
    margin: 0 0 8px;
  }

  .bolt {
    color: #f0c000;
  }

  .workflow-info {
    font-size: 13px;
    color: #8b949e;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .repo { color: #58a6ff; }
  .ref {
    background: #1f6feb33;
    color: #58a6ff;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
  }
  .file { color: #c9d1d9; }
  .sep { color: #484f58; }

  .state-panel {
    text-align: center;
    padding: 64px 24px;
    color: #8b949e;
  }

  .error-panel {
    background: #f8514910;
    border: 1px solid #f8514940;
    border-radius: 8px;
  }

  .error-title {
    color: #f85149;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #30363d;
    border-top-color: #58a6ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 14px;
    font-weight: 500;
    color: #e6edf3;
    text-transform: capitalize;
  }

  .field-desc {
    font-size: 12px;
    color: #8b949e;
    margin: 2px 0 0;
  }

  .text-input {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 8px 12px;
    color: #c9d1d9;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .text-input:focus {
    border-color: #58a6ff;
  }

  .result {
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
  }

  .result.success {
    background: #23863620;
    border: 1px solid #238636;
    color: #3fb950;
  }

  .result.error {
    background: #f8514920;
    border: 1px solid #f85149;
    color: #f85149;
  }

  .submit-btn {
    background: linear-gradient(135deg, #238636, #2ea043);
    border: 1px solid #2ea043;
    border-radius: 6px;
    padding: 12px 24px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
    margin-top: 8px;
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
