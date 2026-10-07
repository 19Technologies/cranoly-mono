// Languages Cranoly Mono knows how to speak, look up and check.

export interface Language {
  code: string;
  name: string;
  /** BCP 47 tag for the device's text-to-speech voices. */
  voice: string;
  /** LanguageTool language, or null when grammar checking isn't available. */
  grammar: string | null;
  /** Articles for grammatical gender (m / f / n), shown in front of nouns. */
  articles?: Partial<Record<"m" | "f" | "n", string>>;
  /** Very common words that are never worth a flashcard on their own. */
  common: string[];
  /** Good morning / good afternoon / good evening. */
  greet?: [string, string, string];
  /** A few easy first words, offered during onboarding. */
  starter?: string[];
  /** "Hello" in the language, for the language picker. */
  hello: string;
  /** Tesseract language for "Scan text". */
  ocr: string;
  /** Natural voice Cranoly Mono can download (Piper). Without one, the device's own voice is used. */
  model?: { name?: string; path: string; mb: number };
}

export const LANGUAGES: Language[] = [
  {
    code: "de", name: "German", hello: "Hallo", ocr: "deu", model: { name: "Thorsten", path: "de/de_DE/thorsten/medium/de_DE-thorsten-medium", mb: 63 }, greet: ["Guten Morgen", "Guten Tag", "Guten Abend"], starter: ["Hund", "Haus", "Wasser", "danke"], voice: "de-DE", grammar: "de-DE", articles: { m: "der", f: "die", n: "das" },
    common: "der die das den dem des ein eine einen einem einer eines und oder aber ist sind war bin bist hat habe haben ich du er sie es wir ihr mich mir dich dir sich uns euch mein dein sein nicht kein keine zu zum zur mit von vom für auf an am im in ins aus bei nach so wie was wer wo da dass auch noch schon nur sehr ja nein".split(" "),
  },
  {
    code: "fr", name: "French", hello: "Bonjour", ocr: "fra", model: { name: "Siwis", path: "fr/fr_FR/siwis/medium/fr_FR-siwis-medium", mb: 63 }, greet: ["Bonjour", "Bonjour", "Bonsoir"], starter: ["chien", "maison", "eau", "merci"], voice: "fr-FR", grammar: "fr", articles: { m: "le", f: "la" },
    common: "le la les l un une des du de d et ou mais est sont suis es a ai as ont je tu il elle on nous vous ils elles me te se ne pas en dans sur pour par avec que qui ce cette ces mon ma mes son sa ses au aux y oui non très".split(" "),
  },
  {
    code: "es", name: "Spanish", hello: "Hola", ocr: "spa", model: { name: "Dave", path: "es/es_ES/davefx/medium/es_ES-davefx-medium", mb: 63 }, greet: ["Buenos días", "Buenas tardes", "Buenas noches"], starter: ["perro", "casa", "agua", "gracias"], voice: "es-ES", grammar: "es", articles: { m: "el", f: "la" },
    common: "el la los las un una unos unas y o pero es son soy eres está están estoy yo tú él ella nosotros vosotros ellos ellas me te se no en de del al con por para que mi mis tu tus su sus muy sí".split(" "),
  },
  {
    code: "it", name: "Italian", hello: "Ciao", ocr: "ita", model: { name: "Paola", path: "it/it_IT/paola/medium/it_IT-paola-medium", mb: 63 }, greet: ["Buongiorno", "Buon pomeriggio", "Buonasera"], starter: ["cane", "casa", "acqua", "grazie"], voice: "it-IT", grammar: "it", articles: { m: "il", f: "la" },
    common: "il lo la i gli le un uno una e o ma è sono sei ho hai ha io tu lui lei noi voi loro mi ti si non in di da del della con per che chi mio mia tuo tua suo sua molto sì".split(" "),
  },
  {
    code: "pt", name: "Portuguese", hello: "Olá", ocr: "por", model: { name: "Tugão", path: "pt/pt_PT/tugão/medium/pt_PT-tugão-medium", mb: 63 }, greet: ["Bom dia", "Boa tarde", "Boa noite"], starter: ["cão", "casa", "água", "obrigado"], voice: "pt-PT", grammar: "pt-PT", articles: { m: "o", f: "a" },
    common: "o a os as um uma e ou mas é são sou estou está eu tu ele ela nós vós eles elas me te se não em de do da no na com por para que meu minha teu tua seu sua muito sim".split(" "),
  },
  { code: "nl", name: "Dutch", hello: "Hallo", ocr: "nld", model: { path: "nl/nl_NL/mls/medium/nl_NL-mls-medium", mb: 77 }, greet: ["Goedemorgen", "Goedemiddag", "Goedenavond"], starter: ["hond", "huis", "water", "bedankt"], voice: "nl-NL", grammar: "nl", articles: { m: "de", f: "de", n: "het" }, common: "de het een en of maar is zijn ben ik jij je hij zij ze wij we jullie niet in op aan van met voor dat die wat ja nee".split(" ") },
  { code: "sv", name: "Swedish", hello: "Hej", ocr: "swe", model: { path: "sv/sv_SE/nst/medium/sv_SE-nst-medium", mb: 63 }, greet: ["God morgon", "God dag", "God kväll"], starter: ["hund", "hus", "vatten", "tack"], voice: "sv-SE", grammar: "sv", common: "en ett och eller men är var jag du han hon vi ni de inte i på av med för att som det den ja nej".split(" ") },
  { code: "pl", name: "Polish", hello: "Cześć", ocr: "pol", model: { name: "Gosia", path: "pl/pl_PL/gosia/medium/pl_PL-gosia-medium", mb: 63 }, greet: ["Dzień dobry", "Dzień dobry", "Dobry wieczór"], starter: ["pies", "dom", "woda", "dziękuję"], voice: "pl-PL", grammar: "pl-PL", common: "i a ale lub jest są jestem ja ty on ona my wy oni nie w na z do że to tak".split(" ") },
  { code: "ru", name: "Russian", hello: "Привет", ocr: "rus", model: { name: "Irina", path: "ru/ru_RU/irina/medium/ru_RU-irina-medium", mb: 63 }, greet: ["Доброе утро", "Добрый день", "Добрый вечер"], starter: ["собака", "дом", "вода", "спасибо"], voice: "ru-RU", grammar: "ru-RU", common: "и а но или это я ты он она мы вы они не в на с к по что как да нет".split(" ") },
  { code: "uk", name: "Ukrainian", hello: "Привіт", ocr: "ukr", model: { path: "uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium", mb: 77 }, greet: ["Доброго ранку", "Добрий день", "Добрий вечір"], starter: ["собака", "дім", "вода", "дякую"], voice: "uk-UA", grammar: "uk-UA", common: "і й а але або це я ти він вона ми ви вони не в у на з до що як так ні".split(" ") },
  { code: "ja", name: "Japanese", hello: "こんにちは", ocr: "jpn", greet: ["おはようございます", "こんにちは", "こんばんは"], starter: ["犬", "家", "水", "ありがとう"], voice: "ja-JP", grammar: "ja-JP", common: [] },
  { code: "zh", name: "Chinese", hello: "你好", ocr: "chi_sim", model: { name: "Huayan", path: "zh/zh_CN/huayan/medium/zh_CN-huayan-medium", mb: 63 }, greet: ["早上好", "下午好", "晚上好"], starter: ["狗", "家", "水", "谢谢"], voice: "zh-CN", grammar: "zh-CN", common: [] },
  { code: "ko", name: "Korean", hello: "안녕하세요", ocr: "kor", greet: ["좋은 아침이에요", "안녕하세요", "좋은 저녁이에요"], starter: ["개", "집", "물", "감사합니다"], voice: "ko-KR", grammar: null, common: [] },
  { code: "ar", name: "Arabic", hello: "مرحبا", ocr: "ara", model: { name: "Kareem", path: "ar/ar_JO/kareem/medium/ar_JO-kareem-medium", mb: 63 }, greet: ["صباح الخير", "مساء الخير", "مساء الخير"], starter: ["كلب", "بيت", "ماء", "شكرا"], voice: "ar-SA", grammar: "ar", common: [] },
  { code: "tr", name: "Turkish", hello: "Merhaba", ocr: "tur", model: { path: "tr/tr_TR/dfki/medium/tr_TR-dfki-medium", mb: 63 }, greet: ["Günaydın", "İyi günler", "İyi akşamlar"], starter: ["köpek", "ev", "su", "teşekkürler"], voice: "tr-TR", grammar: null, common: "ve veya ama bir bu şu o ben sen biz siz onlar değil ile için da de mi evet hayır".split(" ") },
  { code: "sw", name: "Swahili", hello: "Jambo", ocr: "swa", model: { path: "sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium", mb: 63 }, greet: ["Habari za asubuhi", "Habari za mchana", "Habari za jioni"], starter: ["mbwa", "nyumba", "maji", "asante"], voice: "sw-KE", grammar: null, common: "na ya wa za la kwa ni si mimi wewe yeye sisi ninyi wao katika hii huu ndiyo hapana".split(" ") },
  {
    code: "en", name: "English", hello: "Hello", ocr: "eng", model: { path: "en/en_US/hfc_female/medium/en_US-hfc_female-medium", mb: 63 }, greet: ["Good morning", "Good afternoon", "Good evening"], starter: ["dog", "house", "water", "thanks"], voice: "en-US", grammar: "en-US",
    common: "the a an and or but is are was were am be been i you he she it we they me him her us them my your his its our their not no yes in on at of to for with from by as that this these those what who how".split(" "),
  },
];

export const languageOf = (code: string) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

/**
 * Sample card lines in the learner's own language, for the tour, the help and the Formatting guide,
 * so no screen shows fixed German. Every language's starter words mean dog, house, water and thanks,
 * and greet[0] means "good morning". Meanings come from the learner's own language, else English.
 */
export function cardExamples(learning: string, native: string) {
  const l = languageOf(learning);
  const en = LANGUAGES.find((x) => x.code === "en")!;
  const g = (native !== l.code && LANGUAGES.find((x) => x.code === native)) || en;
  const word = (lang: Language, i: number) => lang.starter?.[i] ?? en.starter![i];
  const morning = l.greet?.[0] ?? l.hello;
  const cut = morning.lastIndexOf(" ");
  const hidden = cut > 0 ? morning.slice(cut + 1) : morning;
  const ask = `How do you say “${word(g, 3)}”?`;
  return {
    one: { code: `${l.hello} :: ${g.hello}`, front: l.hello, back: g.hello },
    both: { code: `${word(l, 0)} ::: ${word(g, 0)}`, front: word(l, 0), back: word(g, 0) },
    gap: { code: cut > 0 ? `${morning.slice(0, cut + 1)}==${hidden}==` : `==${hidden}==`, hidden },
    question: { code: `${ask}\n?\n${word(l, 3)}`, front: ask, back: word(l, 3) },
  };
}

/** The device's language, as one of ours (falls back to English). */
export function deviceLanguage() {
  if (typeof navigator === "undefined") return "en";
  const code = navigator.language?.slice(0, 2).toLowerCase();
  return LANGUAGES.some((l) => l.code === code) ? code : "en";
}
