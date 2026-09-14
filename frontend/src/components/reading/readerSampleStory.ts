import type {
  DefinitionRead,
  ExamplePair,
  LemmaActionState,
  LemmaCardData,
  LemmaPos,
} from '@flyt/lexicon';

export type WordEntry = {
  forms: string[];
  state: LemmaActionState;
  card: LemmaCardData;
};

function buildEntry({
  word,
  pos,
  translation,
  displayForm,
  alternativeForms,
  ipa,
  state,
  forms,
  senses,
}: {
  word: string;
  pos: LemmaPos;
  translation: string;
  displayForm: string;
  alternativeForms: string[];
  ipa: string;
  state: LemmaActionState;
  forms: string[];
  senses: {
    definition: string;
    translation: string;
    examples: ExamplePair[];
  }[];
}): WordEntry {
  const definitions: DefinitionRead[] = senses.map((sense, index) => ({
    uuid: `${word}-sense-${index}`,
    id: index,
    definition: sense.definition,
    translation: sense.translation,
    translation_source: 'flyt',
    examples_json: sense.examples,
  }));

  return {
    forms,
    state,
    card: {
      uuid: `${word}-lemma`,
      word,
      pos,
      primary_translation: translation,
      primary_display_form: displayForm,
      alternative_forms: alternativeForms,
      ipa,
      ipa_approximate: false,
      intonation: null,
      audio_url: null,
      definitions,
    },
  };
}

const WORD_ENTRIES: WordEntry[] = [
  buildEntry({
    word: 'ulv',
    pos: 'noun',
    translation: 'wolf / predator',
    displayForm: 'en ulv',
    alternativeForms: ['ulven', 'ulver', 'ulvene'],
    ipa: 'ʉlv',
    state: 'new',
    forms: ['ulv', 'ulven', 'ulver', 'ulvene'],
    senses: [
      {
        definition: 'rovdyr i hundefamilien som lever i flokk',
        translation: 'wolf; a pack-living predator in the dog family',
        examples: [
          {
            no: 'Vi hørte ulvene lenge før vi så dem.',
            en: 'We heard the wolves long before we saw them.',
          },
          {
            no: 'Flokken fulgte vognen i timevis.',
            en: 'The pack followed the carriage for hours.',
          },
        ],
      },
      {
        definition: 'om et menneske: en som er farlig eller grådig',
        translation: 'figuratively: a ruthless or greedy person',
        examples: [
          {
            no: 'Han er en ulv i forhandlinger.',
            en: 'He is a wolf in negotiations.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'slott',
    pos: 'noun',
    translation: 'castle / palace',
    displayForm: 'et slott',
    alternativeForms: ['slottet', 'slott', 'slottene'],
    ipa: 'ʃlɔt',
    state: 'new',
    forms: ['slott', 'slottet', 'slottene'],
    senses: [
      {
        definition: 'stor, befestet bygning der en fyrste eller adelsmann bor',
        translation: 'castle; a large fortified residence',
        examples: [
          {
            no: 'Slottet lå høyt over dalen.',
            en: 'The castle lay high above the valley.',
          },
        ],
      },
      {
        definition: 'praktbygning brukt av kongefamilien',
        translation: 'palace used by a royal family',
        examples: [
          {
            no: 'Vi gikk forbi slottet i Oslo.',
            en: 'We walked past the palace in Oslo.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'greve',
    pos: 'noun',
    translation: 'count / earl',
    displayForm: 'en greve',
    alternativeForms: ['greven', 'grever', 'grevene'],
    ipa: 'ˈɡreːvə',
    state: 'new',
    forms: ['greve', 'greven', 'grevens', 'grever'],
    senses: [
      {
        definition: 'adelsmann med rang under fyrste og over baron',
        translation: 'count; a nobleman ranking below a prince',
        examples: [
          {
            no: 'Greven tok imot meg selv.',
            en: 'The count received me himself.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'vogn',
    pos: 'noun',
    translation: 'carriage / car',
    displayForm: 'ei vogn',
    alternativeForms: ['vogna', 'vognen', 'vogner'],
    ipa: 'vɔŋn',
    state: 'learning',
    forms: ['vogn', 'vognen', 'vogna', 'vogner'],
    senses: [
      {
        definition: 'kjøretøy på hjul som trekkes av hest',
        translation: 'a horse-drawn carriage',
        examples: [
          {
            no: 'Vognen stoppet foran porten.',
            en: 'The carriage stopped in front of the gate.',
          },
        ],
      },
      {
        definition: 'enkeltdel av et tog',
        translation: 'a railway car',
        examples: [
          {
            no: 'Vi satt i den siste vognen.',
            en: 'We sat in the last car.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'fjell',
    pos: 'noun',
    translation: 'mountain',
    displayForm: 'et fjell',
    alternativeForms: ['fjellet', 'fjell', 'fjellene'],
    ipa: 'fjɛl',
    state: 'learning',
    forms: ['fjell', 'fjellet', 'fjellene'],
    senses: [
      {
        definition: 'høy, bratt landformasjon av stein',
        translation: 'mountain; a high rocky landform',
        examples: [
          {
            no: 'Veien gikk mellom to fjell.',
            en: 'The road ran between two mountains.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'natt',
    pos: 'noun',
    translation: 'night',
    displayForm: 'ei natt',
    alternativeForms: ['natta', 'natten', 'netter'],
    ipa: 'nɑt',
    state: 'learning',
    forms: ['natt', 'natten', 'natta', 'netter', 'natten'],
    senses: [
      {
        definition: 'tiden mellom kveld og morgen',
        translation: 'night; the hours between evening and morning',
        examples: [
          {
            no: 'Han sov ikke om natten.',
            en: 'He did not sleep at night.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'kusk',
    pos: 'noun',
    translation: 'coachman / driver',
    displayForm: 'en kusk',
    alternativeForms: ['kusken', 'kusker'],
    ipa: 'kʉsk',
    state: 'new',
    forms: ['kusk', 'kusken', 'kusker'],
    senses: [
      {
        definition: 'person som kjører hest og vogn',
        translation: 'coachman; someone who drives a horse and carriage',
        examples: [
          {
            no: 'Kusken sa ingenting hele veien.',
            en: 'The coachman said nothing the whole way.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'trapp',
    pos: 'noun',
    translation: 'stairs / staircase',
    displayForm: 'ei trapp',
    alternativeForms: ['trappa', 'trappen', 'trapper'],
    ipa: 'trɑp',
    state: 'learning',
    forms: ['trapp', 'trappen', 'trappa', 'trapper'],
    senses: [
      {
        definition: 'rekke av trinn mellom to nivåer',
        translation: 'a staircase between two levels',
        examples: [
          {
            no: 'Trappen var slitt på midten.',
            en: 'The staircase was worn in the middle.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'port',
    pos: 'noun',
    translation: 'gate',
    displayForm: 'en port',
    alternativeForms: ['porten', 'porter'],
    ipa: 'pɔʈ',
    state: 'new',
    forms: ['port', 'porten', 'porter'],
    senses: [
      {
        definition: 'stor åpning eller dør i en mur eller et gjerde',
        translation: 'gate; a large opening in a wall or fence',
        examples: [
          {
            no: 'Porten sto åpen hele natten.',
            en: 'The gate stood open all night.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'dagbok',
    pos: 'noun',
    translation: 'diary / journal',
    displayForm: 'ei dagbok',
    alternativeForms: ['dagboka', 'dagboken', 'dagbøker'],
    ipa: 'ˈdɑːɡbuːk',
    state: 'learning',
    forms: ['dagbok', 'dagboken', 'dagboka', 'dagbøker'],
    senses: [
      {
        definition: 'bok der man skriver ned det som skjer fra dag til dag',
        translation: 'a diary kept day by day',
        examples: [
          {
            no: 'Jeg skrev i dagboken hver kveld.',
            en: 'I wrote in my diary every evening.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'skog',
    pos: 'noun',
    translation: 'forest / woods',
    displayForm: 'en skog',
    alternativeForms: ['skogen', 'skoger'],
    ipa: 'skuːɡ',
    state: 'learning',
    forms: ['skog', 'skogen', 'skoger'],
    senses: [
      {
        definition: 'stort område med tett voksende trær',
        translation: 'forest; a large area of densely growing trees',
        examples: [
          {
            no: 'Skogen ble tettere for hver kilometer.',
            en: 'The forest grew denser with every kilometre.',
          },
        ],
      },
    ],
  }),
  buildEntry({
    word: 'lys',
    pos: 'noun',
    translation: 'light / candle',
    displayForm: 'et lys',
    alternativeForms: ['lyset', 'lys', 'lysene'],
    ipa: 'lyːs',
    state: 'learning',
    forms: ['lys', 'lyset', 'lysene'],
    senses: [
      {
        definition: 'stråling som gjør at vi ser',
        translation: 'light; radiation that makes seeing possible',
        examples: [
          {
            no: 'Det var ikke lys i noen av vinduene.',
            en: 'There was no light in any of the windows.',
          },
        ],
      },
      {
        definition: 'stearinlys som brenner med veke',
        translation: 'a candle',
        examples: [
          {
            no: 'Han bar et lys foran meg opp trappen.',
            en: 'He carried a candle ahead of me up the stairs.',
          },
        ],
      },
    ],
  }),
];

export const LEXICON: Record<string, WordEntry> = Object.fromEntries(
  WORD_ENTRIES.flatMap((entry) => entry.forms.map((form) => [form, entry])),
);

export const STORY_PAGES: string[][] = [
  [
    'Solen sank bak fjellene lenge før vognen nådde det siste veiskillet, og lyset som ble igjen lå tynt og grått over skogen. Jeg skrev i dagboken så lenge jeg kunne skimte blyanten mot papiret, og da mørket først kom, la jeg boken i vesken og lyttet i stedet. Hestene pustet tungt i den kalde luften. Hjulene slo mot stein etter stein, og hver gang vognen kastet seg til siden, grep jeg tak i remmen over døren og holdt meg fast.',
    'Kusken hadde ikke sagt et ord siden vi forlot kroen nede i dalen. Han satt foroverbøyd med hatten trukket langt ned i pannen, og bare når veien ble smal, snakket han lavt til hestene på et språk jeg ikke forsto. Folkene på kroen hadde vært annerledes. De hadde stått tett rundt meg i døren, og en gammel kone hadde presset noe kaldt inn i hånden min før hun slapp taket og snudde seg bort uten å forklare noe.',
    'Det var et lite kors av tre. Jeg er engelskmann, og jeg holder meg til tidtabeller og kontrakter, ikke til varsler. Likevel lot jeg korset ligge i lommen, og flere ganger den kvelden kjente jeg etter det uten å ville innrømme hvorfor. Kanskje var det bare kulden. Kanskje var det måten de hadde sett på hverandre da jeg sa navnet på greven høyt, som om jeg hadde sagt noe upassende ved et bord fullt av fremmede.',
    'Veien steg jevnt. Skogen ble tettere, og mellom stammene lå snøen i lange, blå striper som ikke hadde smeltet på hele våren. En gang stanset vognen helt. Kusken reiste seg, lyttet mot fjellene, og satte seg igjen uten å si noe. Hestene ristet på hodet. Jeg hørte det da også, langt unna og tynt: hylet fra ulvene, først ett, så flere, som om natten selv hadde begynt å snakke med seg selv der ute i mørket.',
    'Jeg prøvde å tenke på arbeidet mitt i stedet. Papirene lå i vesken sammen med dagboken: skjøtet, kartet over eiendommen i England, brevene som hadde gått frem og tilbake i ni uker. Alt var i orden. Alt var undertegnet. En mann reiser ikke så langt for å bli redd av en lyd i skogen, sa jeg til meg selv, og jeg sa det høyt, fordi stemmen min gjorde vognen mindre tom enn stillheten gjorde den.',
    'Rundt midnatt endret veien karakter. Trærne trakk seg tilbake, og foran oss åpnet det seg et platå der vinden kom fritt fra tre kanter. Der stanset kusken igjen, og denne gangen pekte han. Høyt oppe, mot en himmel som var en anelse lysere enn fjellet under, sto slottet. Det var ikke et eneste lys i vinduene. Det lignet mest av alt en tann som var brukket av og latt stå, svart mot det blå.',
    'Vi kjørte det siste stykket uten et ord. Porten sto åpen, og gårdsplassen innenfor var større enn jeg hadde ventet, brolagt og helt tom. Kusken løftet ned kofferten min, satte den på steinene, klatret opp igjen og kjørte ut gjennom porten før jeg rakk å spørre om noe som helst. Lyden av hjulene ble borte i mørket, og så var det bare vinden, og trappen opp mot en dør av eik og jern.',
    'Jeg ble stående lenge. En reisende som banker på en fremmed dør ved midnatt, har ingen verdighet igjen å miste, tenkte jeg, og løftet hånden. Før jeg rakk å slå, hørte jeg en lås bli vridd om på innsiden, tung og langsom, som om den ikke hadde vært brukt på år. Døren gikk opp. Bak den sto greven med et lys i hånden, og han smilte uten å vise tenner.',
  ],
  [
    'Han var høy og kledd i svart fra topp til tå, uten en eneste fargeflekk noe sted. Lyset han bar, sto helt stille i hånden hans, selv i trekken fra den åpne døren. «Velkommen,» sa han på engelsk, langsomt og tydelig, som en mann som har lært språket av bøker og ikke av mennesker. «Huset er kaldt, og det er sent, men De skal få alt De trenger her hos meg.»',
    'Hånden hans var kald da jeg tok den, kaldere enn natten utenfor, og grepet var så fast at fingrene mine verket lenge etterpå. Han bar kofferten min selv, opp trappen, uten å puste tyngre av det. Jeg tilbød meg å hjelpe. Han svarte at tjenerne sov, at huset var gammelt, og at han for lengst hadde vent seg til å gjøre slikt arbeid alene. Trinnene i trappen var slitt ned på midten.',
    'Rommet han førte meg til, var varmt. Det brant i peisen, og på et bord ved vinduet sto et måltid dekket til én person: stekt kylling, ost, en skål med tørket frukt og en flaske gammel vin. Han satte seg i skyggen ved siden av ildstedet mens jeg spiste, og han rørte verken maten eller vinen. Han sa at han hadde spist tidligere på kvelden, og at han sjelden var sulten om natten.',
    'Vi snakket om eiendommen. Greven kjente hver klausul i papirene bedre enn jeg gjorde, og han stilte spørsmål om ting jeg ikke hadde tenkt på: hvor mange dører huset i England hadde, hvor dypt kjelleren gikk, om det fantes gammel jord under gulvet. Han spurte også om togene, om avganger og bytter og hvilke stasjoner man måtte vente på, og han gjentok tidene etter meg som om han lærte dem utenat.',
    'Etter hvert ble jeg trett, men jeg ville ikke reise meg først. Han fortalte om fjellene omkring, om slektene som hadde bodd her, om kriger som var vunnet og tapt i pass og daler jeg hadde kjørt gjennom samme kveld uten å vite det. Han snakket om dem som om han hadde stått der selv, og en gang, midt i en setning, sa han «vi» og rettet det ikke opp igjen.',
    'Langt nede begynte ulvene igjen. Greven reiste seg, gikk til vinduet og åpnet det på vidt gap, og den kalde luften slo inn i rommet og fikk flammene i peisen til å legge seg flate. «De synger hver gang været skifter,» sa han. «Man venner seg til det. Etter noen år er det stillheten man våkner av.» Så lukket han vinduet og spurte, i en helt annen tone, om jeg var sliten etter reisen.',
    'Soverommet mitt lå i enden av en lang gang. Han bar lyset foran meg hele veien, og skyggen min gikk foran ham på veggen, aldri hans egen. Jeg la merke til det uten å forstå det. Ved døren ønsket han meg god natt og ba meg sove så lenge jeg ville, men å holde meg til de rommene som sto åpne, og ikke lete etter søvn andre steder i slottet.',
    'Da jeg var alene, tok jeg frem dagboken og skrev alt dette ned mens jeg ennå husket ordene hans nøyaktig. Det finnes ingen speil her. Det finnes ingen klokker som slår. Døren har en lås, men nøkkelen mangler, og fra vinduet mitt ser jeg bare fjell og skog og, langt der nede, en tynn strek som må være veien jeg kom på. I morgen begynner arbeidet. Jeg skriver igjen når jeg vet mer.',
  ],
];
