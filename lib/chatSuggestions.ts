import type { SubjectKey } from './subjectConfig';

/**
 * The questions the chat input suggests as its placeholder. Esc (or the key
 * hint beside it) puts the suggestion into the input, and a new one is drawn
 * each time the input starts empty again, so the placeholder doubles as a
 * stream of things worth asking.
 *
 * Each is a real Mains-style line of inquiry, spread across both papers, and
 * short enough to read at a glance in the input.
 */
const LISTS: Record<SubjectKey, { en: string[]; hi: string[] }> = {
  sociology: {
    en: [
      'What did Durkheim mean by anomie?',
      "How does Weber's ideal type work as a method?",
      "Is Marx's theory of class still relevant?",
      'How did Srinivas explain Sanskritisation?',
      'How is positivism different from interpretivism?',
      'Why did Parsons build the AGIL scheme?',
      'How has caste changed since independence?',
      "What are Merton's manifest and latent functions?",
      'Is the joint family really in decline?',
      "How does Giddens' structuration bridge agency and structure?",
      'What makes something a social fact, for Durkheim?',
      'What did Ambedkar argue about the annihilation of caste?',
      'How has globalisation changed Indian villages?',
      'How do new social movements differ from the old ones?',
      "What is Mead's distinction between the I and the me?",
      'How does Weber link Protestantism to capitalism?',
      'Is secularisation a universal trend?',
      'What did Ghurye see as the features of caste?',
    ],
    hi: [
      'दुर्खीम की एनोमी की अवधारणा क्या है?',
      'वेबर का आदर्श प्रारूप पद्धति के रूप में कैसे काम करता है?',
      'क्या मार्क्स का वर्ग सिद्धांत आज भी प्रासंगिक है?',
      'श्रीनिवास ने संस्कृतीकरण को कैसे समझाया?',
      'स्वतंत्रता के बाद जाति व्यवस्था कैसे बदली?',
      'मर्टन के प्रकट और अप्रकट प्रकार्य क्या हैं?',
      'क्या संयुक्त परिवार सचमुच टूट रहा है?',
      'वैश्वीकरण ने भारतीय गाँवों को कैसे बदला है?',
      'नए सामाजिक आंदोलन पुराने आंदोलनों से कैसे अलग हैं?',
      'वेबर ने प्रोटेस्टेंट नीति को पूँजीवाद से कैसे जोड़ा?',
    ],
  },
  anthropology: {
    en: [
      'How is social anthropology different from cultural anthropology?',
      "What did Malinowski's fieldwork change in anthropology?",
      'How does Lévi-Strauss explain kinship through alliance?',
      'What makes Homo erectus a turning point in evolution?',
      'Is cultural relativism defensible?',
      'How did the Neolithic revolution change human life?',
      'How is descent theory different from alliance theory?',
      'How did Radcliffe-Brown define social structure?',
      'Why are tribes in India displaced by development?',
      'What did Verrier Elwin argue about tribal policy?',
      'How does natural selection act on human populations?',
      'What is the significance of the Hardy-Weinberg law?',
      "How do Ruth Benedict's patterns of culture work?",
      'What is the potlatch, and why does it matter?',
      'How did Indian anthropologists study the village?',
      'What protection does the Fifth Schedule give tribes?',
      'How is race different from ethnicity in anthropology?',
      'What is the fossil evidence for Australopithecus?',
    ],
    hi: [
      'सामाजिक और सांस्कृतिक नृविज्ञान में क्या अंतर है?',
      'मालिनोव्स्की के क्षेत्रकार्य ने नृविज्ञान को कैसे बदला?',
      'लेवी-स्ट्रॉस नातेदारी को कैसे समझाते हैं?',
      'क्या सांस्कृतिक सापेक्षवाद उचित है?',
      'नवपाषाण क्रांति ने मानव जीवन को कैसे बदला?',
      'विकास परियोजनाओं से जनजातियाँ विस्थापित क्यों होती हैं?',
      'वेरियर एल्विन की जनजातीय नीति क्या थी?',
      'हार्डी-वाइनबर्ग नियम का क्या महत्व है?',
      'पाँचवीं अनुसूची जनजातियों की कैसे रक्षा करती है?',
      'ऑस्ट्रेलोपिथेकस के जीवाश्म साक्ष्य क्या हैं?',
    ],
  },
  polsci: {
    en: [
      'How does Rawls justify the difference principle?',
      'What did Machiavelli mean by virtù?',
      'Is realism still useful in international relations?',
      'How is Indian federalism both cooperative and competitive?',
      'What did Gandhi mean by swaraj?',
      "How is Gramsci's hegemony different from domination?",
      'How has non-alignment changed since the Cold War?',
      'What is the basic structure doctrine?',
      'How does liberalism view the state?',
      'Does the UN Security Council need reform?',
      "What drives India's Act East policy?",
      'How did Ambedkar shape the Indian Constitution?',
      'How is positive liberty different from negative liberty?',
      'How have coalition governments changed Indian politics?',
      'What did Hobbes mean by the state of nature?',
      'How does neoliberal institutionalism explain cooperation?',
      'Why does the India–China rivalry persist?',
      'What role does the Election Commission play in democracy?',
    ],
    hi: [
      'रॉल्स भिन्नता के सिद्धांत को कैसे उचित ठहराते हैं?',
      'क्या अंतरराष्ट्रीय संबंधों में यथार्थवाद आज भी उपयोगी है?',
      'भारतीय संघवाद सहकारी और प्रतिस्पर्धी कैसे है?',
      'गांधी के स्वराज का क्या अर्थ था?',
      'ग्राम्शी का आधिपत्य प्रभुत्व से कैसे अलग है?',
      'शीत युद्ध के बाद गुटनिरपेक्षता कैसे बदली?',
      'मूल ढाँचे का सिद्धांत क्या है?',
      'क्या संयुक्त राष्ट्र सुरक्षा परिषद में सुधार ज़रूरी है?',
      'सकारात्मक और नकारात्मक स्वतंत्रता में क्या अंतर है?',
      'हॉब्स की प्राकृतिक अवस्था का क्या अर्थ है?',
    ],
  },
  geography: {
    en: [
      'How did Davis explain the cycle of erosion?',
      'What causes the Indian monsoon?',
      'How does plate tectonics explain mountain building?',
      'Why are coral reefs under threat?',
      'What did Ratzel mean by Lebensraum?',
      "How does Christaller's central place theory work?",
      'How is determinism different from possibilism?',
      'Why is the Himalaya still rising?',
      'How do jet streams affect the monsoon?',
      'What drives urbanisation in India?',
      'How does the demographic transition model fit India?',
      "Why are India's river-linking plans debated?",
      'What explains where iron and steel plants are built?',
      'How does El Niño affect Indian rainfall?',
      'What was the quantitative revolution in geography?',
      "How do Köppen's climate types work?",
      'Why is the Chota Nagpur plateau so rich in minerals?',
      'What causes regional disparity in India?',
    ],
    hi: [
      'डेविस ने अपरदन चक्र को कैसे समझाया?',
      'भारतीय मानसून का कारण क्या है?',
      'प्लेट विवर्तनिकी पर्वत निर्माण को कैसे समझाती है?',
      'प्रवाल भित्तियाँ ख़तरे में क्यों हैं?',
      'नियतिवाद और संभववाद में क्या अंतर है?',
      'हिमालय आज भी ऊँचा क्यों हो रहा है?',
      'भारत में नगरीकरण के क्या कारण हैं?',
      'एल नीनो भारतीय वर्षा को कैसे प्रभावित करता है?',
      'क्रिस्टालर का केंद्रीय स्थान सिद्धांत कैसे काम करता है?',
      'भारत में क्षेत्रीय असमानता के क्या कारण हैं?',
    ],
  },
  'pub-admin': {
    en: [
      'What did Wilson mean by the politics-administration dichotomy?',
      'How did Weber describe bureaucracy?',
      'Is New Public Management still relevant?',
      'What did Simon mean by bounded rationality?',
      "How does Riggs' prismatic model explain developing societies?",
      'How is New Public Management different from good governance?',
      'How did the Hawthorne studies change management thinking?',
      "What does Maslow's hierarchy say about motivation?",
      'Why does India need civil service reform?',
      'How does the CAG hold the executive to account?',
      'What is the role of the PMO in Indian administration?',
      'How has the 73rd Amendment changed local government?',
      "What did Taylor's scientific management promise?",
      'How did Mary Parker Follett view conflict?',
      'What is the New Public Service?',
      'Why is the district collector central to administration?',
      'How does the RTI Act strengthen accountability?',
      'What is participatory budgeting?',
    ],
    hi: [
      'विल्सन के राजनीति-प्रशासन द्विभाजन का क्या अर्थ है?',
      'वेबर ने नौकरशाही का वर्णन कैसे किया?',
      'क्या नवीन लोक प्रबंधन आज भी प्रासंगिक है?',
      'साइमन की सीमित तर्कसंगतता का क्या अर्थ है?',
      'रिग्स का प्रिज़्मैटिक मॉडल विकासशील समाजों को कैसे समझाता है?',
      'हॉथॉर्न अध्ययनों ने प्रबंधन को कैसे बदला?',
      'भारत में सिविल सेवा सुधार क्यों ज़रूरी है?',
      'CAG कार्यपालिका को उत्तरदायी कैसे बनाता है?',
      '73वें संशोधन ने स्थानीय शासन को कैसे बदला?',
      'RTI अधिनियम जवाबदेही को कैसे मज़बूत करता है?',
    ],
  },
};

export function suggestions(subject: SubjectKey, langHi: boolean): string[] {
  const list = LISTS[subject] ?? LISTS.sociology;
  return langHi ? list.hi : list.en;
}

/** A random index other than `prev`, so the suggestion always changes. */
export function nextSuggestion(prev: number, count: number): number {
  if (count <= 1) return 0;
  const n = Math.floor(Math.random() * (count - 1));
  return n >= prev ? n + 1 : n;
}

/**
 * A suggestion split into what a reader sees as characters, so the typing
 * effect never shows half a Devanagari cluster (a consonant waiting for its
 * vowel sign). Falls back to code points where Intl.Segmenter is missing.
 */
export function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (g) => g.segment);
  return Array.from(text);
}

/**
 * Tidies a model's follow-up question into one line the input can show, or
 * returns null when what came back is not a usable question. Models add
 * numbering, quotes and "Question:" labels however firmly they are told not
 * to, and a suggestion that is not a question is worse than none.
 */
export function cleanSuggestion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const line = raw.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const q = line
    .replace(/^(?:\d+[.)]|[-*•])\s*/, '')
    .replace(/^(?:follow[- ]?up|next|suggested)?\s*question\s*[:\-–—]\s*/i, '')
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (q.length < 10 || q.length > 140) return null;
  if (!/[?？]$/.test(q)) return null;
  return q;
}
