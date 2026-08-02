export type GeoNote = {
  slug: string;
  title: string;
  paper: 1 | 2;
  section: string;
  topic: number;
  subtopics?: string[];
  description: string;
};

// ── Paper I — Physical & Human Geography ─────────────────────

export const paper1Notes: GeoNote[] = [
  {
    slug: 'geomorphology-fundamentals',
    title: 'Geomorphology: Fundamentals',
    paper: 1,
    section: 'Physical Geography',
    topic: 1,
    description: 'Factors controlling landform development; endogenetic and exogenetic forces; origin and evolution of the earth\'s crust; theories of continental drift and plate tectonics',
    subtopics: ['Endogenetic & Exogenetic Forces', 'Continental Drift Theory', 'Plate Tectonics', 'Ocean Floor Spreading', 'Isostasy'],
  },
  {
    slug: 'landforms-fluvial-arid-glacial',
    title: 'Landforms: Fluvial, Arid and Glacial',
    paper: 1,
    section: 'Physical Geography',
    topic: 2,
    description: 'Geomorphic processes and resulting landforms — fluvial cycle, arid cycle, glacial erosion and deposition; coastal landforms; karst topography',
    subtopics: ['Fluvial Landforms', 'Arid & Desert Landforms', 'Glacial Landforms', 'Coastal Landforms', 'Karst Topography'],
  },
  {
    slug: 'rocks-minerals-volcanoes',
    title: 'Rocks, Minerals and Volcanism',
    paper: 1,
    section: 'Physical Geography',
    topic: 3,
    description: 'Rock cycle; igneous, sedimentary and metamorphic rocks; earthquakes — types, distribution and measurement; volcanoes — types, distribution and associated landforms',
    subtopics: ['Rock Cycle', 'Igneous Rocks', 'Sedimentary Rocks', 'Metamorphic Rocks', 'Earthquakes', 'Volcanoes & Distribution'],
  },
  {
    slug: 'climatology-atmosphere',
    title: 'Climatology: Atmosphere and Energy',
    paper: 1,
    section: 'Physical Geography',
    topic: 4,
    description: 'Composition and structure of atmosphere; solar radiation and heat budget; temperature — horizontal and vertical distribution; inversion of temperature; atmospheric pressure and planetary winds',
    subtopics: ['Atmospheric Composition & Structure', 'Solar Radiation & Heat Budget', 'Temperature Distribution', 'Temperature Inversion', 'Atmospheric Pressure', 'Planetary Wind Systems'],
  },
  {
    slug: 'precipitation-humidity-clouds',
    title: 'Precipitation, Humidity and Clouds',
    paper: 1,
    section: 'Physical Geography',
    topic: 5,
    description: 'Evaporation, condensation and precipitation; types of rainfall; cyclones — tropical and temperate; air masses and fronts; ENSO, monsoon and jet streams',
    subtopics: ['Evaporation & Condensation', 'Types of Rainfall', 'Tropical Cyclones', 'Temperate Cyclones', 'Air Masses & Fronts', 'ENSO & Monsoon', 'Jet Streams'],
  },
  {
    slug: 'climate-classification-koppen',
    title: 'Climatic Classification',
    paper: 1,
    section: 'Physical Geography',
    topic: 6,
    description: 'World climatic types — Köppen\'s classification; Thornthwaite\'s classification; climate change and global warming; greenhouse effect; ozone depletion',
    subtopics: ['Köppen\'s Climatic Classification', 'Thornthwaite\'s Classification', 'World Climatic Regions', 'Climate Change & Global Warming', 'Greenhouse Effect', 'Ozone Depletion'],
  },
  {
    slug: 'oceanography',
    title: 'Oceanography',
    paper: 1,
    section: 'Physical Geography',
    topic: 7,
    description: 'Bottom topography of oceans; ocean temperature and salinity; ocean currents; tides and waves; coral reefs; continental shelf and marine resources',
    subtopics: ['Ocean Floor Topography', 'Ocean Temperature & Salinity', 'Ocean Currents', 'Tides & Waves', 'Coral Reefs', 'Continental Shelf', 'Marine Resources'],
  },
  {
    slug: 'biogeography-soils',
    title: 'Biogeography and Soil Geography',
    paper: 1,
    section: 'Physical Geography',
    topic: 8,
    description: 'Genesis and classification of soils; soil profile; world soil types; soil degradation and conservation; ecosystem concept; major biomes; biodiversity and conservation',
    subtopics: ['Soil Genesis & Classification', 'World Soil Types', 'Soil Degradation & Conservation', 'Ecosystem Concept', 'Major Biomes of the World', 'Biodiversity & Conservation'],
  },
  {
    slug: 'perspectives-human-geography',
    title: 'Perspectives in Human Geography',
    paper: 1,
    section: 'Human Geography',
    topic: 9,
    description: 'Areal differentiation; regional synthesis; dichotomy and dualism; environmentalism; quantitative revolution and locational analysis; behavioural, social welfare and radical approaches; language of geography',
    subtopics: ['Areal Differentiation & Regional Synthesis', 'Environmentalism', 'Quantitative Revolution', 'Behavioural Geography', 'Social Welfare Approach', 'Radical & Humanistic Geography'],
  },
  {
    slug: 'economic-geography',
    title: 'Economic Geography',
    paper: 1,
    section: 'Human Geography',
    topic: 10,
    description: 'World economic development — measurement and problems; world resources and their distribution; energy resources; mineral distribution; agriculture — world types and problems',
    subtopics: ['World Economic Development', 'World Resources & Distribution', 'Energy Resources', 'Mineral Resources', 'World Agricultural Types', 'Food Security & Problems'],
  },
  {
    slug: 'population-settlement-geography',
    title: 'Population and Settlement Geography',
    paper: 1,
    section: 'Human Geography',
    topic: 11,
    description: 'Population growth, distribution and density; demographic transition; migration — causes and consequences; population theories; rural settlements — types and patterns; urban settlements — morphology and functional classification',
    subtopics: ['Population Growth & Distribution', 'Demographic Transition Theory', 'Migration — Causes & Consequences', 'Population Theories', 'Rural Settlements', 'Urban Settlements & Morphology', 'Urbanization Trends'],
  },
  {
    slug: 'regional-planning',
    title: 'Regional Planning',
    paper: 1,
    section: 'Human Geography',
    topic: 12,
    description: 'Concept of a region; methods of regionalisation; growth centres and growth poles; regional imbalances; environment planning; rural-urban fringe; satellite towns',
    subtopics: ['Concept & Types of Region', 'Methods of Regionalisation', 'Growth Poles & Centres', 'Regional Imbalances', 'Rural-Urban Fringe', 'Satellite Towns'],
  },
  {
    slug: 'models-theories-geography',
    title: 'Models, Theories and Laws in Geography',
    paper: 1,
    section: 'Human Geography',
    topic: 13,
    description: 'System analysis; Malthusian, Marxian and demographic transition models; Central Place Theory (Christaller); Von Thünen\'s model; Weber\'s industrial location; Rostow\'s growth model; world system analysis',
    subtopics: ['System Analysis in Geography', 'Malthusian & Marxian Models', 'Demographic Transition Model', 'Central Place Theory (Christaller)', 'Von Thünen\'s Agricultural Location', 'Weber\'s Industrial Location', 'Rostow\'s Growth Model'],
  },
];

// ── Paper II — Geography of India ────────────────────────────

export const paper2Notes: GeoNote[] = [
  {
    slug: 'physical-setting-india',
    title: 'Physical Setting of India',
    paper: 2,
    section: 'Physical Geography of India',
    topic: 1,
    description: 'Space relationship of India with neighbouring countries; structure and relief; drainage systems; physiographic regions of India',
    subtopics: ['Space Relationship & Neighbours', 'Geological Structure', 'Relief Features', 'Drainage Systems of India', 'Physiographic Regions'],
  },
  {
    slug: 'climate-india',
    title: 'Climate of India',
    paper: 2,
    section: 'Physical Geography of India',
    topic: 2,
    description: 'Climatic conditions and variability; monsoon — origin, mechanism and variability; droughts and floods; climatic regions of India; climate change and its impact on India',
    subtopics: ['Monsoon — Origin & Mechanism', 'Monsoon Variability', 'Droughts & Floods in India', 'Climatic Regions of India', 'Climate Change Impact'],
  },
  {
    slug: 'soils-vegetation-india',
    title: 'Soils and Vegetation of India',
    paper: 2,
    section: 'Physical Geography of India',
    topic: 3,
    description: 'Soil types and their distribution; soil erosion and degradation; forest types and their distribution; wildlife and biodiversity conservation; environmental issues',
    subtopics: ['Soil Types & Distribution', 'Soil Erosion & Conservation', 'Forest Types & Distribution', 'Wildlife & Biodiversity', 'Environmental Issues in India'],
  },
  {
    slug: 'natural-hazards-disasters-india',
    title: 'Natural Hazards and Disasters in India',
    paper: 2,
    section: 'Physical Geography of India',
    topic: 4,
    description: 'Earthquake zones, flood-prone areas, drought-prone regions, cyclone tracks; vulnerability mapping; disaster management in India',
    subtopics: ['Earthquake Zones of India', 'Flood-Prone Regions', 'Drought-Prone Regions', 'Cyclone Tracks', 'Disaster Management'],
  },
  {
    slug: 'agriculture-india',
    title: 'Agriculture in India',
    paper: 2,
    section: 'Human Geography of India',
    topic: 5,
    description: 'Infrastructure — irrigation, seeds, fertilisers, power; institutional factors — land holdings, land tenure, land reforms; cropping pattern and agricultural productivity; Green Revolution and its impacts; agricultural problems and policies',
    subtopics: ['Irrigation & Agricultural Infrastructure', 'Land Holdings & Land Reforms', 'Cropping Patterns & Productivity', 'Green Revolution', 'Agricultural Problems & Policies', 'Food Security in India'],
  },
  {
    slug: 'industry-india',
    title: 'Industry in India',
    paper: 2,
    section: 'Human Geography of India',
    topic: 6,
    description: 'Evolution of industries; locational factors; distribution and growth of major industries — iron and steel, cotton textiles, fertilisers, chemicals, electronics; new industrial policy; industrial regions and corridors',
    subtopics: ['Locational Factors of Industries', 'Iron & Steel Industry', 'Cotton Textile Industry', 'Chemical & Fertiliser Industry', 'Electronics & IT Industry', 'Industrial Policy & Corridors'],
  },
  {
    slug: 'population-india',
    title: 'Population of India',
    paper: 2,
    section: 'Human Geography of India',
    topic: 7,
    description: 'Population growth and distribution; demographic characteristics; migration — internal and international; population problems and policy; scheduled castes and scheduled tribes; linguistic and religious diversity',
    subtopics: ['Population Growth & Distribution', 'Demographic Characteristics', 'Internal & International Migration', 'Population Policy', 'SC & ST Distribution', 'Linguistic & Religious Diversity'],
  },
  {
    slug: 'settlements-urbanization-india',
    title: 'Settlements and Urbanization in India',
    paper: 2,
    section: 'Human Geography of India',
    topic: 8,
    description: 'Types and distribution of rural settlements; urban growth; problems of urbanisation; million cities and metropolitan regions; smart cities; slums and urban poverty',
    subtopics: ['Rural Settlement Types', 'Urban Growth in India', 'Urbanisation Problems', 'Metropolitan Regions', 'Smart Cities Mission', 'Urban Poverty & Slums'],
  },
  {
    slug: 'regional-development-planning-india',
    title: 'Regional Development and Planning in India',
    paper: 2,
    section: 'Human Geography of India',
    topic: 9,
    description: 'Five-year plans and regional development; issues of regional imbalances; tribal areas and their development; hill area development; border area development',
    subtopics: ['Five-Year Plans & Regional Development', 'Regional Imbalances in India', 'Tribal Area Development', 'Hill Area Development', 'Border Area Development Programs'],
  },
  {
    slug: 'transport-trade-india',
    title: 'Transport, Communication and Trade in India',
    paper: 2,
    section: 'Human Geography of India',
    topic: 10,
    description: 'Road, railway, waterway and air networks; national highways; ports and their hinterlands; foreign trade — composition and direction; trade policy; special economic zones',
    subtopics: ['Road & Railway Networks', 'Waterways & Air Transport', 'Ports & Hinterlands', 'Foreign Trade — Composition & Direction', 'Trade Policy & SEZs'],
  },
  {
    slug: 'geographical-basis-indian-federalism',
    title: 'Geographical Basis of Indian Federalism',
    paper: 2,
    section: 'Human Geography of India',
    topic: 11,
    description: 'State reorganisation; emergence of new states; regional consciousness and inter-state issues; river water disputes; political geography of India',
    subtopics: ['State Reorganisation', 'Emergence of New States', 'Regional Consciousness', 'River Water Disputes', 'Political Geography of India'],
  },
  {
    slug: 'india-world-affairs',
    title: 'India and World Affairs',
    paper: 2,
    section: 'Human Geography of India',
    topic: 12,
    description: 'India\'s geostrategic position; maritime boundaries; Indian Ocean geopolitics; India\'s relations with neighbouring countries; nuclear geography; South-South cooperation',
    subtopics: ['Geostrategic Position of India', 'Maritime Boundaries & EEZ', 'Indian Ocean Geopolitics', 'Relations with Neighbours', 'Nuclear Geography', 'South-South Cooperation'],
  },
];

export const allNotes: GeoNote[] = [...paper1Notes, ...paper2Notes];

export const getNoteBySlug = (slug: string): GeoNote | undefined =>
  allNotes.find(n => n.slug === slug);

export const paper1Sections = [
  'Physical Geography',
  'Human Geography',
];

export const paper2Sections = [
  'Physical Geography of India',
  'Human Geography of India',
];
