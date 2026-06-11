const KHMER_RE = /[\u1780-\u17FF\u19E0-\u19FF]/

export function containsKhmer(text: string): boolean {
  return KHMER_RE.test(text)
}

/**
 * @react-pdf can clip the final Khmer grapheme when measuring text width.
 * A trailing space prevents the last letter from being cut off in the PDF.
 */
export function pdfKhmerText(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  if (!containsKhmer(value)) return value
  if (/[\s\u00A0\u200B-\u200D\uFEFF]$/.test(value)) return value
  return `${value}\u00A0`
}
