/* Фиче-флаги фронта. Включать ТОЛЬКО когда готов соответствующий бэк-контракт —
   иначе UI «врёт» (правка молча теряется). */

export const FLAGS = {
  /**
   * Inline-редактирование текста заметок и текста напоминаний.
   * Требует бэка:
   *   - тикет 8uu — PATCH /reminders принимает text → payload.text
   *     (бриф: bookmark-brain/docs/prd/REMINDER-TEXT-EDIT.md)
   *   - тикет 0rn — BookmarkUpdate.raw_text + ai_status как сигнал переобработки
   *     (бриф: bookmark-brain/docs/prd/BOOKMARK-TEXT-EDIT.md)
   * До мерджа контракта = false. Фронт-код ниже по флагу уже готов («набросок вперёд»).
   */
  TEXT_EDIT: false,
} as const;
