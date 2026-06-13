# CLAUDE.md — BookmarkBrain Mini App

Telegram Mini App для BookmarkBrain. **React 18 + TypeScript + Vite 6**, без роутера.
Это **frontend-only** репозиторий, вынесенный из монорепо `bookmark-brain`.

## Где что лежит

| Часть | Репозиторий |
|---|---|
| Этот фронт (Mini App UI) | **здесь** (`bookmark-brain-miniapp`) |
| Backend (FastAPI), Telegram bot, worker, схемы БД | монорепо `bookmark-brain` (соседняя папка `../bookmark-brain`) |

Фронт общается с бэком по относительным путям `/api/v1/...`; Vite проксирует `/api` →
`http://localhost:8000` (см. `vite.config.ts`). **API-контракт здесь не определяется** —
типы (`Bookmark`, `TaskListData`, `TaskItem` в `src/lib/api.ts`) дублируют Pydantic-схемы
бэкенда. **При изменении схемы на бэке — правь типы здесь в тот же заход**, иначе молчаливый
рантайм-дрейф.

## Запуск

```bash
npm install        # один раз
npm run dev        # Vite dev server :3000 (проксирует /api → :8000)
npm run build      # tsc (строгий) + vite build — прод-сборка
```

Для живого теста в Telegram backend/bot/ngrok поднимаются из монорепо (`../bookmark-brain`,
см. его `.claude/STARTUP.md`). ngrok туннелит :3000.

**`tsc` падает на любой ошибке типов — это gate.** Прод-сборка зелёная = типы сошлись.

### Headless E2E (без Telegram-клиента)

`src/lib/api.ts` имеет DEV-only fallback: если `getInitData()` пустой (запуск в браузере, не в Telegram) — берётся `localStorage.__dev_init_data`. Бэкенд принимает `dev:<id>` только за тройным guard'ом (см. монорепо `docs/ARCHITECTURE.md` → «DEV-only auth bypass»). В проде это безвредно — бэк отбивает все `dev:` без guard'а.

## 4 решения, которые НЕЛЬЗЯ ломать по незнанию

1. **Навигация state-driven, роутера НЕТ.** Навигация = `useState` в `App.tsx`:
   `tab` (базовая вкладка) + `stack: ViewLayer[]` (СТЕК слоёв над вкладкой: search/space/detail)
   + `sheet` (модалки поверх всего). `react-router` удалён намеренно — Telegram WebView плохо
   живёт с history API на iOS. **Единый источник приоритета:** верх стека (`top`) рендерится;
   back снимает `sheet`, иначе `popView()`. Новый экран-слой = новый вариант `ViewLayer`
   (не дублировать приоритет в render/BackButton/nav-visibility, как было до рефактора ntn).
   Telegram `BackButton` подключён вручную (show/hide завязаны на `overlayOpen`, обработчик
   через ref — иначе мигал при sheet-over-detail).

2. **`components/ds/*` — залоченный 1:1 порт дизайн-системы с inline-стилями.** Это НАМЕРЕННО,
   не техдолг. Не рефактори inline → CSS-классы, не «причёсывай». Меняешь визуал → сначала
   эталон ДС, потом сюда. CSS-переменные — из `src/styles/tokens.css` (вендорный файл ДС,
   руками не править).

3. **Бренд залочен (sage `#7A9C7A`), тема Telegram НЕ инжектится.** `lib/telegram.ts →
   applyTheme()` жёстко ставит светлую схему и НЕ пробрасывает `--tg-theme-*`. Не возвращай
   tg-theme bridge (ломал бренд в синий, тёмный фон убивал перф на `backdrop-filter`).

4. **`lib/adapters.ts` — единственный шов backend↔UI.** UI-компоненты не знают про `Bookmark`.
   Всё преобразование `Bookmark → пропсы` — только здесь. Новое поле бэка → правка только тут,
   не размазывать по экранам.

## Конвенция навигации шторок (BottomSheet)

Единое правило для всех `*Sheet` через `SheetTitle`:
- **Назад** = шеврон `‹` слева (`onBack`) — шаг назад в флоу к предыдущей шторке.
- **Закрыть** = `×` справа (`onClose`) — закрыть шторку целиком. Свайп/клик-вне (`onDismiss`) тоже закрывает.
- **Не на каждой шторке оба.** Точка входа (из ленты/FAB) — только `×`. Вложенная — `‹` + `×`.
  Под-состояние внутри одной шторки (напр. календарь в пикере) — `‹` к предыдущему шагу, без `×`.

Пример (напоминания): список `(×)` → snooze → пикер-пресеты `(‹ к списку + ×)` →
«выбрать дату» → календарь `(‹ к пресетам, без ×)`.

## Слои (строго однонаправленные)

```
screens/  → components/ds/  (только примитивные пропсы; ds НИКОГДА не импортит lib/ или screens/)
screens/  → lib/  → api
```

## Конвенции кода

- **Иммутабельность:** не мутировать, возвращать новые объекты (`{...x, field}`, `map`, не `push`).
- **Именование:** переменные/функции `camelCase`, типы/компоненты `PascalCase`, хуки `useX`,
  булевы `is/has/should/can`.
- **Размер файлов:** держать < 400 LOC; > 600 — думать о сплите; никогда не добавлять в файл > 800.
- Без мёртвого кода, без комментариев-«что» (только «почему», если неочевидно).
- Эмодзи в коде/UI — только если явно просят.

## Активная работа

**Редактирование task-list** (PRD `../bookmark-brain/docs/prd/TASK-LIST-EDITING.md`) — закрыто:
тоггл/edit/delete+undo/add/дедлайн. Редактор — Things3-стиль (чекбокс 20px, underline-edit,
дедлайн-чип под текстом, `⋮`-меню, DS-календарь + TimeWheel). См. `components/ds/TaskListEditor.tsx`
(+ `TaskRow`, `AddRow`, `Calendar`, `TimeWheel`, `DatePickerSheet`).

**DS-полиш по макетам дизайнера** (`docs/DESIGN-BRIEF.md` + дизайн-архив `bookmarkbrain-design-system`)
— основное сделано (2026-05-27): glass-токены в `tokens.css`; `SpaceDetailScreen` (открытие папки,
bd 8g1 open-часть); `MeScreen` (тогглы локальные — бэкенда настроек нет); `DetailScreen` (плоская
раскладка, инлайн-теги, brain-блок, копировать-ссылку); ChatRow (Things3, typed-аватар, src-пилюля,
без разделителей); лента Mysli (без h1, круглый bell + счётчики чипов + icon view-segment);
Nav (без активной капсулы); редактор задач Things3-гибрид. Фон: главная/списки — однотон,
градиент только на заметке. Шторки оставлены текущими по решению пользователя.

**Полиш шторок напоминаний** (2026-06-01, 5 раундов фидбека) — основное сделано:
`ReminderPickerSheet` (пресеты-карточки 2×2, при переносе 1-я = исходное время; dirty-кнопка;
время-бейдж в заголовке; текст-textarea read-only при переносе; календарь compact + TimeWheel
compact 3-строки; время+текст+кнопка закреплены, скроллится середина); `RemindersSheet`
(карточка кликабельна=перенос, × отмена иконкой, бейдж счётчика, sentence-case, minHeight 340);
конвенция шторок: **‹ зелёный шеврон назад / «Закрыть» зелёный текст** (`SheetTitle.onBack/onClose`),
заголовки 18px. 2 ревью пройдено. **Детали и план следующей сессии → `docs/POLISH-ROUND-2026-05.md`.**

**Барабан-поповер времени** (2026-06-01, тикет `tb1`) — сделано: в custom-режиме пикера
(«Выбрать дату и время») вместо стопки Calendar+TimeWheel теперь календарь + строка «Время»
(пилюля со значением); тап открывает TimeWheel во всплывающей карточке (`position:fixed`,
z-index 110, тап-вне/«Готово» закрывает). Разгружает прежде тесную стопку.

**Глобальный sentence-case** (2026-06-01) — сделано: продукт-оверрайд lowercase-DS. Первая
буква заглавная по всему UI (nav, заголовки шторок, кнопки, плейсхолдеры, empty-state, тосты,
бейджи, месяцы календаря) — ~54 строки в 17 файлах. НЕ тронуто: aria-labels; uppercase-кикеры
(`textTransform` — стиль, не регистр); lowercase-домены/src-пилюли; weekday-аббревиатуры;
inline-таймстемпы `formatters.ts`. Если добавляешь новый видимый текст — сразу sentence-case.

**Воздух в шторках напоминаний, раунд 2** (2026-06-01): шапка `SheetTitle` (padding 8/16→14/18,
gap back↔заголовок 12→16); `RemindersSheet` (minHeight 340→400, строки 12→15px, группы 10→18);
пикер (текст-карточка mb 18→22, пресеты gap 10→12). Прошлая правка была незаметна за кэшем
Telegram WebView (нужен hard-close).

**Правка текста (заметки + напоминания) — набросок за фиче-флагом** (2026-06-01): фронт-код
готов «вперёд», выключен `FLAGS.TEXT_EDIT` (`src/lib/flags.ts`) до бэк-контракта. Требует бэка:
тикет `8uu` (PATCH /reminders → `text`→payload) и `0rn` (BookmarkUpdate.`raw_text` + `ai_status`
как сигнал переобработки). Брифы — монорепо `docs/prd/REMINDER-TEXT-EDIT.md` и `BOOKMARK-TEXT-EDIT.md`.
Когда бэк смержит — поставить флаг `true`, проверить контракт, поправить типы в `src/lib/api.ts`.
Реализовано: `api.reminders.update({fireAt,text})`, `api.updateBookmarkText`, снятие `readOnly`
в `ReminderPickerSheet`, inline-редактор тела текста в `DetailScreen` (textarea + «Изменить/Готово»,
состояние переобработки по `ai_status`). E2E-проверено при флаге=true, зашипано при false.

**Остаётся (next, см. лог):** recurrence «Повторять» (тикет `8r4`, P3 бэклог, +бэк). Бэклог:
создание пространства (`8g1`); SuggestionCard (`ntn`); facet-чипы (`0u7`); медиа QuickCreate
(`ti0`); контекст ссылок — бэк (`z9q`). _ActionSheet close: решено — «Закрыть» зелёным текстом._

## Жизненный цикл фичи + БТ

Канон процесса — в монорепо: `../bookmark-brain/.claude/rules/development-workflow.md`
(триаж → PRD → развилки → план → TDD → review → ADR → **БТ** → close). Те же правила здесь.

**БТ (бизнес-требования) канонично лежат в `../bookmark-brain/docs/requirements/`** — одна
страница на фичу, с секциями «Bot/Backend» И «Mini App». Меняешь поведение Mini App
(новый экран, sheet, флоу) → **правь секцию «Mini App» в соответствующем БТ в тот же заход**
(living-doc, как и типы из `src/lib/api.ts`). Шаблон — `docs/requirements/_ШАБЛОН.md`.

Жанры не смешивать: PRD = зачем (`docs/prd/`), ADR = почему (`docs/decisions/`),
**БТ = как сейчас** (`docs/requirements/`). Подробно — `docs/requirements/README.md`.

## Трекинг

Задачи проекта ведутся в Beads в монорепо (`cd ../bookmark-brain && bd ...`, префикс
`bookmark-brain-`). В этом репо `.beads/` нет.
