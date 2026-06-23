/* Чистая логика регулярных напоминаний (MVP = ежедневно).
   Mini App шлёт структурно (text + hour + minute) в POST /api/v1/recurring — бэк НЕ
   парсит (парсер recurrence_parser остался только для бот-команды /repeat). Здесь —
   формат для показа серии и клиентская валидация перед отправкой. */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Подпись серии для списка: «каждый день в HH:MM». */
export function fmtRecurrence(hour: number, minute: number): string {
  return `каждый день в ${pad2(hour)}:${pad2(minute)}`;
}

/** Можно ли создать серию: непустой текст + валидное время (0–23 ч, 0–59 мин). */
export function canCreateRecurring(text: string, hour: number, minute: number): boolean {
  return text.trim().length > 0 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
