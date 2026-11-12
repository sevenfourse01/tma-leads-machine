// {{var}} substitution for approved copy. Deliberately tiny: no conditionals, no loops.
// Reused from tma-systems/core/src/template.js. A template that names a variable the caller did not
// supply fails loudly: sending a patient a literal '{{firstName}}' is worse than sending nothing.

export class TemplateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TemplateError';
    this.code = 'TEMPLATE';
  }
}

export function fillTemplate(template, vars = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars) || vars[key] == null) {
      throw new TemplateError(`Template needs variable '${key}'. Refusing to render a placeholder into a real message.`);
    }
    return String(vars[key]);
  });
}

/** The variable names a template uses, so a lint can check the library against what the system supplies. */
export function templateVars(template) {
  const out = new Set();
  String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    out.add(key);
    return '';
  });
  return [...out];
}
