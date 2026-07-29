// ─────────────────────────────────────────────────────────────
//  Distilled Crux — per-subject config
//  Used by: /api/chat (scope guard, thinker whitelist, RAG books)
//           /chat    (suggested questions, greeting)
// ─────────────────────────────────────────────────────────────

export type SubjectKey =
  | 'sociology'
  | 'anthropology'
  | 'polsci'
  | 'geography'
  | 'pub-admin';

// ── Per-subject thinker/scholar whitelist ────────────────────
// Format identical to history-optional's WHITELISTED_HISTORIAN_BOOKS:
//   surname → array of their verified book titles (lowercase)
// Add more as books get embedded in Supabase.

export const SUBJECT_THINKER_BOOKS: Record<SubjectKey, Record<string, string[]>> = {

  sociology: {
    'Durkheim': ['the division of labour in society', 'suicide', 'the elementary forms of religious life', 'rules of sociological method'],
    'Weber': ['economy and society', 'the protestant ethic and the spirit of capitalism', 'from max weber', 'the sociology of religion'],
    'Marx': ['capital', 'the communist manifesto', 'the german ideology', 'grundrisse', 'the eighteenth brumaire'],
    'Parsons': ['the social system', 'the structure of social action', 'towards a general theory of action'],
    'Merton': ['social theory and social structure', 'on the shoulders of giants', 'the sociology of science'],
    'Giddens': ['the constitution of society', 'the consequences of modernity', 'modernity and self-identity', 'the third way', 'runaway world'],
    'Haralambos': ['sociology themes and perspectives', 'haralambos and holborn'],
    'Bottomore': ['sociology: a guide to problems and literature', 'elites and society', 'political sociology'],
    'Ritzer': ['sociological theory', 'the mcdonaldization of society', 'modern sociological theory'],
    'Bourdieu': ['distinction', 'the logic of practice', 'outline of a theory of practice', 'reproduction in education society and culture'],
    'Foucault': ['discipline and punish', 'the history of sexuality', 'madness and civilization', 'power/knowledge'],
    'Simmel': ['the sociology of georg simmel', 'conflict and the web of group affiliations'],
    'Cooley': ['human nature and the social order', 'social organisation'],
    'Mead': ['mind self and society'],
    'Comte': ['the positive philosophy', 'system of positive polity'],
    'Spencer': ['the study of sociology', 'principles of sociology'],
    'Srinivas': ['caste in modern india', 'social change in modern india', 'the remembered village', 'religion and society among the coorgs'],
    'Ghurye': ['caste and race in india', 'social tensions in india'],
    'Desai': ['social background of indian nationalism', 'rural sociology in india'],
    'Dube': ['indian village', 'modernization and development'],
    'Ambedkar': ['annihilation of caste', 'the buddha and his dhamma', 'who were the shudras'],
    'Beteille': ['caste class and power', 'society and politics in india', 'the backward classes and the new social order'],
    'Mandal': ['report of the backward classes commission'],
  },

  anthropology: {
    'Morgan': ['ancient society', 'systems of consanguinity and affinity', 'league of the iroquois'],
    'Tyler': ['primitive culture', 'researches into the early history of mankind'],
    'Frazer': ['the golden bough'],
    'Boas': ['the mind of primitive man', 'race language and culture', 'anthropology and modern life'],
    'Malinowski': ['argonauts of the western pacific', 'a scientific theory of culture', 'the sexual life of savages', 'crime and custom in savage society', 'magic science and religion'],
    'Radcliffe-Brown': ['structure and function in primitive society', 'the andaman islanders', 'african systems of kinship and marriage'],
    'Lévi-Strauss': ['structural anthropology', 'the savage mind', 'the elementary structures of kinship', 'tristes tropiques', 'mythologiques'],
    'Evans-Pritchard': ['the nuer', 'witchcraft oracles and magic among the azande', 'kinship and marriage among the nuer'],
    'Mead': ['coming of age in samoa', 'sex and temperament in three primitive societies', 'male and female'],
    'Benedict': ['patterns of culture', 'the chrysanthemum and the sword'],
    'Keesing': ['cultural anthropology: a contemporary perspective', 'kin groups and social structure'],
    'Ember': ['anthropology', 'cultural anthropology'],
    'Kottak': ['anthropology: appreciating human diversity', 'cultural anthropology'],
    'Haviland': ['anthropology', 'cultural anthropology: the human challenge'],
    'Harris': ['cultural materialism', 'the rise of anthropological theory', 'cows pigs wars and witches'],
    'White': ['the science of culture', 'the evolution of culture'],
    'Steward': ['theory of culture change'],
    'Gluckman': ['custom and conflict in africa', 'politics law and ritual in tribal society'],
    'Turner': ['the ritual process', 'the forest of symbols', 'schism and continuity in an african society'],
    'Geertz': ['the interpretation of cultures', 'local knowledge', 'negara'],
    'Fox': ['kinship and marriage', 'encounter with anthropology'],
    'Elwin': ['the baiga', 'the muria and their ghotul', 'tribal world of verrier elwin', 'a philosophy for nefa'],
    'Xaxa': ['state society and tribes'],
    'Beteille': ['the idea of natural inequality and other essays'],
    'Singh': ['tribal situation in india', 'modernization among tribals'],
  },

  polsci: {
    'Aristotle': ['politics', 'nicomachean ethics'],
    'Plato': ['the republic', 'the laws'],
    'Locke': ['two treatises of government', 'a letter concerning toleration'],
    'Hobbes': ['leviathan'],
    'Rousseau': ['the social contract', 'discourse on the origin of inequality'],
    'Mill': ['on liberty', 'considerations on representative government', 'the subjection of women', 'utilitarianism'],
    'Rawls': ['a theory of justice', 'political liberalism', 'the law of peoples'],
    'Marx': ['the communist manifesto', 'capital', 'the german ideology', 'critique of the gotha programme'],
    'Gramsci': ['selections from the prison notebooks', 'letters from prison'],
    'Lenin': ['the state and revolution', 'imperialism the highest stage of capitalism'],
    'Dahl': ['a preface to democratic theory', 'democracy and its critics', 'who governs', 'polyarchy'],
    'Huntington': ['the clash of civilizations', 'the third wave', 'political order in changing societies'],
    'Morgenthau': ['politics among nations', 'scientific man versus power politics'],
    'Waltz': ['man the state and war', 'theory of international politics'],
    'Keohane': ['after hegemony', 'power and interdependence'],
    'Nye': ['bound to lead', 'the paradox of american power', 'soft power'],
    'Bull': ['the anarchical society'],
    'Lijphart': ['patterns of democracy', 'democracies'],
    'Verney': ['the analysis of political systems'],
    'Finer': ['comparative government', 'the man on horseback'],
    'Ambedkar': ['annihilation of caste', 'states and minorities', 'what congress and gandhi have done to the untouchables'],
    'Gandhi': ['hind swaraj', 'the story of my experiments with truth'],
    'Nehru': ['the discovery of india', 'glimpses of world history'],
    'Austin': ['the indian constitution: cornerstone of a nation'],
    'Granville Austin': ['working a democratic constitution'],
  },

  geography: {
    'Davis': ['geographical essays'],
    'Penck': ['morphology of the earth surface'],
    'Thornbury': ['principles of geomorphology'],
    'Lobeck': ['geomorphology'],
    'Strahler': ['physical geography'],
    'Trewartha': ['an introduction to climate'],
    'Koppen': ['a system of climate classification'],
    'Stamp': ['a glossary of geographical terms', 'applied geography'],
    'Sauer': ['agricultural origins and dispersals', 'the morphology of landscape'],
    'Harvey': ['explanation in geography', 'social justice and the city', 'the condition of postmodernity'],
    'Johnston': ['geography and geographers', 'a dictionary of human geography'],
    'Haggett': ['geography: a modern synthesis', 'locational analysis in human geography'],
    'Christaller': ['central places in southern germany'],
    'Von Thunen': ['the isolated state'],
    'Weber': ['theory of the location of industries'],
    'Zelinsky': ['the cultural geography of the united states'],
    'Myrdal': ['economic theory and under-developed regions'],
    'Rostow': ['the stages of economic growth'],
    'Hartshorne': ['the nature of geography', 'perspective on the nature of geography'],
    'Ratzel': ['political geography'],
    'Mackinder': ['democratic ideals and reality', 'the geographical pivot of history'],
    'Savindra Singh': ['geomorphology', 'climatology', 'physical geography'],
    'Majid Husain': ['geography of india', 'world geography', 'human geography'],
    'Khullar': ['india a comprehensive geography'],
  },

  'pub-admin': {
    'Wilson': ['the study of administration'],
    'Taylor': ['principles of scientific management', 'shop management'],
    'Fayol': ['general and industrial management'],
    'Weber': ['economy and society', 'from max weber'],
    'Simon': ['administrative behaviour', 'public administration', 'the sciences of the artificial'],
    'Maslow': ['motivation and personality', 'a theory of human motivation'],
    'McGregor': ['the human side of enterprise'],
    'Herzberg': ['the motivation to work', 'work and the nature of man'],
    'Barnard': ['the functions of the executive'],
    'Drucker': ['the practice of management', 'management: tasks responsibilities practices'],
    'Waldo': ['the administrative state', 'democracy and the administrative state'],
    'Riggs': ['administration in developing countries', 'thailand: the modernization of a bureaucratic polity'],
    'Appleby': ['policy and administration', 'morality and administration in democratic government'],
    'Pfiffner': ['public administration'],
    'White': ['introduction to the study of public administration'],
    'Marx': ['elements of public administration'],
    'Gorwala': ['report on public administration'],
    'Santhanam': ['report of the committee on prevention of corruption'],
    'Kothari': ['report of the committee on recruitment policy and selection methods'],
    'Avasthi': ['public administration'],
    'Maheshwari': ['indian administration'],
    'Arora': ['indian public administration'],
  },
};

// ── Broad-only thinkers (mention ok, specific claims → strip) ──
export const SUBJECT_BROAD_ONLY: Record<SubjectKey, string[]> = {
  sociology: ['Sorokin', 'Tonnies', 'Veblen', 'Mannheim', 'Elias'],
  anthropology: ['Murdock', 'Westermarck', 'Lowie', 'Kroeber', 'Sapir'],
  polsci: ['Easton', 'Almond', 'Verba', 'Laswell', 'Deutsch'],
  geography: ['Humboldt', 'Ritter', 'Vidal de la Blache', 'Brunhes'],
  'pub-admin': ['Gulick', 'Urwick', 'Follett', 'Mooney', 'Reiley'],
};

// ── Suggested questions (6 per subject) ──────────────────────
export const SUGGESTED_QUESTIONS: Record<SubjectKey, { en: string[]; hi: string[] }> = {
  sociology: {
    en: [
      "Durkheim's concept of anomie — explain with contemporary relevance.",
      "Compare Marx and Weber on social stratification.",
      "What is Parsons' AGIL schema? Critically examine.",
      "Discuss the features of caste system in India — changes post-independence.",
      "Differentiate positivism from interpretivism in sociological research.",
      "Critically examine Merton's concept of manifest and latent functions.",
    ],
    hi: [
      "दुर्खीम की अनोमी की अवधारणा — समकालीन प्रासंगिकता सहित समझाएं।",
      "सामाजिक स्तरीकरण पर मार्क्स और वेबर की तुलना करें।",
      "पार्सन्स का AGIL schema क्या है? आलोचनात्मक परीक्षण करें।",
      "भारत में जाति व्यवस्था की विशेषताएं — स्वतंत्रता के बाद के परिवर्तन।",
      "समाजशास्त्रीय अनुसंधान में प्रत्यक्षवाद और व्याख्यावाद में अंतर करें।",
      "मर्टन की प्रत्यक्ष और अप्रत्यक्ष कार्यों की अवधारणा का आलोचनात्मक परीक्षण।",
    ],
  },
  anthropology: {
    en: [
      "Distinguish between cultural and social anthropology with examples.",
      "Explain Lévi-Strauss's structural approach to kinship and myth.",
      "What is the significance of Malinowski's fieldwork in Trobriand Islands?",
      "Discuss the fossil evidence for human evolution — Australopithecus to Homo sapiens.",
      "Critically examine the concept of cultural relativism.",
      "Tribal policy in India — from isolation to mainstreaming.",
    ],
    hi: [
      "सांस्कृतिक और सामाजिक नृविज्ञान में उदाहरण सहित अंतर करें।",
      "नातेदारी और मिथक पर लेवी-स्ट्रॉस का संरचनावादी दृष्टिकोण समझाएं।",
      "ट्रोब्रियंड द्वीपों में मालिनोव्स्की के क्षेत्रकार्य का महत्व क्या है?",
      "मानव विकास के जीवाश्म साक्ष्य — ऑस्ट्रेलोपिथेकस से होमो सेपियंस तक।",
      "सांस्कृतिक सापेक्षवाद की अवधारणा का आलोचनात्मक परीक्षण करें।",
      "भारत में जनजातीय नीति — अलगाव से मुख्यधारा तक।",
    ],
  },
  polsci: {
    en: [
      "Critically examine the realist theory of international relations.",
      "Discuss the features of Indian federalism — cooperative vs competitive.",
      "What is Gramsci's concept of hegemony? Its relevance today.",
      "Compare presidential and parliamentary systems of government.",
      "Explain Rawls' theory of justice and its critiques.",
      "Civil society and democracy — examine the relationship.",
    ],
    hi: [
      "अंतर्राष्ट्रीय संबंधों के यथार्थवादी सिद्धांत का आलोचनात्मक परीक्षण करें।",
      "भारतीय संघवाद की विशेषताएं — सहकारी बनाम प्रतिस्पर्धी।",
      "ग्राम्शी की वर्चस्व की अवधारणा क्या है? आज की प्रासंगिकता।",
      "राष्ट्रपति और संसदीय शासन प्रणाली की तुलना करें।",
      "रॉल्स के न्याय के सिद्धांत और उसकी आलोचनाएं समझाएं।",
      "नागरिक समाज और लोकतंत्र — संबंध की जांच करें।",
    ],
  },
  geography: {
    en: [
      "Explain Davis's cycle of erosion — its criticisms and alternatives.",
      "Discuss the factors influencing world climate — Koppen's classification.",
      "What is Christaller's central place theory? Examine its relevance.",
      "Critically examine the concept of sustainable development in geography.",
      "Ocean currents — their formation and impact on world climate.",
      "Discuss the geographical basis of India's agricultural regions.",
    ],
    hi: [
      "डेविस के अपरदन चक्र की व्याख्या करें — इसकी आलोचनाएं और विकल्प।",
      "विश्व जलवायु को प्रभावित करने वाले कारक — कोपेन का वर्गीकरण।",
      "क्रिस्टालर का केंद्रीय स्थान सिद्धांत क्या है? इसकी प्रासंगिकता की जांच करें।",
      "भूगोल में सतत विकास की अवधारणा का आलोचनात्मक परीक्षण करें।",
      "महासागरीय धाराएं — उनका निर्माण और विश्व जलवायु पर प्रभाव।",
      "भारत के कृषि क्षेत्रों के भौगोलिक आधार की चर्चा करें।",
    ],
  },
  'pub-admin': {
    en: [
      "Critically examine Weber's ideal type bureaucracy — is it still relevant?",
      "Distinguish between classical and human relations theory of organisation.",
      "What is Simon's concept of 'bounded rationality'? Examine critically.",
      "Discuss the evolution of new public management (NPM) — its strengths and limitations.",
      "Right to Information and administrative accountability — assess the impact.",
      "District administration in India — structure, functions and challenges.",
    ],
    hi: [
      "वेबर की आदर्श-प्रकार नौकरशाही का आलोचनात्मक परीक्षण करें — क्या यह अभी भी प्रासंगिक है?",
      "संगठन के शास्त्रीय और मानवीय संबंध सिद्धांत में अंतर करें।",
      "साइमन की 'सीमित तर्कसंगतता' की अवधारणा क्या है? आलोचनात्मक परीक्षण करें।",
      "नई सार्वजनिक प्रबंधन (NPM) के विकास की चर्चा — इसकी शक्तियां और सीमाएं।",
      "सूचना का अधिकार और प्रशासनिक जवाबदेही — प्रभाव का आकलन करें।",
      "भारत में जिला प्रशासन — संरचना, कार्य और चुनौतियां।",
    ],
  },
};

// ── Full subject display name for scope guard ─────────────────
export const SUBJECT_DISPLAY: Record<SubjectKey, string> = {
  sociology: 'Sociology',
  anthropology: 'Anthropology',
  polsci: 'Political Science & IR',
  geography: 'Geography',
  'pub-admin': 'Public Administration',
};

// ── Books per subject (placeholder — add to Supabase as books get embedded) ──
// These are the book_title values that will be stored in Supabase once embedded.
// The select dropdown is populated from here.
export const SUBJECT_BOOKS: Record<SubjectKey, { group: string; books: { value: string; label: string }[] }[]> = {
  sociology: [
    {
      group: 'Core Theory',
      books: [
        { value: 'Haralambos & Holborn — Sociology Themes and Perspectives', label: 'Haralambos & Holborn — Themes and Perspectives' },
        { value: 'Anthony Giddens — Sociology', label: 'Giddens — Sociology' },
        { value: 'Ritzer — Sociological Theory', label: 'Ritzer — Sociological Theory' },
        { value: 'Bottomore — Sociology: A Guide to Problems and Literature', label: 'Bottomore — Sociology Guide' },
      ],
    },
    {
      group: 'Indian Sociology',
      books: [
        { value: 'IGNOU Sociology Paper 1', label: 'IGNOU Sociology Paper I' },
        { value: 'IGNOU Sociology Paper 2', label: 'IGNOU Sociology Paper II' },
        { value: 'Srinivas — Social Change in Modern India', label: 'Srinivas — Social Change in Modern India' },
        { value: 'Beteille — Caste Class and Power', label: 'Beteille — Caste Class and Power' },
        { value: 'Desai — Social Background of Indian Nationalism', label: 'Desai — Social Background' },
      ],
    },
  ],
  anthropology: [
    {
      group: 'Core Anthropology',
      books: [
        { value: 'Ember & Ember — Anthropology', label: 'Ember & Ember — Anthropology' },
        { value: 'Keesing — Cultural Anthropology', label: 'Keesing — Cultural Anthropology' },
        { value: 'Haviland — Cultural Anthropology', label: 'Haviland — Cultural Anthropology' },
        { value: 'Kottak — Cultural Anthropology', label: 'Kottak — Cultural Anthropology' },
      ],
    },
    {
      group: 'IGNOU',
      books: [
        { value: 'IGNOU Anthropology Paper 1', label: 'IGNOU Anthropology Paper I' },
        { value: 'IGNOU Anthropology Paper 2', label: 'IGNOU Anthropology Paper II' },
      ],
    },
    {
      group: 'Indian Anthropology',
      books: [
        { value: 'Xaxa — State Society and Tribes', label: 'Xaxa — State Society and Tribes' },
        { value: 'Elwin — The Muria and their Ghotul', label: 'Elwin — The Muria' },
      ],
    },
  ],
  polsci: [
    {
      group: 'Core Theory',
      books: [
        { value: 'IGNOU Political Science Paper 1', label: 'IGNOU PolSci Paper I' },
        { value: 'IGNOU Political Science Paper 2', label: 'IGNOU PolSci Paper II' },
        { value: 'Heywood — Political Theory', label: 'Heywood — Political Theory' },
        { value: 'Heywood — Politics', label: 'Heywood — Politics' },
      ],
    },
    {
      group: 'IR',
      books: [
        { value: 'Baylis & Smith — The Globalization of World Politics', label: 'Baylis & Smith — World Politics' },
        { value: 'Morgenthau — Politics Among Nations', label: 'Morgenthau — Politics Among Nations' },
      ],
    },
    {
      group: 'Indian Polity',
      books: [
        { value: 'Austin — The Indian Constitution: Cornerstone of a Nation', label: 'Austin — Indian Constitution' },
        { value: 'Lakshmikanth — Indian Polity', label: 'Lakshmikanth — Indian Polity' },
      ],
    },
  ],
  geography: [
    {
      group: 'Physical',
      books: [
        { value: 'Savindra Singh — Geomorphology', label: 'Savindra Singh — Geomorphology' },
        { value: 'Savindra Singh — Climatology', label: 'Savindra Singh — Climatology' },
        { value: 'Savindra Singh — Physical Geography', label: 'Savindra Singh — Physical Geography' },
        { value: 'Strahler — Physical Geography', label: 'Strahler — Physical Geography' },
      ],
    },
    {
      group: 'Human & Economic',
      books: [
        { value: 'Majid Husain — Human Geography', label: 'Majid Husain — Human Geography' },
        { value: 'Majid Husain — World Geography', label: 'Majid Husain — World Geography' },
      ],
    },
    {
      group: 'India',
      books: [
        { value: 'Majid Husain — Geography of India', label: 'Majid Husain — Geography of India' },
        { value: 'Khullar — India: A Comprehensive Geography', label: 'Khullar — India Geography' },
        { value: 'NCERT Geography Class 11 Part 1', label: 'NCERT Geo XI Part 1' },
        { value: 'NCERT Geography Class 11 Part 2', label: 'NCERT Geo XI Part 2' },
        { value: 'NCERT Geography Class 12', label: 'NCERT Geo XII' },
      ],
    },
  ],
  'pub-admin': [
    {
      group: 'Core Theory',
      books: [
        { value: 'IGNOU Public Administration Paper 1', label: 'IGNOU Pub Admin Paper I' },
        { value: 'IGNOU Public Administration Paper 2', label: 'IGNOU Pub Admin Paper II' },
        { value: 'Avasthi & Maheshwari — Public Administration', label: 'Avasthi & Maheshwari' },
        { value: 'Mohit Bhattacharya — New Horizons of Public Administration', label: 'Mohit Bhattacharya' },
      ],
    },
    {
      group: 'Indian Administration',
      books: [
        { value: 'Arora & Goyal — Indian Public Administration', label: 'Arora & Goyal — Indian PA' },
        { value: 'Ramesh Arora — Indian Administration', label: 'Ramesh Arora — Indian Administration' },
      ],
    },
  ],
};

// ── Known safe thinker–argument pairs for system prompt ─────
// Injected into the AI system prompt as guidance.
export const SUBJECT_THINKER_PAIRS: Record<SubjectKey, string> = {
  sociology: `
SOCIOLOGY THINKERS — KNOWN SAFE ARGUMENT PAIRS:
- Durkheim → social facts, division of labour, anomie, suicide types (egoistic/altruistic/anomic/fatalistic), elementary forms of religion, collective conscience
- Weber → social action types, ideal type, protestant ethic & capitalism, bureaucracy, verstehen, class/status/party
- Marx → historical materialism, modes of production, class conflict, alienation, base-superstructure, surplus value
- Parsons → AGIL schema, pattern variables, social system, structural functionalism, sick role
- Merton → manifest/latent functions, dysfunction, deviance (strain theory), middle range theory, reference group
- Giddens → structuration theory, duality of structure, modernity, reflexivity, third way
- Simmel → formal sociology, dyad/triad, stranger, metropolis, conflict as association
- Cooley → looking glass self, primary groups, social self
- Mead → I and me, significant symbol, role-taking, generalised other
- Srinivas → Sanskritisation, dominant caste, Westernisation, village studies
- Beteille → caste in changing India, inequality, backward classes
- Ambedkar → annihilation of caste, Dalit identity, constitutional vision
- Bourdieu → habitus, field, cultural capital, social reproduction
- Foucault → power/knowledge, discourse, surveillance, governmentality
`,
  anthropology: `
ANTHROPOLOGY THINKERS — KNOWN SAFE ARGUMENT PAIRS:
- Morgan → unilinear evolution, savagery/barbarism/civilisation, classificatory kinship
- Tyler → animism, minimum definition of religion, survivals, culture as complex whole
- Boas → historical particularism, cultural relativism, critique of evolutionism, four-field approach
- Malinowski → functionalism, need theory, reciprocity, fieldwork method, kula ring
- Radcliffe-Brown → structural-functionalism, social structure, jural rules, joking relationship
- Lévi-Strauss → structuralism, binary oppositions, myth analysis, nature/culture, elementary structures of kinship
- Evans-Pritchard → Azande witchcraft, Nuer segmentary lineage, critique of Frazer/Lévi-Strauss
- Mead → culture and personality, adolescence in Samoa, critique of biological determinism
- Benedict → patterns of culture, Apollonian vs Dionysian, culture as personality
- Geertz → interpretive anthropology, thick description, culture as text, cockfight study
- Elwin → tribal policy, friend of tribes, NEFA administration
- Xaxa → scheduled tribe policy, identity politics, forest rights
`,
  polsci: `
POLITICAL SCIENCE THINKERS — KNOWN SAFE ARGUMENT PAIRS:
- Aristotle → Politics, classification of constitutions, citizenship, distributive justice
- Plato → philosopher king, allegory of the cave, ideal state
- Hobbes → Leviathan, state of nature (war of all against all), social contract, sovereignty
- Locke → natural rights (life/liberty/property), consent, right to revolution, limited government
- Rousseau → general will, social contract, direct democracy, inequality origin
- Mill → liberty (harm principle), representative government, utilitarianism, plural voting
- Rawls → veil of ignorance, difference principle, justice as fairness, original position
- Gramsci → hegemony, civil society, organic intellectual, war of position
- Morgenthau → political realism, six principles, national interest, power
- Waltz → neorealism, structural anarchy, three images, balance of power
- Dahl → polyarchy, pluralism, who governs, democratic elitism critique
- Huntington → clash of civilisations, third wave of democracy, political order
- Keohane → complex interdependence, neoliberal institutionalism
- Ambedkar → constitutional democracy, annihilation of caste, minority rights
`,
  geography: `
GEOGRAPHY THINKERS — KNOWN SAFE ARGUMENT PAIRS:
- Davis → geographical cycle (erosion cycle), stages (youth/maturity/old age), peneplain
- Penck → piedmont staircase, endogenetic vs exogenetic forces, inselberg landscape
- Thornbury → geomorphic concepts, climate geomorphology
- Strahler → quantitative geomorphology, stream order, drainage basin analysis
- Koppen → climate classification (A/B/C/D/E), thermal zones
- Trewartha → modified Koppen classification
- Sauer → cultural landscape, sequent occupance, morphology of landscape
- Harvey → positivism to Marxism in geography, social justice and the city
- Christaller → central place theory, hexagonal hinterlands, k-values (3/4/7)
- Von Thunen → isolated state model, concentric zones, land rent theory
- Weber → least cost theory of industrial location, agglomeration
- Hartshorne → areal differentiation, chorological concept of geography
- Mackinder → heartland theory, geographical pivot
- Savindra Singh → standard text for Indian Geography UPSC
- Majid Husain → UPSC standard reference, geography of India and world
`,
  'pub-admin': `
PUBLIC ADMINISTRATION THINKERS — KNOWN SAFE ARGUMENT PAIRS:
- Wilson → politics-administration dichotomy, study of administration (1887)
- Taylor → scientific management, time-motion study, functional foremanship, differential piece rate
- Fayol → 14 principles of management, unity of command, scalar chain, esprit de corps
- Weber → ideal type bureaucracy, legal-rational authority, hierarchy, impersonality
- Simon → administrative behaviour, bounded rationality, satisficing, decision-making, POSDCORB critique
- Barnard → executive functions, zone of indifference, formal/informal organisations
- Maslow → hierarchy of needs (physiological to self-actualisation)
- McGregor → Theory X and Theory Y, human potential
- Herzberg → two-factor theory (hygiene + motivators), job enrichment
- Waldo → politics-administration continuum, democratic administration
- Riggs → prismatic society, sala model, refracted model, developing nations admin
- Drucker → management by objectives (MBO), knowledge worker
- Follett → integration, constructive conflict, power with not power over
- Appleby → policy and administration link, administration as political
`,
};