// SMS character and segment count (GSM 7-bit: 160 / 153 ; Unicode: 70 / 67)
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENSION = "^{}\\[~]|€\f";

export type SmsCount = { characters: number; segments: number; encoding: "GSM" | "Unicode"; perSegment: number; specialCharacters: string[] };

export function countSms(text: string): SmsCount {
  let units = 0;
  const special = new Set<string>();
  for (const c of text) {
    if (GSM_BASIC.includes(c)) units += 1;
    else if (GSM_EXTENSION.includes(c)) units += 2;
    else special.add(c);
  }
  if (special.size === 0) {
    const segments = units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153);
    return { characters: units, segments, encoding: "GSM", perSegment: units <= 160 ? 160 : 153, specialCharacters: [] };
  }
  const length = text.length; // UTF-16 units (an emoji counts as 2)
  const segments = length <= 70 ? 1 : Math.ceil(length / 67);
  return { characters: length, segments, encoding: "Unicode", perSegment: length <= 70 ? 70 : 67, specialCharacters: [...special] };
}

export function finalSmsText(message: string, stopMention: boolean, stopText: string) {
  return stopMention && stopText.trim() ? `${message.trimEnd()}\n${stopText.trim()}` : message;
}
