import re

with open('lib/noteContent/sociology.ts', 'r') as f:
    text = f.read()

old = "  'colonial-rule-indian-society': '',"
new = "  'colonial-rule-indian-society': `\n<h2>Introduction — The Colonial Encounter and Its Sociological Significance</h2>

<p>The impact of British colonial rule on Indian society is one of the most extensively debated subjects in Indian sociology and history. Unlike other forms of foreign rule India had experienced (Mughal, Turkish, etc.), British colonialism was distinct in scale, depth, and the nature of its transformations. It brought fundamental changes to India's economic structures, caste hierarchy, religious practices, political consciousness, and cultural self-understanding — changes that shaped Indian society long after independence.</p>

<p>Sociologists have debated the colonial impact along two broad axes: was colonialism primarily a modernising force that dismantled oppressive traditional structures (as colonial apologists and some nationalists argued), or was it primarily a mode of exploitation that drained India's wealth and systematically underdeveloped its society (as nationalist economists and Marxists argued)? Most contemporary sociologists recognise both dimensions and emphasise their interaction.</p>

<h2>Economic Impact of Colonial Rule</h2>

<h3>A. Drain of Wealth</h3>
<p>The concept of the "drain of wealth" was first systematically articulated by <strong>Dadabhai Naoroji</strong> in his 1901 work <em>Poverty and Un-British Rule in India</em>. Naoroji demonstrated that colonial rule involved a net transfer of economic resources — in the form of home charges (payments by India to Britain for the administrative costs of colonial rule), profits remitted by British companies, salaries and pensions of British officials, and interest on railway loans — from India to Britain without any equivalent return.</p>

<p>RC Dutt (<em>Economic History of India</em>) and Romesh Chandra Majumdar similarly documented how high land taxes and preferential trade policies transferred Indian surplus to Britain. Nationalist economists estimated that about one-third of Indian government revenue was remitted to Britain annually. MK Gandhi called this drain "the root cause of India's poverty." Contemporary economists like Utsa Patnaik have estimated the colonial drain at approximately $45 trillion between 1765 and 1938.</p>

<h3>B. Deindustrialisation</h3>
<p>Pre-colonial India was a significant global manufacturer — particularly of cotton textiles (Dhaka muslin, Madras cloth, Bengal silk) and metalwork. The colonial encounter systematically destroyed these industries through two mechanisms:</p>

<ul>
  <li><strong>Discriminatory tariffs</strong> — Indian goods exported to Britain were heavily taxed (70–80% duty on Indian textiles) while British machine-made goods entered India duty-free or at very low rates. Indian handloom industries could not compete with cheap, machine-made Lancashire textiles.</li>
  <li><strong>Administrative policies</strong> — India was converted from a manufacturing and exporting economy into a supplier of raw materials (cotton, jute, indigo, opium) and a captive market for British manufactured goods.</li>
</ul>

<p>The result was massive deindustrialisation: weavers, potters, metalworkers, and craftsmen lost their livelihoods and were pushed into agriculture, creating agrarian overpopulation and downward pressure on agricultural wages. The famous observation of the Select Committee on Indian Affairs (1840) captures this: "The bones of the cotton weavers are bleaching the plains of India."</p>

<h3>C. Land Revenue Systems and Agrarian Transformation</h3>
<p>Colonial land revenue systems fundamentally transformed agrarian social relations in India, creating new class hierarchies and deepening rural inequality. Three systems were introduced in different regions:</p>

<h4>1. Permanent Settlement (Zamindari System) — Bengal, Bihar, Orissa (1793)</h4>
<p>Introduced by Lord Cornwallis. The East India Company fixed the revenue demand permanently with a class of revenue intermediaries called <strong>zamindars</strong>, who were recognised as hereditary owners of the land in exchange for paying a fixed annual tax to the colonial state. The settlement was "permanent" for the zamindars — their tax was fixed — but it was not permanent for the peasants, who could be evicted if they failed to pay. Consequences:</p>
<ul>
  <li>Created a new class of absentee landlords with no obligation or interest in agricultural improvement.</li>
  <li>Reduced peasants from customary rights-holders to tenants-at-will.</li>
  <li>Zamindars were required to pay revenue even in years of bad harvest — creating enormous debt and peasant dispossession.</li>
  <li>Destroyed the traditional balance between overlapping rights of peasants, village communities, and regional rulers that had characterised Mughal agrarian relations.</li>
</ul>

<h4>2. Ryotwari System — Bombay, Madras, parts of Assam (early 19th century)</h4>
<p>Introduced by Munro and Elphinstone. The colonial state settled directly with the individual cultivator (<em>ryot</em>), bypassing zamindars. The ryot was recognised as the owner of land provided he paid revenue. Assessment was periodically revised, often upward, leading to heavy tax burdens. Consequences:</p>
<ul>
  <li>Removed the traditional village headman's role as revenue intermediary — atomised village society.</li>
  <li>Revenue assessed at 50–55% of the estimated gross produce — extremely high and often exceeded actual produce in bad years.</li>
  <li>Periodic reassessment meant ryots lived in perpetual insecurity about their future revenue burden.</li>
  <li>Indebtedness and distress sales drove land from cultivating peasants to moneylenders and merchants.</li>
</ul>

<h4>3. Mahalwari System — UP, Punjab, parts of Central India</h4>
<p>Introduced by Holt Mackenzie. Revenue settlement made with the village community (<em>mahal</em>) collectively, with joint responsibility for payment. Over time, practice shifted towards individual settlement. Consequences similar to ryotwari — high assessment, periodic revision, indebtedness, and dispossession.</p>

<h3>D. Commercialisation of Agriculture</h3>
<p>Colonial policies encouraged the replacement of subsistence crops with commercial cash crops — indigo, cotton, jute, opium, and later tea and coffee — for export. While this integrated India into global commodity markets, it had severe social consequences:</p>
<ul>
  <li>Peasants became dependent on market price fluctuations for crops they could not eat.</li>
  <li>The <strong>indigo system</strong> in Bengal and Bihar was particularly exploitative — planters advanced money to peasants who were then compelled to grow indigo at fixed low prices, often on their most fertile land.</li>
  <li>Food security declined — when export crop prices fell or monsoons failed, peasants who had shifted away from food crops faced acute hunger.</li>
  <li>Famines became more frequent and more severe under colonialism than in any preceding period (Great Bengal Famine 1770; Madras Famine 1876–78; Orissa Famine 1866; Bengal Famine 1943).</li>
</ul>

<h2>Social Background of Indian Nationalism</h2>

<h3>Emergence of Nationalism Under Colonial Rule</h3>
<p>One of the most significant — and paradoxical — consequences of colonial rule was the emergence of Indian nationalism. Nationalism as a political ideology did not exist in pre-colonial India, which was characterised by multiple kingdoms, regional identities, and communal loyalties without a pan-Indian political consciousness. Colonial rule created the conditions for this consciousness to emerge:</p>

<ul>
  <li><strong>Common subjugation</strong> — as Ramsay Muir observed, shared experience of exploitation created a sense of unity. David McCrone identified colonialism as a direct factor in the formation of nationalist sentiment in the Afro-Asian world. Colonial exploitation created a <em>common Indian nationality</em>.</li>
  <li><strong>English education</strong> — the Macaulayan system of English education (introduced 1835) produced an English-educated Indian middle class (<em>bhadralok</em> in Bengal, intelligentsia across India) capable of reading English liberal thought (Locke, Mill, Rousseau) and articulating demands for self-governance in the colonial state's own ideological language. Lord Macaulay's "Minute on Education" explicitly aimed to create "a class of persons Indian in blood and colour but English in tastes, opinions, morals and intellect" — what he did not anticipate was that this class would eventually turn the tools of Enlightenment liberalism against British rule.</li>
  <li><strong>Railways and communications</strong> — the colonial railway network and print media (especially the vernacular press from the 1870s) created the physical and communicative infrastructure that allowed nationalist ideas to circulate across India's vast territory, creating what Benedict Anderson called an <strong>"imagined community"</strong>.</li>
  <li><strong>Colonial bureaucracy</strong> — an all-India administrative structure with a single law code, uniform currency, and integrated market created the practical sense of India as one unit.</li>
  <li><strong>Racial discrimination</strong> — the systematic exclusion of Indians from senior administrative positions, clubs, hotels, and first-class train carriages provided a daily lived experience of colonial subordination that united Indians across caste, language, and regional boundaries in resentment.</li>
  <li><strong>Economic grievances</strong> — the drain of wealth, deindustrialisation, and recurring famines gave material substance to political opposition.</li>
</ul>

<h3>Phases of Indian Nationalism</h3>

<h4>1. Early Nationalism — Moderate Phase (1885–1905)</h4>
<p>The founding of the Indian National Congress (1885) by AO Hume. Led by Dadabhai Naoroji, Gopal Krishna Gokhale, Pherozeshah Mehta. Methods: petitions, memoranda, constitutional means. Demands: greater Indian participation in the ICS, legislative councils, reduction of home charges. Believed in working within the colonial system to reform it. Criticised as "mendicants" by later radicals.</p>

<h4>2. Extremist / Radical Nationalism (1905–1920)</h4>
<p>Led by Bal Gangadhar Tilak, Bipin Chandra Pal, and Lala Lajpat Rai (Lal-Bal-Pal). The Partition of Bengal (1905) galvanised mass opposition. Methods: swadeshi (use of Indian goods), boycott of British goods, national education, passive resistance. Tilak: "Swaraj is my birthright and I shall have it." Used Hindu religious symbols (Ganapati festivals, Shivaji festivals) to mobilise masses — but this also contained seeds of Hindu-Muslim tension.</p>

<h4>3. Gandhian Phase (1920–1947)</h4>
<p>Gandhi transformed the independence movement from elite-led constitutional agitation to a mass movement. Three key features:</p>
<ul>
  <li><strong>Satyagraha (truth force / soul force)</strong> — non-violent resistance as a moral and political weapon. Gandhi drew on Hindu concepts of <em>ahimsa</em> (non-violence), <em>tapasya</em> (self-suffering), and <em>brahmacharya</em> (self-discipline) — translating them into a political methodology. This is what Bhikhu Parekh calls the "modernisation of Indian tradition" — using traditional religious categories in a modern political context.</li>
  <li><strong>Mass mobilisation</strong> — for the first time, peasants, women, artisans, and the urban poor were brought into the political arena through campaigns like Non-Cooperation (1920–22), Civil Disobedience (1930–34), and Quit India (1942).</li>
  <li><strong>Constructive programme</strong> — khadi, village industries, Hindu-Muslim unity, removal of untouchability — Gandhi saw social reform and political independence as inseparable.</li>
</ul>

<p>Gandhi represented the most successful synthesis of Indian tradition and Western modernity — using the moral vocabulary of Hinduism and Jainism while employing modern techniques of mass organisation, media, and constitutional politics.</p>

<h3>Sociological Analysis of Nationalism</h3>

<p><strong>Ernest Gellner</strong> — nationalism is a political principle that holds that the national unit (nation) and political unit (state) should be congruent. Nation, nationalism, and nation-state are all modern concepts emerging from the late 18th century. Before industrialisation, human habitations were largely isolated — only when communication media spread did people identify others as totally distinct from themselves. The presence of "the other" (the colonial master) is a precondition for the rise of nationalism.</p>

<p><strong>Benedict Anderson</strong> — nations are "imagined communities" — the members will never know most of their fellow-members, yet in the minds of each lives the image of their communion. Print capitalism (newspapers, novels) was crucial in creating this shared imagining.</p>

<p><strong>Anthony Smith</strong> — nationalism is not necessarily a modern phenomenon. Many modern nations emerged from pre-existing ethnic communities (<em>ethnies</em>). Indian nationalism drew on pre-existing cultural and religious identities — Vedantic philosophy, Bhakti and Sufi traditions, and regional languages — as raw material for modern nationalist ideology.</p>

<p><strong>Hans Kohn</strong> — distinguished Western nationalism (arose as a rationale for already cohesive political systems, e.g. France, UK) from Eastern nationalism (arose as a rationale for the formation of new nation-states and adoption of new political systems, e.g. India, African nations). Indian nationalism was of the Eastern type — it sought to create a new political unit where one had not existed before in its modern form.</p>

<p><strong>Rabindranath Tagore</strong> — critiqued nationalism as placing the nation above society. Society does not have an ulterior purpose unlike the nation, which is founded on greed, jealousy, suspicion, and the desire for power. Nationalism is exclusionist and jingoistic — it takes away the freedom of individuals. Tagore feared that an independent India modelled on Western nationalism would reproduce the same exclusions and expansionism of European nation-states. His alternative was <em>manabdharma</em> — the religion of humanity.</p>

<h3>Colonial Protests and Movements</h3>
<p>The social background of nationalism included not only the elite nationalist movement but also a long history of popular protest and resistance:</p>

<ul>
  <li><strong>Tribal revolts</strong> — Santhal Hul (1855–56), Munda Ulgulan (Birsa Munda, 1899–1900), Rampa Rebellion (1879–80 in Andhra). Directed against colonial land revenue systems, forest laws, and money-lenders.</li>
  <li><strong>Peasant revolts</strong> — Indigo Revolt (Bengal, 1859–60), Deccan Riots (1875), Moplah Rebellion (1921). The Indigo Revolt was the first organised peasant resistance against colonial exploitation in India.</li>
  <li><strong>The Revolt of 1857</strong> — the most widespread armed challenge to British rule, involving sepoys, princes, landlords, and peasants. Colonial historiography called it the "Sepoy Mutiny"; nationalist historians like VD Savarkar called it the "First War of Indian Independence." Subaltern historians (Rudrangshu Mukherjee) have focused on the role of peasants and artisans whose livelihoods were being destroyed by colonial economic policies.</li>
  <li><strong>Swadeshi and boycott movements</strong> — the 1905 partition of Bengal triggered mass protests including bonfires of imported cloth, economic boycott of British goods, and the establishment of national educational institutions.</li>
</ul>

<h2>Modernisation of Indian Tradition</h2>

<h3>The Debate on Tradition and Modernity</h3>
<p>The colonial encounter forced Indian society to confront a stark question: which aspects of Indian tradition were worth preserving and which needed to be reformed or rejected? This produced one of the most significant intellectual debates in modern Indian history — between tradition and modernity, between religious authority and rational critique, between reform and revival.</p>

<p><strong>MN Srinivas</strong> and <strong>Yogendra Singh</strong> argue that Indian society's response to Western modernity was neither simple acceptance nor simple rejection, but a complex selective process of modernisation from within. Indian tradition was <em>modernised</em> — not simply replaced.</p>

<p><strong>Bhikhu Parekh</strong> identifies this process in Gandhi's thought: Gandhi used traditional concepts (ahimsa, satyagraha, swaraj) in modern political contexts, giving them new meanings while retaining their emotional and spiritual resonance with the Indian public. This was "modernisation of tradition" — not Westernisation.</p>

<p><strong>Satish Saberwal</strong> argues that Indian modernisation differed from Western modernisation in that it was a process imposed from outside rather than generated from within. Unlike Europe where modernity was a product of internal social transformations (capitalism, Reformation, Scientific Revolution), Indian modernity was partially imposed through colonial intervention and partially adopted by Indian reformers from below.</p>

<h3>Social Reform Movements — Reform vs. Revival</h3>
<p>The colonial period produced two broad responses in Indian society: <strong>reform movements</strong> that sought to eliminate social evils through rational critique and legal change, and <strong>revival movements</strong> that sought to restore a purified version of Indian tradition against Western cultural imperialism.</p>

<h4>Reform Movements</h4>

<p><strong>Brahmo Samaj (1828)</strong> — founded by <strong>Raja Ram Mohan Roy</strong>, the "Father of Modern India." Roy was the first Indian reformer to systematically engage with Western liberal philosophy and apply it to Indian social conditions. Key contributions:</p>
<ul>
  <li>Campaigned against <em>sati</em> (widow immolation) — led to the Sati Regulation Act (1829) banning the practice. This was the first major social reform achieved through colonial legislation.</li>
  <li>Advocated widow remarriage, women's education, and property rights for women.</li>
  <li>Monotheistic reform of Hinduism — rejected idol worship, caste hierarchy, and ritual.</li>
  <li>Founded the first modern vernacular newspapers in India.</li>
</ul>
<p>Roy's successors Debendranath Tagore and Keshub Chandra Sen developed the Brahmo Samaj further — Keshub Chandra Sen's Brahmo Samaj of India took it beyond Bengal and had an all-India impact. In response to the Brahmo Samaj, conservatives founded the <strong>Dharma Sabha</strong> to protect traditional practices.</p>

<p><strong>Prarthana Samaj (1867)</strong> — founded by Atmaram Pandurang in Bombay, inspired by the Brahmo Samaj but more firmly rooted in the Bhakti tradition. Justice MG Ranade and RG Bhandarkar were leading figures. Focused on upliftment of women and depressed classes within a Hindu framework.</p>

<p><strong>Aligarh Movement (1875)</strong> — Sir Syed Ahmad Khan founded the Muhammadan Anglo-Oriental College at Aligarh. Urged Muslims to adopt Western education and science, while maintaining Islamic faith. Argued that Muslims needed to modernise to participate in colonial administration and the emerging modern economy. His "Two-Nation Theory" (that Hindus and Muslims were two separate nations) laid the ideological groundwork for the Pakistan movement — a deeply controversial legacy.</p>

<p><strong>Jyotiba Phule and Satyashodhak Samaj (1873)</strong> — Phule was the first systematic thinker to challenge Brahmanical Hinduism from below, from the perspective of the <em>bahujan</em> (lower castes and untouchables). Key contributions:</p>
<ul>
  <li>Argued that the Brahmin's sacred authority rested on historical forgery and exploitation — challenged the divine sanction claimed for the caste system.</li>
  <li>Founded the first schools for girls (including girls from lower castes) in Maharashtra (1848) — well before the colonial government took interest.</li>
  <li>Satyashodhak Samaj ("Truth-Seeking Society") conducted marriages without Brahmin priests, in simple ceremonies — first systematic challenge to Brahmin ritual monopoly.</li>
  <li>His radical critique influenced BR Ambedkar's later anti-caste thought.</li>
</ul>

<p><strong>Ramakrishna Mission (1897)</strong> — founded by <strong>Swami Vivekananda</strong> after the death of his guru Sri Ramakrishna Paramhansa. Vivekananda synthesised Hindu Vedanta with modern humanitarian idealism:</p>
<ul>
  <li>Challenged the dichotomy between spirituality and social service — "daridra narayana seva" (service of God through service of the poor).</li>
  <li>Represented India's spiritual tradition at the World Parliament of Religions (Chicago, 1893) — his speech beginning "Sisters and Brothers of America" electrified the audience and established Indian Vedanta's global prestige.</li>
  <li>Combined pride in Hindu tradition with rational reform — used the colonial encounter to assert Indian civilisational superiority in the spiritual domain.</li>
  <li>Both Vivekananda and Gandhi emphasised character building as the foundation of national reconstruction.</li>
</ul>

<p><strong>Theosophical Society (1875)</strong> — founded by HP Blavatsky and Henry Steel Olcott in the USA, moved to Adyar, Madras in 1882. Annie Besant became its leading Indian figure. The Theosophical Society promoted interest in Eastern philosophy (Hinduism, Buddhism) and encouraged Indians to take pride in their own spiritual traditions — a form of "Orientalism from within."</p>

<h4>Revival Movements</h4>

<p><strong>Arya Samaj (1875)</strong> — founded by <strong>Swami Dayananda Saraswati</strong> in Bombay. Dayananda's slogan: "Back to the Vedas." Key features:</p>
<ul>
  <li>Rejected image worship, polytheism, caste hierarchy, and untouchability as later corruptions of "original" Vedic religion.</li>
  <li>Promoted women's education through a network of Arya schools (D.A.V. — Dayananda Anglo-Vedic — schools).</li>
  <li><em>Shuddhi</em> (purification) movement — reconverted Hindus who had converted to Islam or Christianity back to Hinduism. This generated communal tensions and provoked the <em>Tabligh</em> movement in response.</li>
  <li>Attacked the special privileges of Brahmins while arguing for a reformed, rational Hinduism based on Vedic authority rather than later texts (Puranas, Manusmriti).</li>
  <li>Particularly influential in Punjab and North India; shaped the identity politics of the Hindi-speaking belt.</li>
</ul>

<p><strong>Deoband Movement (1867)</strong> — founded by Maulana Qasim Nanautawi at Deoband (UP). An Islamic revivalist movement that sought to educate Muslims in orthodox Islamic theology independent of colonial patronage. Initially anti-colonial; later became divided between pan-Islamic and Indian nationalist tendencies. The Deoband madrassa system spread to become one of the largest networks of Islamic education in the world — and a significant influence on later Islamic movements including the Taliban.</p>

<p><strong>Sri Narayana Guru and SNDP Movement (Kerala)</strong> — Narayana Guru (1856–1928) challenged caste untouchability in Kerala through the founding of temples accessible to lower castes, the establishment of schools, and the SNDP (Sree Narayana Dharma Paripalana) Yogam (1903). His philosophy: "One caste, one religion, one God for man." He consecrated temples with the motto: "Not for one religion, one caste or one sect, but for the betterment of all."</p>

<h2>Social Reforms — Key Issues</h2>

<h3>Women's Position and Gender Reforms</h3>
<p>The colonial period produced a paradox: the colonial state used women's oppression to justify the "civilising mission" of colonialism, while Indian reformers debated whether reform of women's status should come from within Indian tradition or through colonial legislation.</p>

<ul>
  <li><strong>Sati abolition (1829)</strong> — the most celebrated reform. But as Lata Mani (<em>Contentious Traditions</em>) argues, the colonial debate on sati was not primarily about women — it was about the interpretation of ancient texts. Women were objects of the discourse, not subjects.</li>
  <li><strong>Widow remarriage</strong> — Ishwar Chandra Vidyasagar led the campaign that produced the Hindu Widows' Remarriage Act (1856). The widow remarriage reform was resisted by high-caste Hindus who associated widow chastity with family honour and caste purity.</li>
  <li><strong>Child marriage</strong> — the Age of Consent Bill (1891) raised the age of consent from 10 to 12 years. Tilak opposed the bill as colonial interference in Hindu customs — illustrating the tension between social reform and nationalist mobilisation.</li>
  <li><strong>Purdah and female seclusion</strong> — Begum Rokeya Sakhawat Hossain (<em>Sultana's Dream</em>, 1905) was among the first Indian women to critique purdah from within an Islamic framework.</li>
  <li><strong>Education of women</strong> — Phule (1848), Pandita Ramabai, and later Sarojini Naidu fought for women's access to education. By 1882, women's colleges had been established in Bombay, Calcutta, and Madras.</li>
</ul>

<h3>Caste Reforms and Anti-Brahmanical Movements</h3>
<ul>
  <li><strong>Non-Brahmin Movement (Maharashtra)</strong> — Jyotiba Phule's Satyashodhak Samaj; later the Satya Shodhak movement and its newspaper <em>Dinabandhu</em>.</li>
  <li><strong>Self-Respect Movement and Dravidian Movement (Tamil Nadu)</strong> — E.V. Ramasamy (Periyar) founded the Self-Respect Movement (1925) and later the Dravidar Kazhagam (1944). Periyar systematically attacked Brahminism, the caste system, and the subjugation of women. His ideas laid the intellectual foundation for Tamil Dravidian politics.</li>
  <li><strong>BR Ambedkar</strong> — the most radical critic of the caste system. Ambedkar argued that Hinduism itself is inherently caste-ridden and cannot be reformed from within — it must be annihilated. His book <em>Annihilation of Caste</em> (1936) is the most powerful critique of caste in Indian thought. He led mass conversions to Buddhism (1956), arguing that Buddhism provided a democratic and egalitarian alternative to Brahmanical Hinduism. Ambedkar was the first to frame untouchability as a problem not merely of custom but of constitutional rights.</li>
</ul>

<h3>Communalism — The Dark Side of Colonial Religious Politics</h3>
<p>A critical negative legacy of colonial rule was the sharpening of Hindu-Muslim communal identity. Colonial administrators followed a policy of "divide and rule" — encouraging separate Muslim electorates (Indian Councils Act 1909, Morley-Minto Reforms), creating the All-India Muslim League (1906) as a counterweight to the Congress, and using communal riots to demonstrate that Indians could not govern themselves.</p>

<p>Bipin Chandra argues that communalism was in fact a product of colonialism and modern politics, not of "ancient hatreds." Pre-colonial Indian society was characterised by everyday syncretism at the level of popular culture — shared saints and shrines, common festivals, and caste identities that cut across religious boundaries. Colonial census operations that required individuals to identify by religious community, separate electorates that made religion a basis for political representation, and colonial historiography that periodised Indian history as "Hindu," "Muslim," and "British" periods — all reinforced a view of religious communities as primordially distinct and conflicting.</p>

<h2>Colonial Historiography and Its Critique</h2>

<p>Colonial historians presented Indian history through the lens of British superiority:</p>
<ul>
  <li>India had no history of its own before British rule — only a succession of despotisms.</li>
  <li>Caste, untouchability, and women's oppression proved that India needed colonial tutelage.</li>
  <li>The 1857 revolt was a "Sepoy Mutiny" — a conspiracy of disgruntled soldiers, not a popular uprising.</li>
</ul>

<p>Nationalist historiography (VD Savarkar, RC Majumdar, Jadunath Sarkar) challenged this by constructing a narrative of continuous Indian civilisation and heroic resistance. Marxist historiography (Irfan Habib, Bipan Chandra) analysed colonialism as a form of capitalist exploitation. <strong>Subaltern Studies</strong> (Ranajit Guha, Gyanendra Pandey, Partha Chatterjee, Shahid Amin) challenged both colonial and nationalist historiographies by recovering the agency and consciousness of peasants, workers, women, and tribals who had been marginalised from elite nationalist accounts.</p>

<p>Guha's <em>Elementary Aspects of Peasant Insurgency in Colonial India</em> (1983) argued that peasant revolts were not mere spontaneous, irrational reactions to material conditions but were organised expressions of a distinct peasant consciousness with its own codes, symbols, and logic. What colonial authorities dismissed as "crime" was in fact "rebellion."</p>

<h2>Long-Term Consequences of Colonial Rule</h2>

<h3>Positive Consequences (Modernisation)</h3>
<ul>
  <li>Introduction of English education and the Western scientific tradition.</li>
  <li>Common law, constitution, and administrative structure facilitating a unified nation-state.</li>
  <li>Railway network and telegraphs that integrated India physically.</li>
  <li>Social reform legislation abolishing sati, child marriage, and various forms of discrimination.</li>
  <li>Emergence of new professional classes (lawyers, doctors, teachers, journalists) who formed the backbone of the nationalist movement.</li>
  <li>Modern vernacular literature and print culture that articulated national consciousness.</li>
</ul>

<h3>Negative Consequences (Exploitation and Underdevelopment)</h3>
<ul>
  <li>Drain of wealth and deindustrialisation left India one of the world's poorest countries at independence despite being a major global economy in 1750.</li>
  <li>Sharpening of communal identities that culminated in Partition (1947) — with approximately one million dead and fifteen million displaced.</li>
  <li>Permanent settlement and land revenue systems created entrenched landlordism and rural inequality that persisted well after independence.</li>
  <li>Destruction of traditional educational institutions (Sanskrit pathshalas, madrassa networks, gurukuls) and replacement with English-medium education that alienated Indians from their own intellectual heritage.</li>
  <li>Psychological impact of colonialism — what Frantz Fanon called the "colonised mentality" and what Ashis Nandy (<em>The Intimate Enemy</em>) analysed as the internalisation of Western values and the devaluation of Indian culture by the Indian middle class itself.</li>
</ul>

<p>Goldthorpe (1975) offered a more moderate view: countries like India that were colonised by Britain benefited from colonial institutions (law, railways, English) that gave them developmental advantages over colonies of other powers. But this argument is contested — it measures relative gains from a baseline of total exploitation, not absolute gains.</p>

<p>AR Desai (<em>Social Background of Indian Nationalism</em>, 1948) — from a Marxist perspective — argued that Indian nationalism was essentially a bourgeois phenomenon. The Indian capitalist class, which had grown within the colonial economy, supported independence because it sought to control the domestic market free from British competition. The Congress represented primarily the interests of this emerging Indian bourgeoisie, though it mobilised wider social support through Gandhian ideology.</p>
\n`,"

if old not in text:
    print("ERROR: pattern not found")
else:
    text = text.replace(old, new, 1)
    with open('lib/noteContent/sociology.ts', 'w') as f:
        f.write(text)
    print("Done")
