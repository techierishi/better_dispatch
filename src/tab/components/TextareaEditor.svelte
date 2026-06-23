<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { EditorView, keymap } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { defaultKeymap } from '@codemirror/commands';
  import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { markdown } from '@codemirror/lang-markdown';
  import { json } from '@codemirror/lang-json';
  import { yaml } from '@codemirror/lang-yaml';
  import { javascript } from '@codemirror/lang-javascript';

  export let el = {};
  export let value = '';

  const dispatch = createEventDispatcher();
  let container;
  let view;
  let updating = false;

  const LANGS = { markdown, json, yaml, javascript, js: javascript };

  onMount(() => {
    const lang = LANGS[el.language] || null;
    const extensions = [
      oneDark,
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of(defaultKeymap),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !updating) {
          dispatch('change', update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': { minHeight: '180px', fontSize: '14px' },
        '.cm-content': { fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace" },
        '.cm-scroller': { overflow: 'auto' }
      })
    ];

    if (lang) extensions.push(lang());

    view = new EditorView({
      state: EditorState.create({
        doc: value || '',
        extensions
      }),
      parent: container
    });
  });

  onDestroy(() => {
    view?.destroy();
  });

  $: if (view && value !== view.state.doc.toString()) {
    updating = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value || '' }
    });
    updating = false;
  }
</script>

<div class="editor-wrap" class:fullscreen={false}>
  <div class="editor-toolbar">
    <span class="lang-badge">{el.language || 'text'}</span>
  </div>
  <div class="editor-container" bind:this={container}></div>
</div>

<style>
  .editor-wrap {
    border: 1px solid #30363d;
    border-radius: 6px;
    overflow: hidden;
    background: #282c34;
  }

  .editor-toolbar {
    background: #21262d;
    padding: 4px 12px;
    border-bottom: 1px solid #30363d;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .lang-badge {
    font-size: 11px;
    color: #8b949e;
    background: #30363d;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    text-transform: uppercase;
  }

  .editor-container :global(.cm-editor) {
    background: transparent;
  }

  .editor-container :global(.cm-editor.cm-focused) {
    outline: none;
  }
</style>
