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
   * Голосовой ввод в Mini App (тикет ti0): кнопка 🎤 в ComposeScreen, запись через
   * MediaRecorder → POST /bookmarks/upload. Бэк (3sr/бт-12) в main; дев-инфра готова —
   * Yandex S3 `bookmarkbrain-stt` + Yandex STT (те же, что у бота) + ffmpeg в воркере.
   * ПРОДА НЕТ → включено для дева (true) с 2026-06-18.
   * Бриф: bookmark-brain/docs/prd/MINIAPP-MEDIA-UPLOAD.md.
   */
  VOICE_UPLOAD: true,
} as const;
