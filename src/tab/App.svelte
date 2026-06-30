<script>
  import { onMount, onDestroy } from 'svelte';
  import { Model } from 'survey-core';
  import 'survey-core/survey-core.fontless.min.css';
  import { extractBetterDispatchFromInput } from '../utils/yaml-parser.js';
  import { resolve, resolveObject } from '../utils/interpolate.js';

  let loading = true;
  let error = null;
  let owner = '';
  let repo = '';
  let ref = '';
  let workflowPath = '';
  let workflowFilename = '';
  let standardInputs = [];
  let secrets = {};
  let submitting = false;
  let submitResult = null;
  let surveyContainer;
  let survey = null;

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
      if (!parsed || !parsed.formFileRef) {
        throw new Error('No Better Dispatch form reference found.');
      }
      standardInputs = parsed.standardInputs || [];

      await loadSurveyFromFile(parsed.formFileRef);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    survey?.dispose();
  });

  async function loadSurveyFromFile(filePath) {
    const formResp = await sendMsg('FETCH_WORKFLOW', {
      owner, repo, path: filePath, ref
    });
    if (!formResp.success) throw new Error('Failed to fetch form: ' + formResp.error);

    let surveyJson;
    surveyJson = JSON.parse(formResp.content);

    survey = new Model(surveyJson);
    survey.showCompletedPage = false;

    await preloadDatasources(survey);

    survey.onCompleting.add(async (sender, options) => {
      options.allowComplete = false;
      submitting = true;

      try {
        const data = sender.data;
        const result = {};
        const customValues = {};

        for (const [key, val] of Object.entries(data)) {
          const strVal = Array.isArray(val) ? val.join(',') : String(val ?? '');
          if (standardInputs.includes(key)) {
            result[key] = strVal;
          } else {
            customValues[key] = strVal;
          }
        }

        if (Object.keys(customValues).length > 0) {
          result['better_dispatch_form'] = JSON.stringify(customValues);
        }

        const resp = await sendMsg('DISPATCH_WORKFLOW', {
          owner, repo,
          workflowId: workflowFilename,
          ref,
          inputs: result
        });

        if (resp.success) {
          survey.doComplete();
          submitResult = { type: 'success', message: 'Workflow dispatched successfully!' };
        } else {
          submitResult = { type: 'error', message: resp.error || 'Dispatch failed' };
        }
      } catch (e) {
        submitResult = { type: 'error', message: e.message };
      } finally {
        submitting = false;
      }
    });

    survey.render(surveyContainer);
  }

  async function preloadDatasources(survey) {
    const fetches = [];
    for (const question of survey.getAllQuestions()) {
      const choicesByUrl = question.choicesByUrl;
      if (!choicesByUrl?.url) continue;

      const fetchConfig = question.getPropertyValue('fetchConfig') || {};
      const method = fetchConfig.method || 'GET';
      const headers = fetchConfig.headers
        ? await resolveObject(fetchConfig.headers, secrets)
        : {};
      const resolvedUrl = await resolve(choicesByUrl.url, secrets);

      const promise = sendMsg('FETCH_DATASOURCE', {
        url: resolvedUrl, method, headers
      }).then(resp => {
        if (resp.success) {
          const data = getByPath(resp.data, choicesByUrl.path);
          question.choices = (Array.isArray(data) ? data : []).map(item => ({
            value: String(choicesByUrl.valueName ? item[choicesByUrl.valueName] : item),
            text: String(choicesByUrl.titleName ? item[choicesByUrl.titleName] : item)
          }));
        }
      });
      fetches.push(promise);
    }
    await Promise.all(fetches);
  }

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

  function getByPath(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  function sendMsg(type, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, payload }, resolve);
    });
  }
</script>

<div class="app">
  <header class="app-header">
    <div class="header-left">
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
  {:else if survey}
    <div class="survey-wrapper" class:submitting>
      <div bind:this={surveyContainer}></div>
      {#if submitting}
        <div class="loading-overlay">
          <div class="spinner"></div>
          <p>Dispatching workflow...</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if submitResult}
    <div class="result" class:error={submitResult.type === 'error'} class:success={submitResult.type === 'success'}>
      {submitResult.message}
    </div>
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
    padding: 0 24px 32px;
  }

  .app-header {
    margin-bottom: 16px;
    padding: 20px 0 16px;
    border-bottom: 1px solid #21262d;
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

  .survey-wrapper {
    position: relative;
    min-height: 200px;
  }

  .survey-wrapper.submitting {
    pointer-events: none;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(13, 17, 23, 0.7);
    z-index: 10;
    border-radius: 8px;
  }

  .result {
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    text-align: center;
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

  :global(.sd-root-modern) {
    --sd-base-padding: 0;
    --sd-base-vertical-padding: 0;
    --sjs-general-backcolor: transparent;
    --sjs-general-backcolor-dark: transparent;
    --sjs-general-backcolor-dim: transparent;
    --sjs-general-backcolor-dim-light: transparent;
    --sjs-general-backcolor-dim-dark: transparent;
    --sjs-general-forecolor: #c9d1d9;
    --sjs-general-forecolor-light: #8b949e;
    --sjs-general-dim-forecolor: #c9d1d9;
    --sjs-general-dim-forecolor-light: #8b949e;
    --sjs-primary-backcolor: #2ea043;
    --sjs-primary-backcolor-light: #2ea04333;
    --sjs-primary-backcolor-dark: #238636;
    --sjs-primary-forecolor: #ffffff;
    --sjs-secondary-backcolor: #1f6feb;
    --sjs-secondary-backcolor-light: #1f6feb33;
    --sjs-secondary-forecolor: #ffffff;
    --sjs-border-color: #30363d;
    --sjs-border-inside-color: #30363d;
    --sjs-special-color: #2ea043;
    --sjs-special-hover-color: #238636;
    --sjs-error-background: #f8514910;
    --sjs-error-border-color: #f85149;
    --sjs-error-forecolor: #f85149;
    --sjs-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --sjs-font-questiontitle-size: 14px;
    --sjs-font-questiontitle-weight: 500;
    --sjs-font-questiontitle-color: #e6edf3;
    --sjs-font-pagetitle-size: 18px;
    --sjs-font-pagedescription-size: 14px;
    --sjs-font-editorfont-size: 14px;
    --sjs-font-editorfont-color: #c9d1d9;
    --sjs-editor-background: #161b22;
    --sjs-question-background: transparent;
    --sd-question-padding: 16px 0;
    --sd-base-padding: 0;
  }

  :global(.sd-question__header) {
    margin-bottom: 6px;
  }

  :global(.sd-title) {
    line-height: 1.4;
  }

  :global(.sd-input) {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 8px 12px;
    color: #c9d1d9;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  :global(.sd-input:focus) {
    border-color: #58a6ff;
    box-shadow: 0 0 0 2px #1f6feb33;
  }

  :global(.sd-input::placeholder) {
    color: #484f58;
  }

  :global(.sd-comment) {
    min-height: 120px;
    resize: vertical;
  }

  :global(.sd-btn) {
    background: linear-gradient(135deg, #238636, #2ea043);
    border: 1px solid #2ea043;
    border-radius: 6px;
    padding: 12px 24px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
    font-family: inherit;
    line-height: 1.2;
    margin-top: 8px;
    width: 100%;
  }

  :global(.sd-btn:hover) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  :global(.sd-btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  :global(.sd-tagbox) {
    min-height: 40px;
    cursor: text;
    padding: 4px 8px;
  }

  :global(.sd-tagbox .sd-item) {
    background: #1f6feb33;
    color: #58a6ff;
    padding: 2px 4px 2px 10px;
    border-radius: 12px;
    font-size: 13px;
  }

  :global(.sd-tagbox .sd-item__clean-button) {
    color: #58a6ff;
  }

  :global(.sd-tagbox .sd-item__clean-button:hover) {
    color: #fff;
  }

  :global(.sd-dropdown__filter-string-input) {
    color: #c9d1d9;
  }

  :global(.sv-body__page) {
    gap: 0;
  }

  :global(.sv_q_dropdown) {
    background: #161b22;
  }

  :global(.sv_q_dropdown .sv-list__item) {
    color: #c9d1d9;
  }

  :global(.sv_q_dropdown .sv-list__item--selected) {
    background: #1f6feb33;
    color: #58a6ff;
  }

  :global(.sv_q_dropdown .sv-list__item:hover) {
    background: #1f6feb22;
  }

  :global(.sv-list) {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }

  :global(.sd-progress) {
    display: none;
  }

  :global(.sd-navigation) {
    padding: 0;
  }

  :global(.sd-page__title) {
    display: none;
  }
</style>
