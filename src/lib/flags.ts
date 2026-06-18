/* Фиче-флаги фронта. Включать ТОЛЬКО когда готов соответствующий бэк-контракт
   И он задеплоен на прод — иначе UI «врёт» (вызовы 404 / правка молча теряется).
   Для локального теста флаги можно временно поставить true (не коммитить true). */

export const FLAGS = {
  /**
   * Inline-редактирование текста заметок и текста напоминаний.
   * Бэк (тикеты 8uu/0rn) — в main, НЕ задеплоен на прод. До деплоя = false.
   * Брифы: bookmark-brain/docs/prd/REMINDER-TEXT-EDIT.md, BOOKMARK-TEXT-EDIT.md.
   */
  TEXT_EDIT: false,

  /**
   * Связи между заметками (Connections, Phase 5A): секция «Связано», таб «Граф»,
   * семантический режим поиска. Бэк-слой связей в main, НЕ задеплоен на прод. До деплоя = false.
   * Бриф: bookmark-brain/docs/prd/CONNECTIONS-MINIAPP.md.
   */
  CONNECTIONS: false,

  /**
   * Пространства (Spaces) — фича не готова. Скрывает таб «Пространства» и пункт
   * «В пространство» в шторке действий. Включить, когда фича будет доделана.
   */
  SPACES: false,

  /**
   * Голосовой ввод в Mini App (тикет ti0, фаза 1): кнопка 🎤 в QuickCreate, запись через
   * MediaRecorder → POST /bookmarks/upload. Бэк (3sr/бт-12) в main, требует деплоя
   * (S3 + ffmpeg в воркере + Yandex STT). В РЕПО = false, локально временно true.
   * Бриф: bookmark-brain/docs/prd/MINIAPP-MEDIA-UPLOAD.md.
   */
  VOICE_UPLOAD: false,
} as const;
