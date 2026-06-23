<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let el = {};
  export let options = [];
  export let value = '';

  const dispatch = createEventDispatcher();

  let open = false;
  let query = '';
  let highlightIdx = -1;
  let container;

  onMount(async () => {
    if (el.datasource) {
      const resp = await new Promise(r =>
        chrome.runtime.sendMessage({ type: 'GET_DATASOURCE', payload: { el } }, r)
      );
      if (resp?.success) options = resp.data;
    }
  });

  $: filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  $: selectedLabel = options.find(o => o.value === value)?.label || '';

  function select(opt) {
    value = opt.value;
    query = '';
    open = false;
    dispatch('change', value);
  }

  function onKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { open = true; highlightIdx = 0; }
      else highlightIdx = Math.min(highlightIdx + 1, filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIdx = Math.max(highlightIdx - 1, 0);
    } else if (e.key === 'Enter' && open && highlightIdx >= 0) {
      e.preventDefault();
      select(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      open = false;
    }
  }

  function onInputFocus() {
    open = true;
    query = '';
  }

  function onInputBlur() {
    setTimeout(() => { open = false; }, 150);
  }
</script>

<div class="select-wrap" bind:this={container}>
  <div class="select-box" class:open>
    <input
      type="text"
      class="select-input"
      placeholder={el.placeholder || 'Search...'}
      bind:value={query}
      on:focus={onInputFocus}
      on:blur={onInputBlur}
      on:keydown={onKeydown}
      autocomplete="off"
    />
    {#if selectedLabel && !open}
      <span class="selected-pill">{selectedLabel}</span>
    {/if}
  </div>

  {#if open && filtered.length > 0}
    <ul class="dropdown" role="listbox">
      {#each filtered as opt, i}
        <li
          class="option"
          class:selected={opt.value === value}
          class:highlighted={i === highlightIdx}
          on:mousedown|preventDefault={() => select(opt)}
          role="option"
          aria-selected={opt.value === value}
        >
          <span class="option-label">{opt.label}</span>
          {#if opt.value !== opt.label}
            <span class="option-value">{opt.value}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if open && query}
    <div class="empty">No matching options</div>
  {/if}
</div>

<style>
  .select-wrap {
    position: relative;
  }

  .select-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 0;
    transition: border-color 0.2s;
  }

  .select-box.open,
  .select-box:focus-within {
    border-color: #58a6ff;
  }

  .select-input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 8px 12px;
    color: #c9d1d9;
    font-size: 14px;
    outline: none;
    min-width: 0;
  }

  .select-input::placeholder {
    color: #484f58;
  }

  .selected-pill {
    font-size: 12px;
    color: #58a6ff;
    background: #1f6feb22;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
    margin-right: 8px;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    max-height: 240px;
    overflow-y: auto;
    z-index: 100;
    list-style: none;
    margin: 0;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }

  .option {
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 14px;
  }

  .option:hover,
  .option.highlighted {
    background: #1f6feb33;
  }

  .option.selected {
    color: #58a6ff;
  }

  .option-label {
    color: #c9d1d9;
  }

  .option-value {
    color: #484f58;
    font-size: 12px;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }

  .empty {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;
    text-align: center;
    color: #8b949e;
    font-size: 13px;
    z-index: 100;
  }
</style>
