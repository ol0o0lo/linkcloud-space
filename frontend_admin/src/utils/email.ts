const EMAIL_INPUT_TRANSLATION: Record<string, string> = {
  '。': '.',
  '．': '.',
  '｡': '.',
  '＠': '@',
  '﹫': '@',
};

export function normalizeEmailLikeInput(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/[。．｡＠﹫]/g, (char) => EMAIL_INPUT_TRANSLATION[char] || char);
}

