// Bad-language filter for chat (Arabic + English). Demo word list; production adds a moderation API.
const AR = ['غبي', 'غبية', 'حمار', 'كلب', 'تافه', 'حقير', 'زفت', 'يلعن', 'وسخ', 'منحط', 'حيوان', 'نصاب', 'كذاب', 'خايس'];
const EN = ['stupid', 'idiot', 'damn', 'shit', 'fuck', 'fucking', 'bastard', 'crap', 'dumb', 'moron', 'scammer', 'liar', 'loser'];

/** Normalize Arabic letter variants, strip diacritics/tatweel, collapse repeats, decode simple leetspeak. */
export function normalize(w: string) {
  return w
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/\$/g, 's').replace(/@/g, 'a')
    .replace(/[^\p{L}]/gu, '')
    .replace(/(.)\1+/g, '$1');
}
const BAD = new Set([...AR, ...EN].map(normalize));
const stripPrefix = (w: string) => w.replace(/^(ال|يا|و)/, '');

export function isBad(word: string) {
  const n = normalize(word);
  if (!n) return false;
  return BAD.has(n) || BAD.has(stripPrefix(n));
}

/** Split text into parts, flagging bad words so the UI can blur them. */
export function moderate(text: string): { t: string; bad: boolean }[] {
  return text.split(/(\s+)/).map((t) => ({ t, bad: !/^\s+$/.test(t) && isBad(t) }));
}
export const hasBad = (text: string) => moderate(text).some((p) => p.bad);
