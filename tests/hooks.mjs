// Node module hook: maps the bare specifier "three" to the stub so the smoke test can run without a browser.
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('./stub-three.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
