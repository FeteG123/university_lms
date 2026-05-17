/** ASCII-safe Unicode escapes (avoids source-file encoding issues on Windows). */
export const EM_DASH = "\u2014";
export const ELLIPSIS = "\u2026";
export const ARROW_LEFT = "\u2190";

export function courseLabel(code: string, title: string): string {
  return `${code} ${EM_DASH} ${title}`;
}

export function backLabel(text: string): string {
  return `${ARROW_LEFT} ${text}`;
}
