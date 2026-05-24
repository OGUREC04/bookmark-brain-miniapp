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

## 4 решения, которые НЕЛЬЗЯ ломать по незнанию

1. **Навигация state-driven, роутера НЕТ.** Навигация = `useState` в `App.tsx`
   (`tab`/`searchOpen`/`detail`/`sheet`). `react-router` удалён намеренно — Telegram WebView
   плохо живёт с history API на iOS. Новый экран = новая ветка в state-машине `App.tsx`,
   не `<Routes>`. Telegram `BackButton` подключён вручную в `App.tsx`.

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

Редактирование task-list в Mini App (PRD был в монорепо `docs/prd/TASK-LIST-EDITING.md`):
US-1 (тоггл) готов; дальше US-2 (edit), US-3 (delete+undo), US-4 (add), дедлайн на пункте.
См. `src/components/ds/TaskListEditor.tsx`.

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
