---
name: BookmarkBrain Mini App
description: Тихий «второй мозг» в Telegram — тёплая бумага, sage-акцент, жидкое стекло
colors:
  brand-sage: "#7A9C7A"
  brand-sage-hover: "#688A68"
  brand-sage-press: "#547654"
  brand-sage-tint: "#E2EDE2"
  paper-page: "#F5F1EB"
  paper-surface: "#FAF7F1"
  paper-elevated: "#FFFCF6"
  paper-sunken: "#EAE3CF"
  ink-1: "#2C2825"
  ink-2: "#6B645B"
  ink-3: "#9A938A"
  ink-4: "#C5BFB4"
  on-brand: "#FFFFFF"
  border-hairline: "#E8E1D2"
  border-edge: "#D8CFBC"
  border-strong: "#BDB29A"
  ai-suggest-bg: "#ECF2EC"
  ai-suggest-border: "#CFDFCF"
  ai-suggest-fg: "#2F4A2F"
  success: "#5A8A56"
  warn: "#C49454"
  error: "#B5483A"
  info: "#5A7A8A"
  tag-sage: "#7A9C7A"
  tag-ochre: "#C18840"
  tag-slate: "#4F6A7A"
  tag-plum: "#8A5C8C"
  tag-clay: "#B5483A"
  tag-moss: "#6B7A3F"
  tag-rose: "#C84B5A"
  tag-taupe: "#8E908A"
typography:
  display:
    fontFamily: "Lora, 'Source Serif 4', Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Onest, -apple-system, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Onest, -apple-system, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Onest, -apple-system, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.08em"
rounded:
  chip: "999px"
  input: "10px"
  card: "16px"
  tile: "22px"
  sheet: "28px"
  glyph: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-sage}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.glyph}"
    padding: "10px"
    height: "40px"
  button-primary-press:
    backgroundColor: "{colors.brand-sage-press}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.glyph}"
  card:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.chip}"
    padding: "6px 12px"
  input-composer:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-1}"
    rounded: "22px"
    padding: "8px"
  sheet:
    backgroundColor: "{colors.paper-elevated}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.sheet}"
  nav-pill:
    backgroundColor: "{colors.paper-elevated}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sheet}"
---

# Design System: BookmarkBrain Mini App

## 1. Overview

**Creative North Star: «Тихая бумага» (The Quiet Paper Mind)**

BookmarkBrain — «второй мозг» внутри Telegram: человек кидает мысли, ссылки и голос,
AI их раскладывает по полкам. Интерфейс должен ощущаться как **тёплый бумажный блокнот, а не
SaaS-дашборд** — спокойный, негромкий, «человечный». Тема называется «Эхо» (Echo / Quiet):
тёплая кремовая бумага, мягкий сейдж-акцент, лёгкое «жидкое стекло» поверх. Настроение —
ближе к Claude-paper и бумажным заметкам, чем к ярким productivity-приложениям.

Это **product-поверхность** (UI служит задаче), а не маркетинговый лендинг. Плотность —
средняя, чат-подобная: лента, шторки, списки. Поверхность узкая (Telegram WebView,
360–420px, есть safe-area сверху/снизу), всё во весь экран, навигация — один кадр + нижние
шторки, а не многостраничный сайт.

Система **намеренно отвергает** «генерик-ИИ-вид»: фиолетовые/неоновые градиенты, карточки
внутри карточек внутри карточек, дефолтные шрифты (Inter/Roboto «по умолчанию»), холодный
сине-серый neutral и тёмную тему «как у всех». Тёплая бумага, сейдж и стекло здесь — **не
случайность и не повод для «починки», а зафиксированный бренд** (источник истины:
`src/styles/tokens.css`, `data-theme="echo"`; человеко-бриф: `docs/DESIGN-BRIEF.md`).

**Key Characteristics:**
- Тёплая кремовая бумага (`#F5F1EB`) вместо белого/серого фона.
- Единственный акцент — приглушённый сейдж `#7A9C7A` (никогда не синий).
- «Жидкое стекло»: полупрозрачные тёплые поверхности + `backdrop-filter: blur()`.
- Тройка шрифтов: Onest (UI) + Lora-курсив («человечные» акценты, AI-реплики) + JetBrains Mono (время/счётчики/капс).
- Кириллица-first: чуть более свободный трекинг на капсе.
- Тени тёплые (коричневая база `rgba(60,40,25,…)`), **никогда** нейтрально-серые.
- Тёмной темы нет. Telegram-тема не пробрасывается.

**The Locked Brand Rule.** Палитра, тема и шрифты заморожены. Расширять можно (новые
**имена** токенов в том же неймспейсе под `[data-theme="echo"]`), но **переопределять**
существующие значения или добавлять второй акцент — запрещено.

## 2. Colors

Палитра тёплая и негромкая: кремовая бумага как сцена, один сейдж-акцент как голос,
8-цветная приглушённая палитра тегов для категорий.

### Primary
- **Sage (Сейдж)** (`#7A9C7A`): единственный бренд-акцент. Кнопки-действия, активная вкладка,
  чекбоксы, выделение, FAB, фокус. Нажатие — глубже (`#547654`), мягкая подложка — `#E2EDE2`.
  Это «один голос» всего интерфейса.

### Secondary
- **AI-Sage tint (Подсветка AI)** (`#ECF2EC` фон / `#CFDFCF` граница / `#2F4A2F` текст):
  блоки AI-ответа и подсказок. Тот же сейдж-род, но тише — «машина говорит спокойно».

### Neutral
- **Paper (Бумага)** — `#F5F1EB` (страница), `#FAF7F1` (карточка), `#FFFCF6` (приподнятое/инпут),
  `#EAE3CF` (утопленное/чип). Тёплый кремовый, **не белый и не серый**.
- **Ink (Чернила)** — `#2C2825` (основной текст, тёплый off-black), `#6B645B` (вторичный),
  `#9A938A` (метаданные/плейсхолдер), `#C5BFB4` (самый тусклый). На акценте — белый `#FFFFFF`.
- **Borders (Границы)** — `#E8E1D2` (волосяная), `#D8CFBC` (край карточки), `#BDB29A` (сильная).

### Tertiary — Tags
8 приглушённых тёплых стопов для категорий: сейдж `#7A9C7A`, охра `#C18840`, сине-серый
`#4F6A7A`, слива `#8A5C8C`, глина `#B5483A`, мох `#6B7A3F`, роза `#C84B5A`, тауп `#8E908A`.
Статусы: успех `#5A8A56`, предупреждение `#C49454`, ошибка `#B5483A`, инфо `#5A7A8A`.

### Named Rules
**The One Voice Rule.** Сейдж — единственный акцент. Никаких вторых бренд-цветов, никаких
синих кнопок. Если на экране появился второй насыщенный цвет (кроме тегов) — это ошибка.

**The No-Blue Rule.** Бренд **никогда** не синеет. Telegram прокидывает свою тему (часто
синюю кнопку) — мы её **не подключаем** (моста `--tg-theme-*` нет намеренно; он повторно
ломал бренд в синий). Любой `#xxxxFF`-синий в акценте = регрессия.

**The Warm Paper Rule.** Фон — тёплая бумага `#F5F1EB`, а не `#FFFFFF` и не холодный
`#F5F5F7`. Если фон выглядит «бело-серым» — он недостаточно тёплый.

## 3. Typography

**Display Font:** Lora (serif), с фолбэком Source Serif 4 / Georgia.
**Body / UI Font:** Onest (sans), с фолбэком -apple-system / system-ui.
**Label / Mono Font:** JetBrains Mono.

**Character:** Onest держит весь UI — нейтральный, тёплый гротеск, хорошо с кириллицей.
Lora (часто **курсивом**) — «человеческий» голос: AI-саммари, подписи, числа-статы, акценты.
JetBrains Mono — техничная фактура: время, счётчики, даты, капс-метки.

### Hierarchy
- **Display** (Lora, 600, 2rem/32px, lh 1.15, tracking −0.02em): крупные заголовки экранов
  (`мысли`, `пространства`) — часто с sage-точкой, иногда курсив.
- **Headline** (Onest, 600, 1.5rem/24px, lh 1.15): h2-уровень.
- **Title** (Onest, 600, 1.125rem/18px, lh 1.3): заголовок карточки/заметки.
- **Body** (Onest, 400, 0.9375rem/15px, lh 1.5): основной текст ленты и заметок (на iOS
  допустим 16px). Базовый размер Mini App.
- **Label** (JetBrains Mono, 500, 0.75rem/12px, tracking 0.08em, часто UPPERCASE): время,
  счётчики, метки периода (`сегодня`), капс-подписи.

### Named Rules
**The Three-Family Rule.** Только Onest / Lora / JetBrains Mono. Никаких Inter, Roboto,
Poppins, system-default «лишь бы что». Новый шрифт = нарушение бренда.

**The Italic Voice Rule.** Lora-курсив зарезервирован за «человечным»/AI-голосом (саммари,
числа-статы, подписи). Не использовать его как обычный body-текст.

**The Cyrillic Tracking Rule.** Капс и мелкие mono-метки идут с трекингом 0.08em — кириллица
на капсе требует воздуха. Не «слепляй» капс-метки нулевым трекингом.

## 4. Elevation

Система **не плоская и не «тенью-в-лоб»** — это «жидкое стекло» (iOS-26 vibe): глубина
строится полупрозрачностью + размытием фона + тонкой белой внутренней гранью + мягкой
**тёплой** тенью. Тени всегда на коричневой базе `rgba(60,40,25,…)`, **никогда** нейтрально-серые.

### Surfaces & Blur
- **Стеклянные поверхности:** `rgba(255,252,246,0.55–0.92)` (кремовый тон поверх бумаги).
  Слабее для чипов/призрачных состояний, плотнее для навигации/шторок.
- **Размытие по роли:** карточка `blur(20px) saturate(150%)`, навигация `blur(28px) sat 180%`,
  шторка `blur(24px) sat 160%`, чип `blur(14px) sat 140%`.

### Shadow Vocabulary
- **glass-sm** (`0 2px 6px rgba(60,40,25,0.06)`): чипы, мини-пилюли.
- **glass-md** (`0 6px 18px rgba(60,40,25,0.05)`): карточки, тайлы, статы.
- **glass-lg** (`0 16px 40px rgba(60,40,25,0.12)`): навигация, шторки, модалки.
- **fab** (`0 4px 12px rgba(122,156,122,0.35)`): сейдж-FAB — единственная «цветная» тень.
- **Внутренняя грань** (`inset 0 1px 0 rgba(255,255,255,0.6)`) + нижняя `inset 0 -1px 0
  rgba(0,0,0,0.04)`: «толщина стекла». Без неё стекло выглядит плоской заливкой.

### Named Rules
**The Warm Shadow Rule.** Тени — коричнево-тёплые (`rgba(60,40,25,…)`), никогда `rgba(0,0,0,…)`
или серые. Серая тень мгновенно делает интерфейс «дешёвым» и чужим бренду.

**The Glass-Thickness Rule.** Каждая стеклянная поверхность несёт белую внутреннюю грань
сверху. Стекло без внутренней грани = плоский полупрозрачный прямоугольник, не стекло.

## 5. Components

### Buttons
- **Shape:** мягкий прямоугольник, радиус 12px (`glyph`) для квадратных glyph/иконочных
  кнопок; круглый FAB. Высота основной кнопки 40px, glyph 36×36.
- **Primary:** заливка sage `#7A9C7A`, текст/иконка белые, при активной → `fab`-тень.
- **Disabled:** та же заливка, `opacity: 0.4`, тень убрана, `cursor: not-allowed`.
- **Hover / Press:** переход `opacity 160ms var(--ease-out)`; нажатие уводит цвет в `#547654`.
- **Glyph-кнопки** (📎/🎤/⋯): прозрачные 36×36, `currentColor`, без заливки до нажатия.

### Chips
- **Style:** пилюля (радиус 999px), фон утопленный `#EAE3CF` или стекло-subtle, текст `ink-2`.
- **State:** фильтр-чипы (`все · ★ · задачи · голос`) — выбранный получает sage-tint подложку;
  невыбранный — тихий бумажный.

### Cards / Containers
- **Corner Style:** карточки 16px, крупные тайлы/AI-карточки 22px.
- **Background:** стеклянная `rgba(255,252,246,0.55)` поверх тёплой бумаги.
- **Shadow:** `glass-md` + внутренняя грань (см. Elevation).
- **Border:** 1px белая «мениск»-грань (`rgba(255,255,255,0.6)`), не серая обводка.
- **Padding:** 16px.

### Inputs / Fields
- **Composer (поле заметки):** контейнер радиус 22px, фон `paper-surface`, граница
  волосяная `#E8E1D2`, мягкая тень; textarea прозрачная, авто-рост до ~240px, потом скролл.
  Компакт (одна строка) — `align-items: center`; расширенное — кнопка отправки прижата вниз.
- **Search (поиск):** активная pill с sage-обводкой и лёгким свечением.
- **Focus:** сейдж-обводка/свечение, не системный синий outline.

### Navigation
- **BottomNav:** плавающая frosted-«таблетка» из 3 равных ячеек (`мысли · пространства · я`),
  иконка + всегда видимый лейбл; активная — sage-tint капсула; рядом круглый sage-FAB `+`.
  `position: fixed`, отступ + safe-area; контент скроллится под ней. Радиус 28px, `blur-nav`.
- **Telegram BackButton** закрывает по приоритету: шторка → деталь → поиск.

### Bottom Sheets (signature)
Всё модальное — нижняя шторка (frosted, радиус 28px, «ручка» сверху, `×` + закрытие тапом по
затемнению, выезд `sheetUp` 320ms). Фон под шторкой не скроллится. Это основной паттерн
оверлеев (ActionSheet, RemindersSheet, ReminderPicker, DatePicker, MoveToSpace, EntryActionSheet).

### Icons
Slim-line, один набор (lucide-react), stroke 1.5–1.8, `currentColor`, 24×24 viewbox.

### Named Rules
**The Sheet-Not-Page Rule.** Новый модальный поток = нижняя шторка, не отдельная страница и
не центрированный диалог. Многостраничность чужда этому приложению.

**The Motion Restraint Rule.** Движение сдержанное и быстрое: `--ease-out: cubic-bezier(
0.2,0.8,0.2,1)`, длительности 120/200/320ms. Смена экрана — кросс-фейд, шторка — выезд снизу,
тост — fade. Никаких хореографий, парения и scroll-driven спецэффектов. Проверять моушн **в
самом Telegram (особенно iOS WebView)**, а не только в браузере — там бывают артефакты blur.

## 6. Do's and Don'ts

### Do:
- **Do** держать фон тёплой бумагой `#F5F1EB` и единственным акцентом sage `#7A9C7A`.
- **Do** строить глубину «жидким стеклом»: полупрозрачность + `blur()` + белая внутренняя грань.
- **Do** использовать тёплые коричневые тени (`rgba(60,40,25,…)`).
- **Do** ставить Lora-курсив на «человечные»/AI-акценты, mono — на время/счётчики/капс.
- **Do** делать всё модальное нижней шторкой (радиус 28, ручка, `×`).
- **Do** проектировать под узкий Telegram-вьюпорт (360–420px) и safe-area; держать тач-зоны ≥28px.
- **Do** расширять токены **новыми именами** в неймспейсе `tokens.css` под `[data-theme="echo"]`.
- **Do** проектировать все состояния: загрузка, пусто, ошибка, длинный контент, переполнение.

### Don't:
- **Don't** вводить тёмную тему — тема залочена на светлую `echo`.
- **Don't** делать акцент синим и **don't** пробрасывать Telegram-тему (`--tg-theme-*`) — бренд синеет.
- **Don't** добавлять второй бренд-цвет помимо sage (теги — исключение, это категории).
- **Don't** использовать нейтрально-серые или чисто-чёрные `rgba(0,0,0,…)` тени.
- **Don't** ставить чистый белый `#FFFFFF` фон или холодный сине-серый neutral.
- **Don't** тащить «генерик-ИИ-вид»: фиолетовые/неоновые градиенты, неоновые акценты, карточки-в-карточках.
- **Don't** подключать новые шрифты (Inter/Roboto/Poppins/…). Только Onest / Lora / JetBrains Mono.
- **Don't** превращать модалки в отдельные страницы или центр-диалоги — только нижние шторки.
- **Don't** добавлять тяжёлый/хореографный моушн и parallax — движение сдержанное и быстрое.
