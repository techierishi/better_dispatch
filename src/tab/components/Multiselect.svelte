<script>
  import { createEventDispatcher } from 'svelte';

  export let el = {};
  export let options = [];
  export let value = [];

  const dispatch = createEventDispatcher();

  let open = false;
  let query = '';
  let highlightIdx = -1;

  $: filtered = options.filter(o =>
    !value.includes(o.value) &&
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  function toggle(opt) {
    if (value.includes(opt.value)) {
      value = value.filter(v => v !== opt.value);
    } else {
      value = [...value, opt.value];
    }
    query = '';
    dispatch('change', value);
  }

  function remove(val) {
    value = value.filter(v => v !== val);
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
      toggle(filtered[highlightIdx]);
    } else if (e.key === 'Escape') {
      open = false;
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  function onFocus() {
    open = true;
    query = '';
    highlightIdx = -1;
  }

  function onBlur() {
    setTimeout(() => { open = false; }, 150);
  }

  function getLabel(val) {
    return options.find(o => o.value === val)?.label || val;
  }
</script>

<div class="multi-wrap">
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="multi-box" class:open on:click={() => open = true}>
    <div class="pills">
      {#each value as val}
        <span class="pill">
          {getLabel(val)}
          <button
            type="button"
            class="pill-x"
            on:mousedown|preventDefault|stopPropagation={() => remove(val)}
          >×</button>
        </span>
      {/each}
      <input
        type="text"
        class="multi-input"
        placeholder={value.length === 0 ? (el.placeholder || 'Search...') : ''}
        bind:value={query}
        on:focus={onFocus}
        on:blur={onBlur}
        on:keydown={onKeydown}
        autocomplete="off"
      />
    </div>
  </div>

  {#if open && filtered.length > 0}
    <ul class="dropdown" role="listbox">
      {#each filtered as opt, i}
        <li
          class="option"
          class:highlighted={i === highlightIdx}
          on:mousedown|preventDefault={() => toggle(opt)}
          role="option"
          aria-selected="false"
        >
          <span class="check">✓</span>
          <span class="option-label">{opt.label}</span>
        </li>
      {/each}
    </ul>
  {:else if open && query}
    <div class="empty">No matching options</div>
  {/if}
</div>

<style>
  .multi-wrap {
    position: relative;
  }

  .multi-box {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 4px 8px;
    transition: border-color 0.2s;
    cursor: text;
  }

  .multi-box.open,
  .multi-box:focus-within {
    border-color: #58a6ff;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #1f6feb33;
    color: #58a6ff;
    padding: 2px 4px 2px 10px;
    border-radius: 12px;
    font-size: 13px;
    white-space: nowrap;
  }

  .pill-x {
    background: none;
    border: none;
    color: #58a6ff;
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
    line-height: 1;
    border-radius: 50%;
    display: flex;
    align-items: center;
  }

  .pill-x:hover {
    background: #1f6feb55;
    color: #fff;
  }

  .multi-input {
    flex: 1;
    min-width: 80px;
    background: transparent;
    border: none;
    padding: 4px;
    color: #c9d1d9;
    font-size: 14px;
    outline: none;
  }

  .multi-input::placeholder {
    color: #484f58;
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
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .option:hover,
  .option.highlighted {
    background: #1f6feb33;
  }

  .check {
    color: #3fb950;
    font-size: 12px;
    width: 16px;
    visibility: hidden;
  }

  .option-label {
    color: #c9d1d9;
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
