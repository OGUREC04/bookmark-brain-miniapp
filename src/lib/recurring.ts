/* Чистая логика регулярных напоминаний (MVP = ежедневно).
   Бэк парсит сырой текст «<текст> каждый день в HH:MM» (recurrence_parser, daily-only),
   поэтому фронт из структурного ввода (текст + час:минута) строит эту каноничную строку —
   парсер её гарантированно понимает. Здесь же — формат для показа и валидация. */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Каноничная строка для POST /api/v1/recurring (бэк-парсер её точно распознает). */
export function buildRecurringRaw(text: string, hour: number, minute: number): string {
  return `${text.trim()} каждый день в ${pad2(hour)}:${pad2(minute)}`;
}

/** Подпись серии для списка: «каждый день в HH:MM». */
export function fmtRecurrence(hour: number, minute: number): string {
  return `каждый день в ${pad2(hour)}:${pad2(minute)}`;
}

/** Можно ли создать серию: непустой текст + валидное время (0–23 ч, 0–59 мин). */
export function canCreateRecurring(text: string, hour: number, minute: number): boolean {
  return text.trim().length > 0 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
