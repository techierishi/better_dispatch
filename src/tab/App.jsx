import { useEffect, useRef, useState } from 'preact/hooks';
import { Model } from 'survey-core';
import { renderSurvey } from 'survey-js-ui';
import 'survey-core/survey-core.fontless.min.css';
import { extractBetterDispatchFromInput } from '../utils/yaml-parser.js';
import { resolve, resolveObject } from '../utils/interpolate.js';

export function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [survey, setSurvey] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const containerRef = useRef(null);
  const standardInputsRef = useRef([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const owner = params.get('owner') || '';
    const repo = params.get('repo') || '';
    const ref = params.get('ref') || 'main';
    const workflowPath = params.get('workflowPath') || '';
    const workflowFilename = params.get('workflowFilename') || '';

    (async () => {
      try {
        const secretsResp = await sendMsg('GET_SECRETS');
        const secrets = secretsResp.secrets || {};

        const workflowResp = await sendMsg('FETCH_WORKFLOW', { owner, repo, path: workflowPath, ref });
        if (!workflowResp.success) throw new Error(workflowResp.error);

        const parsed = extractBetterDispatchFromInput(workflowResp.content);
        if (!parsed?.formFileRef) throw new Error('No Better Dispatch form reference found.');
        standardInputsRef.current = parsed.standardInputs || [];

        const formResp = await sendMsg('FETCH_WORKFLOW', { owner, repo, path: parsed.formFileRef, ref });
        if (!formResp.success) throw new Error('Failed to fetch form: ' + formResp.error);

        const model = new Model(JSON.parse(formResp.content));
        model.showCompletedPage = false;

        await preloadDatasources(model, secrets);

        model.onCompleting.add(async (sender, options) => {
          options.allowComplete = false;
          setSubmitting(true);

          try {
            const data = sender.data;
            const result = {};
            const customValues = {};

            for (const [key, val] of Object.entries(data)) {
              const strVal = Array.isArray(val) ? val.join(',') : String(val ?? '');
              if (standardInputsRef.current.includes(key)) {
                result[key] = strVal;
              } else {
                customValues[key] = strVal;
              }
            }

            if (Object.keys(customValues).length > 0) {
              result['better_dispatch_form'] = JSON.stringify(customValues);
            }

            const resp = await sendMsg('DISPATCH_WORKFLOW', { owner, repo, workflowId: workflowFilename, ref, inputs: result });

            if (resp.success) {
              model.doComplete();
              setSubmitResult({ type: 'success', message: 'Workflow dispatched successfully!' });
            } else {
              setSubmitResult({ type: 'error', message: resp.error || 'Dispatch failed' });
            }
          } catch (e) {
            setSubmitResult({ type: 'error', message: e.message });
          } finally {
            setSubmitting(false);
          }
        });

        setSurvey(model);
        setLoading(false);
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (survey && containerRef.current) {
      renderSurvey(survey, containerRef.current);
      return () => survey.dispose();
    }
  }, [survey]);

  return (
    <div class="app">
      <header class="app-header">
        <div class="workflow-info">
          <span class="repo">{getParam('owner')}/{getParam('repo')}</span>
          <span class="sep">·</span>
          <span class="ref">{getParam('ref')}</span>
          <span class="sep">·</span>
          <span class="file">{getParam('workflowFilename')}</span>
        </div>
      </header>

      {loading && (
        <div class="state-panel">
          <div class="spinner"></div>
          <p>Loading workflow configuration...</p>
        </div>
      )}

      {!loading && error && (
        <div class="state-panel error-panel">
          <p class="error-title">Failed to load</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && survey && (
        <div class={`survey-wrapper${submitting ? ' submitting' : ''}`}>
          <div ref={containerRef}></div>
          {submitting && (
            <div class="loading-overlay">
              <div class="spinner"></div>
              <p>Dispatching workflow...</p>
            </div>
          )}
        </div>
      )}

      {submitResult && (
        <div class={`result ${submitResult.type === 'error' ? 'error' : 'success'}`}>
          {submitResult.message}
        </div>
      )}
    </div>
  );
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
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

async function preloadDatasources(model, secrets) {
  const fetches = [];
  for (const question of model.getAllQuestions()) {
    const cbu = question.choicesByUrl;
    if (!cbu?.url) continue;

    const fetchConfig = question.getPropertyValue('fetchConfig') || {};
    const method = fetchConfig.method || 'GET';
    const headers = fetchConfig.headers ? await resolveObject(fetchConfig.headers, secrets) : {};
    const resolvedUrl = await resolve(cbu.url, secrets);

    const promise = sendMsg('FETCH_DATASOURCE', { url: resolvedUrl, method, headers })
      .then(resp => {
        if (resp.success) {
          const data = getByPath(resp.data, cbu.path);
          question.choices = (Array.isArray(data) ? data : []).map(item => ({
            value: String(cbu.valueName ? item[cbu.valueName] : item),
            text: String(cbu.titleName ? item[cbu.titleName] : item)
          }));
        }
        question.choicesByUrl = null;
      });
    fetches.push(promise);
  }
  await Promise.all(fetches);
}
