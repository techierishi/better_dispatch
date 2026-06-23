export async function resolve(template, secrets) {
  if (typeof template !== 'string') return template;
  const pattern = /\$\{([^}]+)\}/g;
  let result = template;
  let match;
  while ((match = pattern.exec(template)) !== null) {
    const key = match[1].trim();
    result = result.replace(match[0], secrets[key] || '');
  }
  return result;
}

export async function resolveObject(obj, secrets) {
  if (typeof obj === 'string') return resolve(obj, secrets);
  if (Array.isArray(obj)) return Promise.all(obj.map(item => resolveObject(item, secrets)));
  if (obj && typeof obj === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = await resolveObject(value, secrets);
    }
    return resolved;
  }
  return obj;
}
