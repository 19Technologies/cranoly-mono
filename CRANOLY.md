# Cranoly Mono Style Reference
> a black and white notebook for words

**Theme:** black (Graphite) by default, and white (Paper)

**Lineage:** Cranoly Mono is a fork of Cranoly. It keeps Cranoly's shapes, ink outlines, type and motion (the micro-animations borrowed from slush.app, measured from its own CSS) and takes out the colour and the depth: black, white and greys, all flat. Two colours are left, each with one job: **yellow for links** and **mint for progress**. Its round icon buttons are flat glass.

**Decided 7 October 2026:** both themes are black and white; links are yellow; progress bars are mint, the colour Cranoly's links use; the round icons are glass (`LiquidButton`); ＋ makes a note first; Practice is a feed you swipe up and down; Format with AI uses Claude; nothing glows. Later the same day: everything is flat (no shadows, nothing lifts or sinks, cards flip flat), the ＋ symbol sits dead centre in its circle, and every page starts with its title, with no small label above it. Everything in this file is live in the app. The styles are the source of truth: `src/app/globals.css` loads the files in `src/app/styles/` in cascade order, from Cranoly's tokens (`01-base.css`) to Mono's overrides (`16-mono.css`) and flatness (`17-flat.css`); a later file wins.

Cranoly Mono feels like a printed notebook: black ink on white paper, or white on black, flat, with ink outlines and no shadows. The main thing to do and the thing you've chosen are solid ink (black on Paper, white on Graphite) with the page colour as their text. Yellow marks a link and nothing else; mint shows how far you've got. Every touch answers with a small spring: things squish when pressed, selections slide instead of jumping, and main buttons' labels slide. The app stays calm enough to write in.

## Colours

### Paper (white)

| Name | Value | Token | Role |
|------|-------|-------|------|
| Paper | `#ffffff` | `--background-primary` | App canvas, notes, phone sheets |
| Paper 2 | `#f5f5f5` (tracks `#f2f2f2`) | `--background-secondary` (`--paper-2`) | Sidebar and panels, switch and progress tracks, desktop dialogs, the phone edit toolbar |
| Card | `#ffffff` | `--card` | Buttons, cards, menus, fields, the flashcard's question side |
| Ink | `#000000` | `--text-normal`, `--edge` | Text and outlines. Also `--accent`: the toast and the selection bar |
| Brand | `#000000` (hover `#1f1f1f`), white text (`--brand-ink`) | `--brand` | **The main action and "where you are":** primary buttons, the disc under the phone bar's current tab, switches when on, ＋'s New note, the streak flame |
| Brand soft | `#ececec` | `--brand-soft` | Focus ring on fields, pressed rows in phone sheets and toolbars |
| Sun | `#000000`, white text (`--sun-ink`) | `--sun` | **What's chosen:** the flashcard's answer side, the selected note, chosen language and folder pills, chosen chips and language tiles |
| Greys | Sky `#f2f2f2` · Lilac `#e6e6e6` · Peach `#d9d9d9` | `--sky`, `--lilac`, `--peach` | Word of the day, tags. Cranoly's pastels, now greys, with black text |
| Link mark | `#ffd84d` | `--link-mark` | **Links only:** the yellow highlighter stroke under linked words. Hover: `#ffcc1a` (`--link-mark-hover`). Link text stays ink |
| Link line | `rgba(0,0,0,.45)` | `--link-underline` | Dashed underline of links to notes not written yet |
| Progress | `#c5e8b2` | `--progress` | **Progress only:** the bars in Practice, the welcome and the tour. Mint, the colour Cranoly's links use |
| Highlight | `rgba(0,0,0,.12)` | `--text-highlight-bg` | `==highlights==` and cloze words: grey, because yellow means a link |
| Selection | `rgba(0,0,0,.14)` | `--selection` | Selected text |
| Danger | `#d32f2f` | `--text-error` | Delete buttons, errors, writing issues. The only red |
| Text muted | `#4d4d4d` | `--text-muted` | Secondary text, metadata |
| Text faint | `#8c8c8c` | `--text-faint` | Placeholders, counts, hints |
| Border | `#e5e5e5` | `--background-modifier-border` | Hairlines between rows |
| Border strong | `#cfcfcf` | `--background-modifier-border-hover` | Resting outline of chips, fields, search and unchosen pills. Turns ink on hover or focus |
| Border focus | `#a3a3a3` | `--background-modifier-border-focus` | Desktop dialog outline, dashed "add" outlines |
| Wash | `rgba(0,0,0,.05)` | `--background-modifier-hover` | Hover fills, segmented-control tracks |
| Wash strong | `rgba(0,0,0,.09)` | `--background-modifier-active` | The sidebar's selected row |

### Graphite (black)

| Name | Value | Token |
|------|-------|-------|
| Paper | `#000000` | `--background-primary` |
| Paper 2 | `#0a0a0a` (tracks `#1a1a1a`) | `--background-secondary` (`--paper-2`) |
| Card | `#0f0f0f` | `--card` |
| Text | `#ffffff` · muted `#a6a6a6` · faint `#6b6b6b` | `--text-normal` · `--text-muted` · `--text-faint` |
| Edge (outlines) | `#333333` | `--edge` |
| Brand and Sun | `#ffffff` with black text | `--brand`, `--sun` (`--brand-ink`, `--sun-ink`) |
| Greys | Sky `#e6e6e6` · Lilac `#cccccc` · Peach `#b3b3b3`, with black text | `--sky`, `--lilac`, `--peach` |
| Accent (toast, selection bar) | `#ffffff` with `#000000` text | `--accent`, `--text-on-accent` |
| Brand soft | `rgba(255,255,255,.12)` | `--brand-soft` |
| Link | `#ffd84d` text over a `rgba(255,216,77,.12)` mark; hover `#ffe27a` | `--link-text`, `--link-mark` |
| Progress | `#c5e8b2` | `--progress` |
| Highlight | `rgba(255,255,255,.2)` | `--text-highlight-bg` |
| Selection | `rgba(255,255,255,.25)` | `--selection` |
| Danger | `#ff6b6b` | `--text-error` |
| Borders | `#262626` · `#333333` · `#4d4d4d` | `--background-modifier-border` · `-hover` · `-focus` |

Text on Brand and Sun is the page colour (`--brand-ink`, `--sun-ink`): white in Paper, black in Graphite. Text on the greys is always black (`--tint-ink`). Yellow, mint and red appear nowhere else.

### Mind Map and heatmap

The Mind Map is always black, in Paper too: small white and grey dots, one grey per top-level folder, on flat black. No title over it, no stars, glow, halos or twinkling. The page (and the small map in the side panel, and the tour's map) carries `data-theme="graphite"`, so its filters card, switches and labels are Graphite even when the app is Paper. Point at a dot and the lines to its linked notes turn mint.

| Use | Value | Token |
|-----|-------|-------|
| Background | `#000000`, flat | `--mm-sky` (`--mm-panel` for the small map in the side panel) |
| Notes at the top level | `#ffffff` | `--mm-0` |
| Folders, in order | `#f2f2f2` `#d9d9d9` `#bfbfbf` `#a6a6a6` `#e6e6e6` `#cccccc` `#b3b3b3` `#999999` | `--mm-1` … `--mm-8` |
| Tag | `#8c8c8c` | `--mm-tag` |
| Not written yet | `#4d4d4d` | `--mm-ghost` |
| Open or hovered note | `#ffffff` | `--mm-focus` |
| Label | `#e6e6e6` | `--mm-label` |
| Link line | `rgba(255,255,255,.14)` | `--mm-line` |
| Lines to a hovered note's linked notes | `#c5e8b2` (mint, like progress) | `--mm-hot` |

| Practice heatmap | Paper | Graphite | Token |
|-----|-------|----------|-------|
| Empty, then busier days | `#ebebeb` `#c7c7c7` `#9e9e9e` `#616161` `#000000` | `#1a1a1a` `#4d4d4d` `#808080` `#b3b3b3` `#ffffff` | `--heat-0` … `--heat-4` |

Dots are 1.6px across plus 0.7px for every square root of a note's links (the open note is 1.6 times bigger); the tap area stays 6px wider than the dot. Labels are 10.5px at 70% and appear when you zoom in or hover.

## Typography

### Fraunces · `--font-heading`
- **Used for:** headings, titles and the flashcard word
- **Axes:** `"SOFT" 100, "WONK" 0` everywhere (set on `body`), for the roundest, friendliest letters
- **Weights:** 700 (small headings), 750 (note titles, section headings), 800 (greetings, welcome titles, card titles, flashcard words)
- **Letter spacing:** -0.03em by default; -0.04em on the largest sizes; -0.02em on small ones
- **Line height:** 1 to 1.02 for titles
- **Role:** the voice of the app. Sentence case, never all caps

### Instrument Sans · `--font-text`
- **Used for:** everything that isn't a heading: UI, note text, buttons and labels
- **Size:** 14.5px for UI; 16px for note text (`--font-text-size`); 12 to 13px for small text (`--font-ui-smaller`, `--font-ui-small`)
- **Weights:** 500 (fields), 550 (sidebar rows), 600 (chips, toasts), 650 (buttons, segmented items, tab labels, the selection bar), 700 (labels, the chosen sidebar row, language pills), 750 (Flashcard and Link in the selection bar)
- **Labels:** section labels are 13px 700 uppercase with +0.06em tracking, in muted ink. The flashcard's kind label is 12px 700 uppercase with +0.08em
- **Numbers that change** (counts, streaks, timers) use tabular figures (`font-variant-numeric: tabular-nums`), so digits don't jitter

### Geist Mono · `--font-monospace`
- **Used for:** code and keyboard hints only

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Where |
|------|--------|--------|------|-------------|----------------|-------|
| note title | Fraunces | 750 | 42px | 1 | -0.03em | `.inline-title` |
| welcome title | Fraunces | 800 | 30 to 40px (`clamp(30px, 8vw, 40px)`) | 1.02 | -0.04em | `.wc-title` |
| flashcard word | Fraunces | 800 | 34 to 48px (`clamp(34px, 5vw, 48px)`) | 1 | -0.04em | short answers on the card |
| word of the day | Fraunces | 700 | 24px |  | -0.03em | the Dictionary |
| dictionary word | Fraunces | 700 | 17px |  | -0.01em | Dictionary rows; the article (der, la…) in faint 600 |
| letter | Fraunces | 800 | 20px |  | -0.02em | the Dictionary's sticky A to Z headers |
| language name | Fraunces | 700 | 19px |  | -0.02em | welcome tiles |
| practice bar | Fraunces | 750 | 18px |  | -0.02em | the deck name while practising |
| note text | Instrument Sans | 400 | 16px |  | 0 | the editor |
| ui | Instrument Sans | 500 | 14.5px |  | 0 | everywhere else |
| button | Instrument Sans | 650 | 14px (large 16px) | 1 | 0 | `.btn` |
| label | Instrument Sans | 700 | 12 to 13px | 1 | +0.06em, uppercase | inside a box only: Properties, a flashcard's type |
| small | Instrument Sans | 500 | 12 to 13px |  | 0 | metadata, hints |

## Spacing and shapes

**Spacing:** one rhythm between things: 24px between a page's sections (cards, panels, columns), 16px from a search box to its list, 8px between the items in a row (chips, pills, buttons). Inside components, padding steps through 6, 8, 10, 12, 14, 16, 18 and 22px · **Density:** comfortable in lists, roomy in the welcome

### Border Radius

| Element | Value |
|---------|-------|
| buttons, chips, switches, search, toasts, the selection bar, the phone tab bar, round icon buttons, language and folder pills | 999px (pill) |
| flashcards in practice | 28px |
| phone sheets | 30px top corners |
| the welcome flashcard | 24px |
| the word of the day card, language tiles | 18px |
| the Properties card, callouts | 16px |
| menus, the segmented track | 16px |
| rows in phone sheets | 14px |
| notes-list rows, segmented items, selects, desktop dialogs | 12px |
| sidebar rows | 10px |
| side-panel tabs | 9px |
| tags | 8px |

### Outlines

| Use | Value |
|-----|-------|
| Things you press and cards: buttons, the word of the day card, language tiles, flashcards, menus, the command palette, hover previews, toasts, the selection bar | `2px solid var(--edge)` |
| Glass icons: the phone bar's five and the round buttons at the top of the Notes screen and of a note | `1px solid var(--glass-edge)` (ink at 14%, or white at 18%) around a `--glass-fill` disc (see Round Icon Button) |
| The phone bar | `1px solid var(--background-modifier-border-hover)` over a 14px backdrop blur |
| Small controls: switch track and knob, tags, the progress bar, chosen pills and chips | `1.5px solid var(--edge)` |
| The segmented control's chosen card, the side panel's chosen tab, the chosen row in the file tree | an inset ink ring: `inset 0 0 0 1.5px var(--edge)` |
| Resting chips, search, fields and unchosen pills | `1.5px solid var(--background-modifier-border-hover)`, turning ink on hover or focus |
| Row dividers, the phone edit toolbar's top edge | `1px solid var(--background-modifier-border)` |
| Focus on fields and search | ink outline plus a `0 0 0 3px var(--brand-soft)` ring |

**Flat.** Nothing casts a shadow, lifts when you point at it, sinks when you press it, or turns in 3D. Pieces are told apart by ink outlines and fills alone. A ring (a shadow with no offset and no blur, like the focus ring) is a flat outline, so it's allowed. Cranoly's depth tokens (`--pop-sm`, `--pop`, `--pop-lg`, `--shadow-s`, `--shadow-l`) are `none` here, and `src/app/styles/17-flat.css` switches off every other shadow and 3D turn.

### Layout

- **App:** Apple Notes layout. Sidebar (236px), notes list (320px), then the note, with the text column capped at 700px, plus an optional side panel (300px). On phones (820px and narrower) it opens on the Notes screen and shows one screen at a time, with a small floating glass bar: ‹ back, Notes, ＋, Search, › forward. The Notes screen's title is small (17px Fraunces 700) and centred between ☰ on the left and ••• and ✎ on the right, all three glass icons; ☰ slides in the sidebar as a drawer.
- **Sidebar order:** Folders first (All Notes, then your folders), a hairline, then Mind Map, Practice, Dictionary, Search, Add a word and Scan text. Learn the basics and Settings sit at the foot.
- **Dictionary:** the narrow page column; sticky letter headers, hairline rows.
- **Card padding:** 14 to 22px · **Element gap:** 6 to 12px · **Phone gutter:** 16px

## Components

### Primary Button
**Role:** the main action on a screen: Start, Get started, Continue, Save, Add word, Format, Start using Cranoly Mono

Brand fill (black with white text in Paper, white with black text in Graphite), `2px` ink outline, pill. 40px tall with 20px sides (large: 52px, 16px text), Instrument Sans 650 at 14px. No shadow. Hover: `--brand-hover`, and on pointer devices the label **slides** up as a copy slides in (see Motion). Press: **squishes** to .955 where it is; it never sinks.

### Secondary Button
**Role:** everything next to the primary: Later, Cancel, Close

Card fill, `2px` ink outline, ink text, pill, no shadow. It doesn't lift on hover; press squishes.

### Ghost and Danger Buttons
Ghost: no fill or outline; hover is the 6% ink wash; when on, it gets a white fill and ink outline. Danger: `--text-error` fill (`#d32f2f`, or `#ff6b6b` in Graphite), flat. Danger outline: red text and a red outline. Red is only ever for Delete and errors.

### Round Icon Button
**Role:** compact tools: ☰, •••, ✎, the phone bar, ⚙, close, speaker

**Glass** (`GlassIcon` in `src/components/ui/glass-icon.tsx`, built on `LiquidButton` from `src/components/ui/liquid-glass-button.tsx`): the phone bar's five icons (44px; ＋ 52px) and the round buttons at the top of the Notes screen and of a note (☰, •••, ✎, 40px). Flat frosted glass: a `--glass-fill` disc (ink at 5%, or white at 8%) with a `1px` `--glass-edge` (ink at 14%, or white at 18%) over a 12px backdrop blur. No shading, rims, refraction or glow. The symbol sits in the exact centre: the button lays it out as a grid, not on a line of text, which had left ＋ 2px high. Icons are ink. Pressed, it squishes to .94; disabled, it fades to 35%. Inside the phone bar (frosted already) the icons don't blur again, and the one on the sliding disc drops its own fill and edge.

The rest keep Cranoly's: 48px beside the word of the day, 32px in panel toolbars. Stand-alone ones (the speaker) are card-coloured with a `1.5px` ink outline. Hover: ⚙ **turns 90°**.

### Chip
**Role:** quick picks and toggles: starter words in the welcome, what Format with AI should do

36px pill, white fill, `1.5px #d6cec1` outline that turns ink on hover, 600 at 14px. On: Sun fill (black, or white in Graphite) with an ink outline and the page colour as text, and the chip **pops**.

### Language and Folder Pills
**Role:** switching language on Practice and the Dictionary (`.lang-switch`), and folders on the phone notes list

32 to 34px pills, 650 to 700 at 13.5 to 14px, muted text, `1.5px #d6cec1` outline. The chosen one sits on a **Sun pill (black, or white in Graphite) with an ink outline that slides** from the previous choice.

### Tag
A grey by default (Lilac, Sky or Peach, picked by the tag's name) with black text, or Sun (black with white text, white with black in Graphite); `1.5px` ink outline, 8px radius, 700 at 0.8em. Clickable tags squish when pressed and don't lift on hover.

### Segmented Control
**Role:** one choice out of two to four: theme (Paper · Graphite · System), side-panel tabs

A track in the 6% ink wash with a 16px radius and 4px padding (side-panel tabs: 12px, 3px). Items are 650, muted, with a 12px radius. The chosen item is a **card with an inset `1.5px` ink ring that slides** to the new choice; its label turns ink as the card arrives. (Cranoly gave it a soft shadow, which in black left nothing to see.)

### Switch
**Role:** on/off settings (Shuffle decks, Blur answers, …)

Track 44×26 pill in Paper 2 with a `1.5px` ink outline. Knob 19px, white, with its own `1.5px` ink outline. On: Brand track (black, or white in Graphite) and a knob in the page colour. Motion: the knob **springs** across and **stretches** while held.

### Search and Fields
Search: 38px pill, white, `1.5px #d6cec1` outline. Selects and inputs: 40px, 12px radius, same outline. Focus: ink outline plus a 3px brand-soft (grey) ring.

### Text Link
**Role:** `[[linked words]]` in notes and links in copy

Paper: black text with a yellow highlighter stroke over its lower 42% (`linear-gradient(transparent 58%, var(--link-mark) 58%)`, `#ffd84d`). Graphite: yellow text (`#ffd84d`) over a faint yellow mark. Hover fills the whole word. A link to a note not written yet is at 60% opacity with a dashed underline. Search matches and "form of" links in the word sheet wear the same, because they take you somewhere. Yellow appears nowhere else.

### Note Row
**Role:** an item in the notes list

12px radius, 9 to 10px padding, a hairline between rows (hidden next to the selected row). Title 700, then the preview in muted ink and the date and counts in faint 12px. The selected row sits on a **Sun highlight (black with white text, or white with black in Graphite) that glides** from the previous row instead of jumping.

### Sidebar Row
34px tall, 10px radius, 550 at 14.5px with a muted icon and a faint count. Selected: 700 weight on a 10% ink wash that **glides** between rows.

### Read / Edit Button
**Role:** switching a note between reading and editing. It names where it takes you: **Edit** while reading, **Read** while editing (⌘E).

Laptop: the first thing in the note toolbar, a 32px secondary pill with an icon (pencil or open book) and the word at 13px. Phone: the ink pill at the top right of the note, text only. The new word **springs in** from below when it changes. In source mode a Sun "Source" chip sits beside it; tapping the chip returns to the live preview.

### Properties Card
**Role:** a note's properties (the `---` block at the top), drawn as a small table in reading view and live preview

White card, `1.5px` resting outline, 16px radius, 12px 16px padding. A 12px uppercase muted "Properties" label, then rows split by hairlines: the key muted in the left 30%, the value in ink. Tags are tag chips, lists are small Paper 2 chips, dates read in words, an empty value reads "Empty" in faint ink. Tapping it in the editor shows the YAML as typed, in the code font with keys in 650 ink.

### Card Arrow
The arrow on a flashcard line (→, or ⇄ both ways) is quiet: a small chip in a neutral grey (`--sep-bg` `#ececec`, Graphite `#1f1f1f`) with grey text (`--sep-ink`) and a `1.5px` hairline. In the editor it's grey text. Never Sun or Brand.

### Dictionary
- **Word of the day:** Sky (a light grey) with black text, `2px` ink outline, 18px radius, the word in Fraunces at 24px, its meaning hidden until tapped; a round speaker button beside it. No heading above it: the card's second line says "Word of the day. Tap to see the meaning."
- **Rows:** the word in Fraunces 17px (its article faint), the meaning muted below, a speaker at the end; hairline dividers; filed under sticky letter headers by the word, not its article.

### Language Tile
**Role:** picking languages in the welcome

White card, `2px` ink outline, 18px radius, flat. Language name in Fraunces 19px with "hello" in that language below it, muted. On: Sun fill (black, or white in Graphite) and a round check that **pops** in at the corner. Press squishes.

### Flashcard
**Role:** Cranoly Mono's signature object

Question side card-coloured, answer side Sun: black with white text in Paper, white with black text in Graphite. `2px` ink outline, 28px radius in practice (24px in the welcome), flat. Short answers are Fraunces 800 at 34 to 48px. Cloze gaps are dashed ink boxes on Paper 2. Each face has a round speaker at the top, and a small uppercase label for its type ("Fill the gap", "Answer"). It **flips flat** when tapped: the side you see narrows to a line, then the other side opens out on the elastic spring. Nothing turns in 3D.

### Progress Bar
10px pill in Paper 2 with a `1.5px` ink outline. The fill is **mint** (`#c5e8b2`, `--progress`) with an ink right edge, in both themes, and so are the tour's and the welcome's. The welcome uses an 8px one between **‹ Back** (from its second screen on) and Skip. Never a row of little bars.

### Backup Status
One line in Paper 2 with a `1.5px` resting outline and a 12px radius, 600 at 13px: a check and "Saved 2 min ago to Documents › Cranoly · 42 notes", or "Saving…", or the problem in the error red. When a laptop browser wants a tap before writing to the folder again, a grey tint row with an ink outline explains it, with an **Allow** button.

### Bring In Sheet
**Role:** what bringing in a backup from another device would change, before it does

"From Laptop, saved 5 Oct, 14:02. 42 notes." then one Paper 2 row per change, icon, count in 700 and plain words ("3 new notes", "1 changed on both, so both versions are kept"). Bring in changes is the primary button; Replace everything with this opens an error-red outlined box that asks first. A faint line underneath says nothing here is lost. On phones the buttons are full width.

### Selection Bar
**Role:** the bar above selected text: Flashcard · Link | Explain · Hear · …

Ink pill (white in Graphite), `2px` ink outline, flat, 4px padding. Buttons are 30px pills, 650 at 13px; hover lays an 18% wash of the bar's text colour under them (Sun would be ink on ink here). Flashcard and Link come first at 750, then a 1.5px divider. It **springs in** from the selection.

### Edit Toolbar (phones)
A full-width bar above the keyboard in Paper 2 with a hairline top edge. Tools are round, ink, and turn brand-soft (grey) when pressed. Flashcard and Link are labelled at the front.

### Menu
White, `2px` ink outline, 16px radius, 6px padding, flat. **Springs from its button** with its items arriving 12ms apart.

### Sheet
**Role:** bottom sheets on phones (Add a word, New flashcard, the note menu) and dialogs on desktop

Phones: Paper, a `2px` ink top edge, 30px top corners, an ink grab handle; rows have a 14px radius and turn brand-soft (grey) when pressed. It **rises** on the sheet curve. Desktop: a dialog in Paper 2 with a 1px outline and a 12px radius over a dimmed page, no shadow; it **springs in**.

### Toast
**Role:** confirmations with an optional Undo

Ink pill (white in Graphite), `2px` ink outline, flat, 600. The action (Undo) is a small pill outlined in the toast's own text colour; hover adds a wash of it. It **springs up** from the bottom.

### Phone Bar
**Role:** ‹ back, Notes, ＋, Search, › forward (everything else is in the ☰ drawer on the Notes screen)

A frosted pill 64px tall and only as wide as its five glass icons, 10px apart: ‹, Notes, ＋, Search and ›. The icons are 44px and ＋ is 52px. The bar is `--nav-bg` (white at 88%, or near-black at 86%) over a 14px backdrop blur, with a 1px grey outline and no shadow, centred 10px above the bottom edge. Icons only, no labels. The current tab's icon sits on a **Brand disc (black, or white in Graphite) that slides** between Notes and Search, and turns the page colour. ＋ opens **New** (see ＋ Sheet). ‹ and › fade to 35% with nowhere to go; pressed, each **nudges 3px** the way it goes.

‹ and › walk the trail of places you visited, like a browser: a place is a screen, plus the open note on a note screen and the folder on Notes. The trail lasts for the session (a reload keeps it), skips deleted notes, and going somewhere new from the middle drops what was ahead. Android's back button follows the same trail, after closing anything open; from Notes it leaves the app.

### ＋ Sheet (New)
**Role:** what ＋ opens: a new note first, then Scan, then Paste a list

Three rows 12px apart, each a card with a `1.5px` resting outline and an 18px radius: a 22px icon, then the name in 650 at 17px with a muted line under it at 13.5px. **New note** comes first and is the main one: a Brand row (black, or white in Graphite) with the page colour as text and a little more height. It makes a blank note in the folder you're in and opens it with its title ready to type. **Scan** reads a page or a word list from a photo; **Paste a list** takes words and their meanings, one per line. Rows squish to .985 when pressed. Adding a single word lives in the Dictionary (**Add a word**) and in notes (select it, then **Flashcard**).

### Practice Feed
**Role:** practising cards, one per screen

Cards sit in a vertical, scroll-snapped feed. Swipe up for the next card and down for the one before; every swipe stops at the next card (`scroll-snap-stop: always`), and a card turns back to its question when it leaves. Tap a card to flip it. The header is three balanced columns: Close, the deck name with the count, then Shuffle and Answer first (icons only on phones). The mint progress bar sits under it. Only the cards next to the one on screen are drawn. The last slide is the summary. On a laptop: the arrow keys, J and K, Page Up and Page Down, or the wheel; Space flips.

### Format with AI
**Role:** Claude formats a note, signed in as the learner. No API key: Anthropic doesn't let other apps sign people in to Claude, so the note goes to Claude itself.

A sheet in three steps. **Pick:** what to do as chips (Tidy up, Arrange by topic, Add a short summary, Link and translate words, Make flashcards), then **Open Claude** (primary), which copies the request and opens `claude.ai/new?q=` with it typed in (the Claude app on a phone). A note too long for a link (over 6,000 characters) goes by clipboard alone. **Bring the reply back:** **Paste Claude's reply** (primary) reads the clipboard; where a phone won't let apps read it, a box to paste into appears instead. Quiet links: Back, Open Claude again, Copy the request. **Formatted:** the reply in a card-coloured preview (16px radius, `1.5px` resting outline), then **Add below** and **Replace note** (primary); a toast offers Undo. It looks like the rest of the app: no gradients, shimmer or glow.

### Page Title
A page starts with its title: no small label above it (Cranoly's "Your words", "Flashcards", "Settings" and "Help", and the tour's step labels, are gone). Small uppercase labels live only inside a box, where they say what's in it: Properties, a flashcard's type.

## Motion

Slush's secret is that motion **lands fast and settles playfully**. Its main curve reaches its target in about a sixth of its duration, overshoots by 14%, then rocks back into place. Cranoly uses Slush's exact curves for small things, and a gentler glide for anything that travels a long way.

### Principles

1. **Arrive fast, settle slow.** The value reaches its target in under 150ms; the remaining time is the springy settle. Interactions never feel slow, even at 850ms.
2. **Nothing snaps.** Every state change animates: toggles, selections, sheets, menus. The exceptions are typing and the caret.
3. **Selections travel.** When the chosen item changes, one indicator moves from the old item to the new one. It never fades out and in.
4. **Small things bounce, big things glide.** Overshoot shrinks with distance, so long moves use the gentler glide curve.
5. **Everything pressable squishes.** `scale: .955` on press, sprung back on release. Wide rows (notes, sidebar, sheet rows) press to `.985`, so a whole row never lurches. The squish is the whole press: nothing drops, sinks or lifts.
6. **Transform, opacity and colour only.** Never animate layout on content, so it stays at 60fps on a budget phone like a Galaxy A23.
7. **Interruptible.** Use transitions, not one-shot animations, wherever a user can change their mind mid-motion.

### Curves

| Name | Value | Token | Use |
|------|-------|-------|-----|
| Elastic | `linear(0, 0.5737 7.6%, 0.8382 11.87%, 0.9463 14.19%, 1.0292 16.54%, 1.0886 18.97%, 1.1258 21.53%, 1.137 22.97%, 1.1424 24.48%, 1.1423 26.1%, 1.1366 27.86%, 1.1165 31.01%, 1.0507 38.62%, 1.0219 42.57%, 0.9995 46.99%, 0.9872 51.63%, 0.9842 58.77%, 1.0011 81.26%, 1)` | `--ease-elastic` | Slush's spring, with 14% overshoot. Presses, knobs, rotations, sliding labels, a flashcard's side opening out, menus, toasts: anything that moves under ~40px |
| Glide | `linear(0, 0.3336 3%, 0.6 6%, 0.7936 9%, 0.922 12%, 0.9987 15%, 1.0449 19%, 1.0522 24%, 1.0342 30%, 1.0128 37%, 1.0011 45%, 0.9985 55%, 0.9996 68%, 1)` | `--ease-glide` | Cranoly's damped spring: 5% overshoot, on target at 15%. Sliding pills and list highlights |
| Bounce | `linear(0, 1.3, 1, 0.92, 1, 0.99, 1, 1.004, 0.998, 1)` | `--ease-bounce` | Slush's pop, with 30% overshoot. Only for tiny appearances: checks, chips, tab icons |
| Snap | `cubic-bezier(0.65, 0.05, 0, 1)` | `--ease-snap` | Slush's wipe: slow start, fast finish. Long jumps of a sliding pill |
| Out | `cubic-bezier(0.22, 1, 0.36, 1)` | `--ease-out` | Plain arrivals with no overshoot: menu items, pill edges landing at the side of their container. Also `--ease` |
| Color | `cubic-bezier(0.216, 0.62, 0.356, 1)` | `--ease-color` | Slush's colour ease: backgrounds, text and outline colours |
| Sheet | `cubic-bezier(0.32, 0.72, 0, 1)` | `--ease-sheet` | Bottom sheets on phones |

Browsers without `linear()` (before Chrome 113 or Safari 17.2) get the nearest `cubic-bezier` for Elastic, Glide and Bounce.

### Durations

| Name | Value | Token | Use |
|------|-------|-------|-----|
| Fade | 150ms | `--dur-fade` | Opacity, label colour swaps, backdrops |
| Color | 200ms | `--dur-color` | Background, text and outline colour changes |
| Pop | 420ms | `--dur-pop` | Checks, chips and icon pops (Bounce) |
| Glide | 460ms | `--dur-glide` | Sliding pills and highlights (Glide) |
| Press | 500ms | `--dur-press` | The spring back from a press; switch knobs; menus, toasts and dialogs arriving (Elastic) |
| Sheet | 520ms | `--dur-sheet` | Bottom sheets |
| Default | 750ms | `--dur-default` | The theme icon (Elastic) |
| Medium | 850ms | `--dur-medium` | A main button's sliding label |
| Long | 1000ms | `--dur-long` | The logo spin only |

### Component motion

| Moment | What moves | Duration · curve | Detail |
|--------|-----------|------------------|--------|
| **Press** anything pressable | `scale: .955` (wide rows `.985`) | press · elastic | Down and back on the same spring. Uses the independent `scale` property, so it never fights a transform |
| **Switch** toggled | knob `translate: 18px 0` | press · elastic | The knob overshoots ~2.5px and rocks back. The track turns Brand over color · color |
| **Switch** held | knob `scale: 1.3 1` | press · elastic | The knob stretches towards its travel (origin left when off, right when on), like iOS |
| **Segmented control or side-panel tabs** changed | the white chosen card's edges | glide · glide | The leading edge leaves first and the trailing edge follows 18ms later, so the card **stretches** by about 40% of the distance, then settles. An edge landing at the container's side uses Out, so it never pokes past. Moves over 240px use Snap at 420ms with no stretch |
| Label under a moving pill | text colour | fade · color, 60ms delay | Swaps as the pill arrives under it |
| **Notes list** selection changed | the Sun highlight's top and bottom edges | glide · glide | The same stretch; long jumps snap. When an edit moves the open note up the list, the highlight travels with it |
| **Sidebar** selection changed | the grey highlight | glide · glide | The same stretch |
| **Language pills, phone folder pills** changed | the Sun pill | glide · glide | The same stretch |
| **Read / Edit** button | the new word rises 55% and fades in | pop · elastic | The same spring in the tour's demo |
| **Tab bar** changed | the Brand disc slides under the new icon | glide · glide | A light haptic tap in the Android app |
| **Practice feed** swiped | the next card scrolls into place and snaps | the phone's own scroll | One card per swipe; the card that left turns back to its question |
| **Chip** turned on | Sun fill; the chip pops from `scale: .92` | color · color; pop · bounce |  |
| **Language tile** picked | Sun fill; the corner check pops in from `scale: 0` and `rotate: -25deg` | color · color; pop · bounce |  |
| **Primary button** hover (pointer devices) | label slides: the label moves up to `translate: 0 -0.95em` and fades; a copy (CSS text only) slides up from `translate: 0 0.95em` into place | medium · elastic; fade 150ms out, 75ms in | Slush's button made flat (Cranoly rolls the label over in 3D), inside a clipped pill. On Start, Add a word, Get started, Continue, Download, Add word, Save, Format, New note and Start using Cranoly Mono |
| **Round button** hover | ⚙ and a desktop ＋ `rotate: 90deg` | press · elastic | Glass icons squish to .94 instead |
| Logo hover | `rotate: 360deg` | long · elastic |  |
| Arrow in a button or row, hover | `translate: 3px 0` | press · elastic |  |
| **Theme** switched | the theme icon spins in from `rotate: -120deg`, `scale: .6` | default · elastic | Colours change over color · color |
| **Selection bar** appears | `scale: .92 → 1` from its bottom centre, fading in | press · elastic |  |
| **Dialog** opens (desktop) | `scale: .96 → 1`, fading in | press · elastic | The backdrop fades over 150ms |
| **Sheet** opens (phones) | rises from below the screen | sheet · sheet |  |
| **Menu** opens | `scale: .94 → 1` from its top-left corner, fading in | press · elastic | Items rise 4px over 320ms on Out, 12ms apart; the tenth item onwards arrives together |
| **Toast** arrives | rises 14px from `scale: .96`, fading in | press · elastic |  |
| **Flashcard** flips | the side you see narrows to `scale: 0 1`, then the other side opens to `scale: 1 1` | 140ms ease-in, then 200ms elastic | In practice and in the welcome; the tour's demo card loops the same turn. Flat: no perspective and no rotation |

### Choreography rules

- **Leaving is faster than arriving:** about 0.6× the duration, with no overshoot.
- **One overshoot per gesture.** If a pill glides, its label doesn't also bounce.
- **Stagger lists by 12ms per item, at most 10 items**, then the rest arrive together.
- **Don't animate while typing.** The editor, caret and text never move; motion lives around the text. Opening a note is instant, because writing can't wait.

### Reduced motion

With `prefers-reduced-motion: reduce`, every animation and transition drops to 0.01ms and every delay to 0. Pills and highlights jump into place, and main buttons' labels stay still.

### Haptics (Android app)

| Moment | Haptic |
|--------|--------|
| Switch toggled; theme, language, tab or folder changed; flashcard flipped; a language picked in the welcome | light tap |
| A card saved (Add word, the word sheet, new words, scan), a deck finished, the first word added in the welcome | success |

### Recipes

```css
/* Press: everything pressable squishes and springs back (the full list is in src/app/styles/14-motion.css). */
:is(.btn, .chip, .icon-btn, .tool, .seg button, .dict-row, .wc-lang) {
  transition:
    scale var(--dur-press) var(--ease-elastic),
    transform 0.12s var(--ease),
    box-shadow 0.12s var(--ease),
    background-color var(--dur-color) var(--ease-color),
    color var(--dur-color) var(--ease-color),
    border-color var(--dur-color) var(--ease-color);
}
:is(.btn, .chip, .icon-btn, .tool, .seg button, .dict-row, .wc-lang):active:not(:disabled) { scale: 0.955; }
:is(.sb-item, .nl-row, .sheet-item, .deck-row):active:not(:disabled) { scale: 0.985; }

/* Switch: the knob springs across and stretches while held. */
.switch-track::after {
  transform-origin: left center;
  transition: translate var(--dur-press) var(--ease-elastic), scale var(--dur-press) var(--ease-elastic),
              background-color var(--dur-color) var(--ease-color);
}
.switch input:checked + .switch-track::after { translate: 18px 0; transform-origin: right center; }
.switch:active .switch-track::after { scale: 1.3 1; }

/* Sliding selection: one pill rides CSS variables set by useSlider() (src/lib/useSlider.ts).
   --sl/--sr/--st/--sb place its edges, --sd-* delay the trailing edges, --se-* pick each edge's curve. */
:where(.has-slider) { position: relative; }
:where(.has-slider) > :where(:not(.slider-pill)) { position: relative; z-index: 1; }
.slider-pill {
  position: absolute; z-index: 0; pointer-events: none;
  top: var(--st, 0); right: var(--sr, 0); bottom: var(--sb, 0); left: var(--sl, 0);
  transition: left var(--s-dur, var(--dur-glide)) var(--se-l, var(--ease-glide)) var(--sd-l, 0ms),
              right var(--s-dur, var(--dur-glide)) var(--se-r, var(--ease-glide)) var(--sd-r, 0ms),
              top var(--s-dur, var(--dur-glide)) var(--se-t, var(--ease-glide)) var(--sd-t, 0ms),
              bottom var(--s-dur, var(--dur-glide)) var(--se-b, var(--ease-glide)) var(--sd-b, 0ms);
}
/* Each container's pill wears what the chosen item used to wear, and the item goes transparent. */
.nl-scroll.has-slider > .slider-pill { background: var(--sun); border-radius: 12px; }
.nl-scroll.has-slider .nl-row.is-active { background: transparent; }

/* Pops: a check or a chip appearing. */
@keyframes pop-in { from { scale: 0; rotate: -25deg; } }
@keyframes chip-on { from { scale: 0.92; } }
.wc-lang-check { animation: pop-in var(--dur-pop) var(--ease-bounce); }
.chip.on { animation: chip-on var(--dur-pop) var(--ease-bounce); }
```

In React, put a pill first inside the container and hand the hook a selector for the chosen item and a key that changes with the choice:

```tsx
const seg = useSlider<HTMLDivElement>(".is-on", settings.theme);

<div ref={seg} className="seg has-slider" role="radiogroup" aria-label="Theme">
  <span className="slider-pill" aria-hidden />
  {options.map((o) => (
    <button key={o.id} role="radio" aria-checked={settings.theme === o.id} className={settings.theme === o.id ? "is-on" : ""}>
      {o.label}
    </button>
  ))}
</div>
```

Main buttons get the sliding label with `<Tumble label="Start">…</Tumble>` (src/components/Tumble.tsx keeps Cranoly's name). The text exists once, so screen readers read it once.

## Do's and Don'ts

### Do
- Keep it **black and white**: ink, the page colour and greys.
- Use **Brand** (solid ink) for the main action and for "where you are": the current tab's disc, switches that are on, ＋'s New note.
- Use **Sun** (also solid ink here) for what's chosen or being learned: the answer side, the selected note, chosen pills and chips.
- Keep **yellow for links only**, **mint for progress only** and **red for Delete and errors only**.
- Keep everything **flat**: outlines and fills only.
- Make round icon buttons flat glass (`GlassIcon`), with the symbol in the exact centre. Outline everything else you press in `2px` ink; small controls get `1.5px`.
- Start every page with its title.
- Space evenly: 24px between sections, 16px from a search box to its list, 8px between items in a row.
- Make every control a pill.
- Animate every state change with the Motion tokens. Selections slide, presses squish, checks pop.
- Use tabular figures for every number that changes.
- Use the learner's own language for any example word in the app.

### Don't
- Don't switch to Slush's look: no hairline-only outlines, no new palette or type scale. Borrow its motion only.
- Don't add depth: no shadows (hard or soft), no lifting on hover or sinking on press, no 3D turns or perspective, no shading on glass. A ring with no offset or blur is a flat outline and is fine.
- Don't put a small label above a page title.
- Don't use gradients as colour. The one exception: the link highlighter (its hard stop reads as a flat stroke).
- Don't make anything glow: no glowing or pulsing dots, halos, coloured shadows, shimmer or sparkle effects, AI features included.
- Don't add colour: tags, folders, callouts, the heatmap and the Mind Map are greys.
- Don't draw a little bar, dash or dot in front of a label, and don't write em or en dashes in anything the app says. Short sentences, colons and commas instead.
- Don't put anything but the page colour on Brand and Sun (`--brand-ink`, `--sun-ink`), or anything but black on the greys, in either theme. Don't put Sun on an ink surface (the toast, the selection bar): it's ink on ink.
- Don't fade between selected items. The indicator must travel. In React, use `useSlider` and a `.slider-pill` in the container instead of styling the chosen item's own background.
- Don't use Elastic for moves over ~40px (use Glide), or Bounce for anything bigger than an icon or chip.
- Don't animate `width`, `height`, `top` or `left` on content. The slider pill (a tiny absolute element) is the only exception.
- Don't let motion run longer than 1s, block input, or move anything while someone types.
- Don't put fixed German (or any single language) example content on screens all learners see.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Paper | `#ffffff` (Graphite `#000000`) | App canvas, notes, phone sheets |
| 2 | Paper 2 | `#f5f5f5` (Graphite `#0a0a0a`) | Sidebar, panels, tracks, desktop dialogs |
| 3 | Card | `#ffffff` (Graphite `#0f0f0f`) | Buttons, cards, menus, fields, the flashcard's question side |
| 4 | Greys and Sun | Sky / Lilac / Peach greys; Sun in solid ink | Chosen things, word of the day, tags, the flashcard's answer side |
| 5 | Ink | `#000000` (Graphite `#ffffff`) | Toasts and the selection bar: the inverted layer |
| 6 | Glass | `LiquidButton`, flat: a 5% fill and a thin edge | The phone bar's icons and the round header buttons |

## Imagery

No photography and no 3D renders. Cranoly Mono's signature object is the **flashcard**: a flat card with an ink outline that flips to solid ink. Icons are Lucide line icons in ink or muted ink. The app icon is a white serif "C" on black.

## Agent Prompt Guide

Quick Color Reference:
- text: #000000 (Graphite: #ffffff)
- background: #ffffff / #f5f5f5 / #ffffff (Graphite: #000000 / #0a0a0a / #0f0f0f)
- outline: #000000 (Graphite edge #333333), 2px on pressables and cards, 1.5px on small controls; no shadows, everything flat
- action and chosen: #000000 with #ffffff text (Graphite: #ffffff with #000000 text)
- greys for tags and the word of the day: #f2f2f2, #e6e6e6, #d9d9d9 with black text
- links: #ffd84d highlighter under black text (Graphite: #ffd84d text)
- progress: #c5e8b2
- round icon buttons: flat glass, rgba(0,0,0,.05) fill and a 1px rgba(0,0,0,.14) edge (Graphite: white at 8% and 18%)

Example Component Prompts:

1. **Primary button:** "A flat 40px pill, #000000 fill, 2px #000000 outline, no shadow, label 'Start' in Instrument Sans 650 14px in #ffffff. Hover: #1f1f1f, and the label slides up and fades while a copy slides up from below into place, on `--ease-elastic` over 850ms. Press: squish to .955. Nothing lifts or sinks."

2. **Segmented control:** "Theme picker with Paper · Graphite · System. A track in rgba(0,0,0,.05) with a 16px radius and 4px padding. Items are Instrument Sans 650 in #4d4d4d with a 12px radius. The chosen one sits on a white card with an inset 1.5px #000000 ring and no shadow, and the card slides to a new choice with `--ease-glide` over 460ms: its leading edge moves first and the trailing edge follows 18ms later."

3. **Notes list:** "Rows with a 12px radius on #ffffff, separated by 1px #e5e5e5 hairlines: title in Instrument Sans 700, a muted date and preview line. The selected row sits on a #000000 highlight with white text that glides from the previously selected row with `--ease-glide`. Pressing a row squishes it to .985."

4. **Flashcard:** "A flat 28px-radius white card with a 2px #000000 outline and no shadow. The word is Fraunces 800 at 44px, line height 1, -0.04em, centred. Tapping flips it flat: the card narrows to a line in 140ms, then the #000000 answer side with white text opens out on `--ease-elastic`. No 3D turn."

5. **Mind Map:** "A full-bleed flat black (#000000), in both themes. Notes are flat dots about 2 to 4px across in white and greys (one grey per folder: #f2f2f2, #d9d9d9, #bfbfbf, #a6a6a6), joined by 0.7px lines in rgba(255,255,255,.14); pointing at a dot turns the lines to its linked notes mint (#c5e8b2). No title, stars or glow; the filters card floats top right in Graphite colours."

6. **Glass icon:** "A 44px flat round button: a rgba(0,0,0,.05) fill (white at 8% on black) and a 1px rgba(0,0,0,.14) edge over a 12px backdrop blur, with no shading. A 20px Lucide icon in ink in the exact centre. Pressed, it squishes to .94 on `--ease-elastic`. Nothing glows around it."

## Gradient System

None, except the link highlighter: a hard-stop gradient that draws a flat yellow stroke under linked words. The Mind Map's sky is flat black. Every other surface is a flat fill. There is no depth: shapes come from ink outlines and fills, and life from motion.

## Quick Start

### CSS Custom Properties

The key tokens, for pages built outside the app. The app's full set is in `src/app/styles/`: Cranoly's in `01-base.css`, and Mono's overrides in `16-mono.css`.

```css
:root {
  /* Colors: Paper */
  --background-primary: #ffffff;
  --background-secondary: #f5f5f5;
  --paper-2: #f2f2f2;
  --card: #ffffff;
  --text-normal: #000000;
  --text-muted: #4d4d4d;
  --text-faint: #8c8c8c;
  --text-error: #d32f2f;
  --edge: #000000;
  --tint-ink: #000000;
  --brand: #000000;
  --brand-hover: #1f1f1f;
  --brand-ink: #ffffff;
  --brand-soft: #ececec;
  --sun: #000000;
  --sun-ink: #ffffff;
  --sky: #f2f2f2;
  --lilac: #e6e6e6;
  --peach: #d9d9d9;
  --link-mark: #ffd84d;
  --link-mark-hover: #ffcc1a;
  --progress: #c5e8b2;
  --text-highlight-bg: rgba(0, 0, 0, 0.12);
  --selection: rgba(0, 0, 0, 0.14);
  --background-modifier-border: #e5e5e5;
  --background-modifier-border-hover: #cfcfcf;
  --background-modifier-hover: rgba(0, 0, 0, 0.05);
  --background-modifier-active: rgba(0, 0, 0, 0.09);

  /* Flat: Cranoly's depth tokens are switched off */
  --pop-sm: none;
  --pop: none;
  --pop-lg: none;
  --shadow-s: none;
  --shadow-l: none;

  /* Glass, flat */
  --glass-fill: rgba(0, 0, 0, 0.05);
  --glass-edge: rgba(0, 0, 0, 0.14);

  /* Type */
  --font-heading: "Fraunces", ui-serif, Georgia, serif;
  --font-text: "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-monospace: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-text-size: 16px;

  /* Motion: curves */
  --ease-elastic: linear(0, 0.5737 7.6%, 0.8382 11.87%, 0.9463 14.19%, 1.0292 16.54%, 1.0886 18.97%, 1.1258 21.53%, 1.137 22.97%, 1.1424 24.48%, 1.1423 26.1%, 1.1366 27.86%, 1.1165 31.01%, 1.0507 38.62%, 1.0219 42.57%, 0.9995 46.99%, 0.9872 51.63%, 0.9842 58.77%, 1.0011 81.26%, 1);
  --ease-glide: linear(0, 0.3336 3%, 0.6 6%, 0.7936 9%, 0.922 12%, 0.9987 15%, 1.0449 19%, 1.0522 24%, 1.0342 30%, 1.0128 37%, 1.0011 45%, 0.9985 55%, 0.9996 68%, 1);
  --ease-bounce: linear(0, 1.3, 1, 0.92, 1, 0.99, 1, 1.004, 0.998, 1);
  --ease-snap: cubic-bezier(0.65, 0.05, 0, 1);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-color: cubic-bezier(0.216, 0.62, 0.356, 1);
  --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);

  /* Motion: durations */
  --dur-fade: 150ms;
  --dur-color: 200ms;
  --dur-pop: 420ms;
  --dur-glide: 460ms;
  --dur-press: 500ms;
  --dur-sheet: 520ms;
  --dur-default: 750ms;
  --dur-medium: 850ms;
  --dur-long: 1000ms;
}

:root[data-theme="graphite"] {
  --background-primary: #000000;
  --background-secondary: #0a0a0a;
  --paper-2: #1a1a1a;
  --card: #0f0f0f;
  --text-normal: #ffffff;
  --text-muted: #a6a6a6;
  --text-faint: #6b6b6b;
  --text-error: #ff6b6b;
  --edge: #333333;
  --glass-fill: rgba(255, 255, 255, 0.08);
  --glass-edge: rgba(255, 255, 255, 0.18);
  --brand: #ffffff;
  --brand-hover: #e6e6e6;
  --brand-ink: #000000;
  --brand-soft: rgba(255, 255, 255, 0.12);
  --sun: #ffffff;
  --sun-ink: #000000;
  --sky: #e6e6e6;
  --lilac: #cccccc;
  --peach: #b3b3b3;
  --link-text: #ffd84d;
  --link-mark: rgba(255, 216, 77, 0.12);
  --link-mark-hover: rgba(255, 216, 77, 0.24);
  --text-highlight-bg: rgba(255, 255, 255, 0.2);
  --selection: rgba(255, 255, 255, 0.25);
  --background-modifier-border: #262626;
  --background-modifier-border-hover: #333333;
  --background-modifier-hover: rgba(255, 255, 255, 0.07);
  --background-modifier-active: rgba(255, 255, 255, 0.12);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    animation-delay: 0s !important;
    transition-delay: 0s !important;
  }
}
```

Fraunces runs with `font-variation-settings: "SOFT" 100, "WONK" 0` on `body`.

## Similar Brands

- **Cranoly:** the app Mono is forked from: the same notebook in colour (orange actions, Sun yellow, pastel tags and mint links).
- **shadcn's liquid glass button:** the glass icons (`LiquidButton`), made flat.
- **Tutora:** Cranoly's original brand, and the source of its look: warm paper, ink outlines, hard pop shadows (which Mono drops), orange, and pastel chips.
- **Slush (slush.app):** the source of the motion only: the spring curves, sliding selections, the press squish and the sliding labels.
- **Apple Notes:** the app layout: folders, a date-grouped list and a calm editor.
