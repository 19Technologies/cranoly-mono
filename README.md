# Cranoly Mono

A black and white fork of Cranoly, the notebook for learning languages. You write flashcards directly inside your notes, link notes together, and hear every word spoken. It runs in the browser on desktop, installs on phones as an app that works offline, and ships as an Android app.

## What Mono changes

- **Black and white.** Both themes are black and white only: black (the default) and white (Paper). The Mind Map's dots are greys, callouts are grey, and the heatmap is shades of grey. Red is kept for errors and Delete.
- **Yellow links.** Links between notes are yellow: yellow text in the black theme, black text on a yellow highlight in the white theme.
- **Mint progress.** Progress bars (Practice, the welcome and the tour) are mint, `#C5E8B2`, the colour of linked notes: point at a Mind Map dot and the lines to its linked notes turn mint.
- **Glass icons.** The phone bar and the round buttons at the top of the Notes screen and of a note are glass buttons (`LiquidButton` in `src/components/ui/liquid-glass-button.tsx`), made flat: a see-through fill and a thin edge, with the symbol in the exact centre. Nothing glows: no coloured shadows, halos or sparkle icons.
- **Flat.** No shadows anywhere, nothing lifts when you point at it or sinks when you press it (it still squishes), and cards flip flat instead of turning in 3D.
- **Titles first.** Every page starts with its title, with no small label above it.
- **＋ makes a note.** ＋ opens **New**: **New note** first (the main one, a blank page in the folder you're in), then **Scan**, then **Paste a list**. A single word is added from the Dictionary (**Add a word**) or in a note (select it, then **Flashcard**).
- **Practice is a feed.** Cards scroll up and down, one per screen: swipe up for the next card, down for the one before, tap to flip. On a laptop use the arrow keys, J and K, Page Up and Page Down, or the mouse wheel.
- **AI with your Claude login.** **Format with AI** (in a note's ••• menu) opens Claude signed in as you (the Claude app on a phone, claude.ai on a computer) with your note and the request typed in. Copy Claude's reply, tap **Paste Claude's reply**, and choose **Add below** or **Replace note**; Undo puts the note back. There's no API key to add and nothing to pay Mono: it uses your own Claude account. (Anthropic doesn't allow other apps to sign people in to Claude, so the note goes to Claude itself, and only when you tap Open Claude.)
- **Even spacing.** One rhythm throughout: 24px between sections and 8px between chips and buttons.
- **Its own app.** Cranoly Mono (app id `com.cranoly.mono`) installs next to Cranoly, and keeps its own **Cranoly Mono** folder, so the two never mix. **Bring in changes** reads Cranoly's backup files too, so your notes can move across.

## Features

- **Laid out like Apple Notes**: folders on the left (All Notes first, then the Mind Map, Practice and the Dictionary), then your notes (pinned first, then Today, Yesterday, Previous 7 Days and so on), then the note itself. On phones: the app opens on the Notes screen, with folder chips, a ☰ menu holding the same list as the sidebar, and a small glass bar at the bottom: ‹ back, Notes, ＋, Search, › forward. ‹ and › walk back and forth through the screens, notes and folders you visited, like a browser.
- **Select a word, then Flashcard or Link**: no syntax to learn. **Flashcard** fills in the meaning (and the article) for you and saves the card to the note; **Link** turns the word into a link to the note of that name. On phones both sit at the front of the editing toolbar and work on the word next to the cursor too.
- **Wikilinks**: `[[Note]]`, `[[Note|alias]]` and `[[Note#Heading]]` render inline. Hover over a link to preview the note. Clicking a link to a note that doesn't exist yet creates it.
- **Backlinks, outgoing links, outline and a local graph** in a side panel you can open from the note's toolbar.
- **Mind Map**: every note as a small dot on a plain dark background (dark in both themes), coloured by its folder and sized by how many links it has. Tags and unwritten links can be shown as their own dots. Hovering a dot highlights its neighbours, and clicking it opens the note.
- **Dictionary**: every word you've saved, A to Z, with its meaning, a speaker button and a word of the day. Words appear as soon as they're saved anywhere (Add a word, word lists, Scan, Format), because the dictionary reads the `word :: meaning` lines in your notes. Articles stay with the word but don't decide where it's filed ("der Bahnhof" sits under B).
- **Editor** built on CodeMirror 6 with Live Preview: `[[links]]`, bold, headings and tasks render in place and show their syntax only while the cursor is on them. `[[` autocomplete, list continuation, Tab to indent, undo/redo. The button at the top of a note names where it takes you: **Edit** while you read, **Read** while you edit (⌘E). **Source mode** (in the ••• menu) shows every symbol as typed, and there's a split view.
- **Properties**: a block of `key: value` lines between two `---` lines at the top of a note shows as a small table, with tags as tag chips (they count like `#tags`) and dates in words. **Add properties** in the ••• menu starts one.
- **Folders and notes**: pin notes, move them between folders (drag onto a folder, or use the note's menu), rename them. Renaming a note updates every link that points to it. Deleting a note opens the next one in the list, and can be undone.
- **Command palette** (`⌘K`), **quick switcher** (`⌘O`), full-text and `#tag` search (`⌘⇧F`), daily notes.
- **Flashcards**: notes are turned into decks automatically. Practice scrolls through them like a feed, one card per screen: tap to flip, swipe up for the next. A heatmap and a streak track your study days.
- **More than one language**: pick them all during the welcome. Each one gets its own words note, and Practice and the Dictionary have a switch between them.
- **Voices**: natural text-to-speech with [Piper](https://github.com/rhasspy/piper), running on the device. The welcome offers to download a voice for each language you learn (about 63 MB each, plus a 29 MB engine the first time); Settings → Voices adds or removes them later. Voices are kept in the app's own storage and work offline. Japanese and Korean use the device's voice.
- **Quick to speak**: the voice runs in the background and starts loading when a screen with speaker buttons opens. Every clip is kept on the device, and the words on screen (and the next flashcards) are prepared ahead, so tapping a word plays it at once. While the natural voice is still starting, the phone's own voice says the word straight away.
- **Scan text**: take a photo of a page, a sign or a word list and Cranoly reads it with [Tesseract](https://github.com/naptha/tesseract.js), on the device. Word lists become cards in one tap; other text becomes a note, or goes to Find new words. The scanner (about 5 MB) and its small language files are downloaded the first time.
- **Smart tools** for the language you're learning (set it in Settings → Languages):
  - **Explain**: select a word to see its meanings, examples and gender from Wiktionary, and save it as a card in one tap.
  - **Hear it**: pronunciation with the downloaded voice, or the device's own voice, in the editor and on flashcards.
  - **Check my writing**: LanguageTool underlines spelling and grammar mistakes; tap one to fix it, or fix it and save it as a card.
  - **Cards from anything**: pasted word lists ("Hund = dog") turn into cards, and **Find new words** lists every word in a text you don't have a card for yet.
  - **Format with AI**: Claude tidies a note, arranges it, summarises it, translates it or makes cards from it, signed in as you (see What Mono changes).
  - **Ask your notes**: type a question in search and get the best-matching passages back.
  - **Unlinked mentions** in the backlinks panel, and **smart decks** ("Not seen lately", "From this week's notes").
  - Explain, Check, Format with AI, and looking up the meaning of a word you're adding are the only features that send text anywhere, and only that word, the text you chose or the note you're formatting. They can be turned off. Voices and Scan text download their files once and then run entirely on the device.
- **The Cranoly Mono folder (backup)**: Cranoly Mono keeps a copy of everything in a folder as you go. Each note is its own Markdown file, in the same folders as in the app, next to one backup file (with your study history) and a copy from each of the last 7 days. On the Android app it's **Documents › Cranoly Mono**, saved automatically. On a laptop in Chrome or Edge you choose the folder once (put it in Google Drive, Dropbox or iCloud Drive to have it online too). Other browsers download it as **Cranoly Mono.zip**.
- **Sync, through the folder**: no account and no server. Share a copy from one device (the phone's share sheet: Google Drive, Quick Share, email) and tap **Bring in changes** on the other. It shows what would change first; new notes are added, edits come across, notes deleted on one device go on the other, and a note changed on both is kept twice, so nothing is lost. Undo puts everything back. A laptop whose folder is in Google Drive brings in a backup your phone shares into it by itself.
- Everything lives on your device (`localStorage`), plus the Cranoly Mono folder. **Black (Graphite) is the default**; Paper (white) and System are in Settings.

## On your phone

- The first launch explains Cranoly in three lines, asks which languages you learn, offers their voices, walks you through your first word and card, and shows how to make cards and links in notes. **‹ Back** returns to the screen before, and Android's back button does the same. Already use Cranoly Mono or Cranoly? **Bring in your notes** from a backup on the first screen.
- **＋** makes a new note in the folder you're in. Under it: **Scan** (a page or a word list from a photo) and **Paste a list** (words and their meanings, one per line).
- The Notes screen works like Apple Notes. Tap a note to open it and **‹ Notes** to go back. Long-press a note to pin, move, rename or delete it, and long-press a folder chip to rename or delete the folder.
- While you're editing, a toolbar sits above the keyboard: **Flashcard** and **Link** first, then undo/redo, Explain, Hear, Check, and `::`, `#tag`, checklist, heading, bold, italic, `==cloze==` and indent buttons.
- In a note, swipe left for links, cards and outline, or pull down at the top to open the command palette.

**Installing it:** open the site on your phone. In Safari tap **Share → Add to Home Screen**. In Chrome use **Install app** (also under Settings → Install the app). Once installed it opens full-screen, and after the first visit it works offline.

## Android app

The Android app is the same code, packaged with [Capacitor](https://capacitorjs.com). Inside the app the Android back button closes sheets and goes back, the status bar follows the theme, and flipping or saving a card gives a small vibration.

```bash
npm run apk   # static export → android/app/build/outputs/apk/debug/app-debug.apk (Cranoly Mono, com.cranoly.mono)
```

You need the Android SDK and JDK 21. On a machine with only JDK 17, add `java.release=17` to `android/local.properties` (it isn't committed): Capacitor's code builds fine as Java 17.

## Writing flashcards

| Syntax | Result |
| --- | --- |
| `Hallo :: Hello` | One card |
| `der Hund ::: the dog` | Two cards, one in each direction |
| `Ich ==bin== müde.` | Cloze card (the highlighted part is hidden) |
| `Question` / `?` / `Answer` on separate lines | Multi-line card (`??` makes two cards, one in each direction) |
| `#flashcards/Travel` anywhere in a note | Sends that note's cards to the "Travel" deck |

Without a `#flashcards/…` tag, a card's deck is the note's folder. Lines inside code blocks are ignored.

## Development

```bash
npm install
npm run dev     # http://localhost:3000 (the offline service worker only runs in production builds)
npm run lint
npm run build
```

Built with Next.js 16 (App Router), React 19, `react-markdown` + `remark-gfm` + `remark-frontmatter`, `js-yaml`, and `react-force-graph-2d`. Mono adds Tailwind CSS 4 (utilities only, for the shadcn-style components in `src/components/ui`).

| Path | What it contains |
| --- | --- |
| `src/lib/` | Data model, link index, card parser, store, languages, word lookups (`lookup.ts`), your dictionary (`dictionary.ts`), properties (`properties.ts`), voices (`voices.ts`), scanning (`ocr.ts`), the Format request for Claude (`format.ts`), `cn` (`utils.ts`) |
| `src/components/` | App shell, sidebar, notes list, editor, markdown view, graph canvas, command palette, welcome, sheets (the ＋ sheet is `PlusSheet.tsx`) |
| `src/components/ui/` | The glass button (`liquid-glass-button.tsx`) and `GlassIcon`, the round glass icon built on it |
| `src/app/` | Routes: `/` (notes), `/notes`, `/search`, `/mind-map`, `/dictionary`, `/formatting`, `/flashcards`, `/flashcards/study`, `/settings`, plus `manifest.ts` and icons. `/home` and `/graph` redirect. |
| `src/app/styles/` | The styles, by job (`01-base.css` to `17-flat.css`), loaded in that order by `globals.css`: a later file wins |
| `public/sw.js` | Offline service worker (it leaves downloaded voices alone) |
