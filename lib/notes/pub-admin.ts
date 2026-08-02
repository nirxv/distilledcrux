export type PubAdminNote = {
  slug: string;
  title: string;
  paper: 1 | 2;
  section: string;
  topic: number;
  subtopics?: string[];
  description: string;
};

// ── Paper I — Administrative Theory ──────────────────────────

export const paper1Notes: PubAdminNote[] = [
  {
    slug: 'introduction-public-administration',
    title: 'Introduction to Public Administration',
    paper: 1,
    section: 'Administrative Theory',
    topic: 1,
    description: 'Meaning, scope and significance of public administration; Wilson\'s vision; public and private administration; evolution of the discipline; New Public Administration',
    subtopics: ['Meaning & Scope', 'Wilson\'s Vision', 'Public vs Private Administration', 'Evolution of the Discipline', 'New Public Administration'],
  },
  {
    slug: 'theories-of-organisation',
    title: 'Theories of Organisation',
    paper: 1,
    section: 'Administrative Theory',
    topic: 2,
    description: 'Classical theory — Weber\'s bureaucracy, Taylor\'s scientific management, Fayol\'s principles; human relations school — Elton Mayo; behavioural approach — Simon; systems approach; contingency theory',
    subtopics: ['Weber\'s Bureaucracy', 'Taylor\'s Scientific Management', 'Fayol\'s Principles', 'Human Relations School (Elton Mayo)', 'Behavioural Approach (Simon)', 'Systems & Contingency Approach'],
  },
  {
    slug: 'administrative-behaviour',
    title: 'Administrative Behaviour',
    paper: 1,
    section: 'Administrative Theory',
    topic: 3,
    description: 'Process and means of decision making; Simon\'s bounded rationality; communication in organisations; morale and motivation — Maslow, Herzberg, McGregor; leadership theories',
    subtopics: ['Decision Making Process', 'Simon\'s Bounded Rationality', 'Communication in Organisations', 'Motivation Theories (Maslow, Herzberg, McGregor)', 'Leadership Theories'],
  },
  {
    slug: 'accountability-control',
    title: 'Accountability and Control',
    paper: 1,
    section: 'Administrative Theory',
    topic: 4,
    description: 'Concepts of accountability and control; legislative, executive and judicial control; citizen and administration; civil society and accountability; RTI as tool of accountability',
    subtopics: ['Concepts of Accountability & Control', 'Legislative Control', 'Executive Control', 'Judicial Control', 'Citizen & Administration', 'RTI & Accountability'],
  },
  {
    slug: 'administrative-law',
    title: 'Administrative Law',
    paper: 1,
    section: 'Administrative Theory',
    topic: 5,
    description: 'Meaning and scope of administrative law; delegated legislation; administrative tribunals; principles of natural justice; judicial review of administrative actions',
    subtopics: ['Meaning & Scope', 'Delegated Legislation', 'Administrative Tribunals', 'Natural Justice', 'Judicial Review'],
  },
  {
    slug: 'comparative-public-administration',
    title: 'Comparative Public Administration',
    paper: 1,
    section: 'Administrative Theory',
    topic: 6,
    description: 'Historical and sociological factors; Riggs\' ecological approach — prismatic society; bureaucracy and development; strong state vs market debate; democratic decentralisation',
    subtopics: ['Riggs\' Ecological Approach', 'Prismatic-Sala Model', 'Bureaucracy & Development', 'Strong State vs Market', 'Democratic Decentralisation'],
  },
  {
    slug: 'development-dynamics',
    title: 'Development Dynamics',
    paper: 1,
    section: 'Administrative Theory',
    topic: 7,
    description: 'Concept of development; changing profile of development administration; anti-development thesis; bureaucracy and development; participative development; new development paradigm',
    subtopics: ['Concept of Development', 'Development Administration', 'Anti-Development Thesis', 'Participative Development', 'New Development Paradigm'],
  },
  {
    slug: 'personnel-administration',
    title: 'Personnel Administration',
    paper: 1,
    section: 'Administrative Theory',
    topic: 8,
    description: 'Importance of human resource development; recruitment, training and career advancement; position classification; service classifications; pay commissions; morale and motivation; integrity management',
    subtopics: ['Human Resource Development', 'Recruitment & Training', 'Career Advancement & Position Classification', 'Pay Commissions', 'Morale & Motivation', 'Integrity Management'],
  },
  {
    slug: 'financial-administration',
    title: 'Financial Administration',
    paper: 1,
    section: 'Administrative Theory',
    topic: 9,
    description: 'Monetary and fiscal policies; public budget and its types; budgetary process; financial accountability; accounts and audit; role of Finance Ministry and CAG',
    subtopics: ['Monetary & Fiscal Policy', 'Types of Budget', 'Budgetary Process', 'Financial Accountability', 'Accounts & Audit', 'Role of Finance Ministry & CAG'],
  },
  {
    slug: 'new-public-management',
    title: 'New Public Management',
    paper: 1,
    section: 'Administrative Theory',
    topic: 10,
    description: 'Governance and good governance; new public management paradigm; e-governance; citizens\' charter; entrepreneurial government; performance management; public-private partnerships',
    subtopics: ['Governance & Good Governance', 'NPM Paradigm', 'E-Governance', 'Citizens\' Charter', 'Performance Management', 'Public-Private Partnerships'],
  },
];

// ── Paper II — Indian Administration ─────────────────────────

export const paper2Notes: PubAdminNote[] = [
  {
    slug: 'evolution-indian-administration',
    title: 'Evolution of Indian Administration',
    paper: 2,
    section: 'Indian Administration',
    topic: 1,
    description: 'Legacy of British administration; Kautilyan tradition; post-independence administrative development; major recommendations of administrative reform commissions',
    subtopics: ['Kautilyan Administrative Tradition', 'British Administrative Legacy', 'Post-Independence Development', 'Administrative Reform Commissions'],
  },
  {
    slug: 'constitutional-framework-administration',
    title: 'Constitutional Framework of Indian Administration',
    paper: 2,
    section: 'Indian Administration',
    topic: 2,
    description: 'Constitutional provisions; parliamentary vs presidential system; federal features; distribution of legislative, executive and financial powers; emergency provisions',
    subtopics: ['Parliamentary System in India', 'Federal Features', 'Legislative Powers Distribution', 'Executive Powers Distribution', 'Financial Powers Distribution', 'Emergency Provisions'],
  },
  {
    slug: 'union-government-administration',
    title: 'Union Government and Administration',
    paper: 2,
    section: 'Indian Administration',
    topic: 3,
    description: 'President and Vice-President; Prime Minister and Council of Ministers; Cabinet Secretariat; Central Secretariat; Ministry system; types of government departments',
    subtopics: ['President & Vice-President', 'Prime Minister & Council of Ministers', 'Cabinet Secretariat', 'Central Secretariat', 'Ministry System'],
  },
  {
    slug: 'plans-priorities-administration',
    title: 'Plans and Priorities in Indian Administration',
    paper: 2,
    section: 'Indian Administration',
    topic: 4,
    description: 'Planning Commission and NITI Aayog; five-year plans; rolling plan; development philosophy; NITI Aayog\'s vision documents; cooperative federalism',
    subtopics: ['Planning Commission vs NITI Aayog', 'Five-Year Planning', 'Development Philosophy', 'Cooperative Federalism', 'NITI Aayog Vision Documents'],
  },
  {
    slug: 'state-government-administration',
    title: 'State Government and Administration',
    paper: 2,
    section: 'Indian Administration',
    topic: 5,
    description: 'Governor; Chief Minister; Council of Ministers; Chief Secretary; State Secretariat; Directorates; relationship between state and union administration',
    subtopics: ['Governor & Constitutional Role', 'Chief Minister & Council', 'Chief Secretary', 'State Secretariat & Directorates', 'Union-State Administrative Relations'],
  },
  {
    slug: 'district-administration',
    title: 'District Administration in India',
    paper: 2,
    section: 'Indian Administration',
    topic: 6,
    description: 'Role and importance of district administration; Collector and District Magistrate; changing role of DM; field administration; co-ordination issues',
    subtopics: ['Collector & District Magistrate', 'Changing Role of DM', 'Field Administration', 'Co-ordination Issues', 'District Planning'],
  },
  {
    slug: 'civil-services-india',
    title: 'Civil Services in India',
    paper: 2,
    section: 'Indian Administration',
    topic: 7,
    description: 'Constitutional provisions; all-India services; central services; state services; UPSC and state PSCs; training of civil servants; reforms in civil services; lateral entry',
    subtopics: ['Constitutional Provisions', 'All-India Services (IAS, IPS, IFS)', 'Central Services', 'UPSC & State PSCs', 'Training of Civil Servants', 'Civil Services Reforms & Lateral Entry'],
  },
  {
    slug: 'local-government-india',
    title: 'Local Government in India',
    paper: 2,
    section: 'Indian Administration',
    topic: 8,
    description: '73rd and 74th Constitutional Amendments; Panchayati Raj institutions; urban local bodies; devolution of powers and functions; financial resources; State Finance Commission',
    subtopics: ['73rd Amendment & Panchayati Raj', '74th Amendment & Urban Local Bodies', 'Devolution of Powers & Functions', 'Financial Resources', 'State Finance Commission'],
  },
  {
    slug: 'law-order-anti-corruption',
    title: 'Law and Order, Anti-Corruption Measures',
    paper: 2,
    section: 'Indian Administration',
    topic: 9,
    description: 'Law and order administration; police administration; prisons; anti-corruption machinery — CBI, CVC, Lokpal, Lokayukta; vigilance administration',
    subtopics: ['Law & Order Administration', 'Police Administration', 'CBI & CVC', 'Lokpal & Lokayukta', 'Vigilance Administration'],
  },
  {
    slug: 'welfare-administration',
    title: 'Welfare Administration in India',
    paper: 2,
    section: 'Indian Administration',
    topic: 10,
    description: 'Constitutional provisions for welfare; social welfare administration; tribal welfare; women welfare; backward classes welfare; welfare of differently abled; food security administration',
    subtopics: ['Constitutional Provisions for Welfare', 'Social Welfare Administration', 'Tribal Welfare Programs', 'Women Welfare Schemes', 'Backward Classes Welfare', 'Food Security Administration'],
  },
  {
    slug: 'administrative-reforms-india',
    title: 'Administrative Reforms in India',
    paper: 2,
    section: 'Indian Administration',
    topic: 11,
    description: 'Major administrative reform committees; second ARC recommendations; e-governance initiatives; Right to Public Services Acts; grievance redressal mechanisms; outcome budgeting',
    subtopics: ['Major Reform Committees', 'Second ARC Recommendations', 'E-Governance Initiatives', 'Right to Public Services', 'Grievance Redressal', 'Outcome Budgeting'],
  },
  {
    slug: 'rural-development-administration',
    title: 'Rural Development Administration',
    paper: 2,
    section: 'Indian Administration',
    topic: 12,
    description: 'Development programmes — MGNREGS, PMAY, PMGSY; community development; role of NGOs; SHGs and microfinance; decentralised planning; DMIC and rural transformation',
    subtopics: ['MGNREGS', 'PMAY & PMGSY', 'Community Development', 'Role of NGOs', 'SHGs & Microfinance', 'Decentralised Planning'],
  },
];

export const allNotes: PubAdminNote[] = [...paper1Notes, ...paper2Notes];

export const getNoteBySlug = (slug: string): PubAdminNote | undefined =>
  allNotes.find(n => n.slug === slug);

export const paper1Sections = [
  'Administrative Theory',
];

export const paper2Sections = [
  'Indian Administration',
];
