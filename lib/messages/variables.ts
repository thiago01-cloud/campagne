// Message variables: {{nom}} or {{nom|Client}} (fallback when empty)
export const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g;

export function fillVariables(template: string, data: Record<string, unknown>) {
  return template.replace(VARIABLE_REGEX, (_, key: string, fallback?: string) => {
    const v = data[key];
    const text = v === null || v === undefined ? "" : String(v).trim();
    return text || (fallback ?? "").trim();
  });
}

/** Variables used in a template that don't exist among the list's columns */
export function unknownVariables(template: string, columns: string[]) {
  const unknown = new Set<string>();
  for (const m of template.matchAll(VARIABLE_REGEX)) if (!columns.includes(m[1])) unknown.add(m[1]);
  return [...unknown];
}
