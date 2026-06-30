export function extractBetterDispatchFromInput(yamlText) {
  const parsed = parseYaml(yamlText);
  const inputs = parsed?.on?.workflow_dispatch?.inputs;
  if (!inputs) return null;

  let formFileRef = null;

  const enhancedInput = inputs['better_dispatch_form'];
  if (enhancedInput) {
    const defaultStr = enhancedInput.default || enhancedInput['default'];
    if (defaultStr && typeof defaultStr === 'string' && /\.(ya?ml|json)$/i.test(defaultStr.trim())) {
      formFileRef = defaultStr.trim();
    }
  }

  const standardNames = Object.keys(inputs).filter(k => k !== 'better_dispatch_form');
  return { standardInputs: standardNames, formFileRef };
}

export function parseYaml(text) {
  const lines = text.split('\n');
  return parseLines(lines, 0, 0).value;
}

function parseLines(lines, startIndex, baseIndent) {
  const result = {};
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed === '' || trimmed.startsWith('#')) { i++; continue; }
    const currentIndent = line.length - trimmed.length;
    if (currentIndent < baseIndent) break;
    if (currentIndent > baseIndent && i !== startIndex) break;
    if (trimmed.startsWith('- ')) break;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) { i++; continue; }

    const key = trimmed.substring(0, colonIndex).trim();
    const rawValue = trimmed.substring(colonIndex + 1).trim();

    if (rawValue === '' || rawValue === '|' || rawValue === '>') {
      const nextIndent = peekNextIndent(lines, i + 1);
      if (nextIndent > currentIndent) {
        const nextLine = lines[i + 1]?.trimStart();
        if (nextLine && nextLine.startsWith('- ')) {
          const arrResult = parseArrayLines(lines, i + 1, nextIndent);
          result[key] = arrResult.value;
          i = arrResult.nextIndex;
        } else if (rawValue === '|' || rawValue === '>') {
          const blockResult = parseBlockScalar(lines, i + 1, nextIndent, rawValue);
          result[key] = blockResult.value;
          i = blockResult.nextIndex;
        } else {
          const objResult = parseLines(lines, i + 1, nextIndent);
          result[key] = objResult.value;
          i = objResult.nextIndex;
        }
      } else {
        result[key] = rawValue === '|' || rawValue === '>' ? '' : null;
        i++;
      }
    } else {
      result[key] = parseScalar(rawValue);
      i++;
    }
  }
  return { value: result, nextIndex: i };
}

function parseArrayLines(lines, startIndex, baseIndent) {
  const result = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed === '' || trimmed.startsWith('#')) { i++; continue; }
    const currentIndent = line.length - trimmed.length;
    if (currentIndent < baseIndent) break;
    if (trimmed.startsWith('- ')) {
      const itemValue = trimmed.substring(2).trim();
      if (itemValue === '') {
        const nextIndent = peekNextIndent(lines, i + 1);
        if (nextIndent > currentIndent) {
          const objResult = parseLines(lines, i + 1, nextIndent);
          result.push(objResult.value);
          i = objResult.nextIndex;
        } else { result.push(null); i++; }
      } else if (itemValue.includes(':')) {
        const colonIdx = itemValue.indexOf(':');
        const key = itemValue.substring(0, colonIdx).trim();
        const val = itemValue.substring(colonIdx + 1).trim();
        const obj = { [key]: parseScalar(val) };
        const nextIndent = peekNextIndent(lines, i + 1);
        if (nextIndent > currentIndent) {
          const moreResult = parseLines(lines, i + 1, nextIndent);
          Object.assign(obj, moreResult.value);
          result.push(obj);
          i = moreResult.nextIndex;
        } else { result.push(obj); i++; }
      } else { result.push(parseScalar(itemValue)); i++; }
    } else { break; }
  }
  return { value: result, nextIndex: i };
}

function parseBlockScalar(lines, startIndex, blockIndent, style) {
  let result = '';
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { result += '\n'; i++; continue; }
    const currentIndent = line.length - line.trimStart().length;
    if (currentIndent < blockIndent) break;
    result += (result ? '\n' : '') + line.substring(blockIndent);
    i++;
  }
  if (style === '>') result = result.replace(/\n(?!\n)/g, ' ').replace(/\n\n/g, '\n');
  return { value: result.trim(), nextIndex: i };
}

function parseScalar(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

function peekNextIndent(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    return line.length - trimmed.length;
  }
  return -1;
}
