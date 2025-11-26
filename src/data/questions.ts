export type Category =
  | "Physics"
  | "Chemistry"
  | "Biology"
  | "Math"
  | "Energy"
  | "Earth"
  | "Space";

export type Question = {
  id: number;
  text: string;
  answer: string;
  category: Category;
};

export const questions: Question[] = [
  // --- Your original 4 ---
  {
    id: 1,
    text: "What gas makes up most of the Sun?",
    answer: "Hydrogen",
    category: "Physics",
  },
  {
    id: 2,
    text: "What is the chemical symbol for water?",
    answer: "H2O",
    category: "Chemistry",
  },
  {
    id: 3,
    text: "What organ pumps blood through the human body?",
    answer: "The heart",
    category: "Biology",
  },
  {
    id: 4,
    text: "What is 2 + 2?",
    answer: "4",
    category: "Math",
  },

  // --- NSBA 3 – Playoff 1 TOSSUPS (1–23) → ids 5–27 ---

  {
    id: 5,
    text: "Suzuko is studying the nuclear lamina. Which of the following is true of the proteins making up this structure?",
    answer: "They rapidly depolymerize during M phase",
    category: "Biology",
  },
  {
    id: 6,
    text: "A sphygmomanometer senses blood pressure by measuring what sounds heard between systolic and diastolic pressures?",
    answer: "Korotkoff sounds",
    category: "Biology",
  },
  {
    id: 7,
    text: "How many isomers are there for the octahedral cobalt complex with three carbonyl ligands and three ammonia ligands?",
    answer: "2",
    category: "Chemistry",
  },
  {
    id: 8,
    text: "What is the preferred IUPAC name of the major product when 3-methylbutan-2-ol is reacted with concentrated sulfuric acid under heat?",
    answer: "2-methylbut-2-ene",
    category: "Chemistry",
  },
  {
    id: 9,
    text: "In AC circuits, what is the factor between the maximum instantaneous power and the average power delivered to a circuit?",
    answer: "2",
    category: "Physics",
  },
  {
    id: 10,
    text: "What physical quantity is obtained by taking the curl of the vector potential?",
    answer: "Magnetic field",
    category: "Physics",
  },
  {
    id: 11,
    text: "Which terrestrial planet statement is false: Mercury has a dynamo field, Venus’s greenhouse is from CO₂, Earth is the only terrestrial planet with active volcanoes, or Mars has non-spherical moons?",
    answer: "Earth is the only terrestrial planet with active volcanoes",
    category: "Space",
  },
  {
    id: 12,
    text: "Which properties differ between a sample of calcite and a sample of aragonite: crystal structure, hardness, reactivity with acid?",
    answer: "All",
    category: "Earth",
  },
  {
    id: 13,
    text: "A movie theater row has 5 seats. Alice, Bob, and 3 others sit randomly. What is the probability Alice sits next to Bob?",
    answer: "2/5",
    category: "Math",
  },
  {
    id: 14,
    text: "A chicken randomly runs 1 meter in a random cardinal direction each second for 3 seconds. What is the probability it is at least 2 meters from its starting point?",
    answer: "7/16",
    category: "Math",
  },
  {
    id: 15,
    text: "In parallel programming, what synchronization primitive with wait and post operations controls access to shared resources?",
    answer: "Semaphore",
    category: "Math",
  },
  {
    id: 16,
    text: "Which checksum statements are true: (1) can detect accidental corruption; (2) can authenticate sender; (3) can verify data not modified during transmission?",
    answer: "1 and 3",
    category: "Math",
  },
  {
    id: 17,
    text: "Which change is most likely to increase resolution in gas chromatography: increase column length, carrier gas flow rate, injection volume, or temperature?",
    answer: "Increasing column length",
    category: "Chemistry",
  },
  {
    id: 18,
    text: "What titanium-based catalysts are used in the production of olefin polymers like polyethylene?",
    answer: "Ziegler–Natta catalysts",
    category: "Chemistry",
  },
  {
    id: 19,
    text: "Xander is at the bottom of the Space Needle, Lander and Alexander at 3 m and 4.5 m above. For every second Xander’s watch runs, what is the ratio of time gained by Lander’s and Alexander’s watches?",
    answer: "2:3",
    category: "Physics",
  },
  {
    id: 20,
    text: "Around 300,000 years after the Big Bang the universe became transparent to photons forming the CMBR. What effect describes spectral distortions from CMB photons scattered by hot electrons in galaxy clusters?",
    answer: "Sunyaev–Zeldovich effect",
    category: "Space",
  },
  {
    id: 21,
    text: "At Earth’s surface, an unsaturated parcel at 30°C with dew point 14°C is lifted in an environment with lapse rate 8°C/km and dew point lapse rate 2°C/km. To the nearest km, how high must it be lifted to reach saturation?",
    answer: "2",
    category: "Earth",
  },
  {
    id: 22,
    text: "Which seismic discontinuity marks the boundary between Earth’s mantle and core: Lehmann, Gutenberg, Conrad, or Mohorovičić?",
    answer: "Gutenberg discontinuity",
    category: "Earth",
  },
  {
    id: 23,
    text: "A right triangle has legs 20 and 21. What is the shortest altitude of the triangle?",
    answer: "420/29",
    category: "Math",
  },
  {
    id: 24,
    text: "How many positive integers under 100 have exactly 3 positive factors?",
    answer: "4",
    category: "Math",
  },
  {
    id: 25,
    text: "The Hayflick limit describes the number of times a cell can divide before what chromosome structures completely degrade?",
    answer: "Telomeres",
    category: "Biology",
  },
  {
    id: 26,
    text: "Which difference between utricle and saccule is most accurate: the utricle senses horizontal movement while the saccule senses vertical movement?",
    answer: "The utricle senses horizontal movement, the saccule senses vertical movement",
    category: "Biology",
  },
  {
    id: 27,
    text: "In electrochemistry, what quantity is defined as the difference between a half reaction’s theoretical and empirical voltage?",
    answer: "Overpotential",
    category: "Chemistry",
  },


  {
    id: 28,
    text: "A female chicken is born. Which sex chromosome must it have inherited from its mother?",
    answer: "W",
    category: "Biology",
  },
  {
    id: 29,
    text: "Which nucleus is NOT NMR active: H-2, N-15, P-31, or S-32?",
    answer: "S-32",
    category: "Chemistry",
  },
  {
    id: 30,
    text: "How many times larger is the momentum of a particle traveling at 0.8c compared to the same particle traveling at 0.6c?",
    answer: "16/9",
    category: "Physics",
  },
  {
    id: 31,
    text: "Rank these stars from most to least reliant on the CNO cycle: (1) Pop II 1.2 M☉; (2) first-generation Pop III 70 M☉; (3) Pop I 15 M☉; (4) later-generation Pop III 10 M☉.",
    answer: "3, 4, 1, 2",
    category: "Space",
  },
  {
    id: 32,
    text: "What kind of integers n satisfy x^n ≡ x (mod n) for all integers x but are not prime?",
    answer: "Carmichael numbers",
    category: "Math",
  },
  {
    id: 33,
    text: "In recent LLMs, prompt caching stores which representations so that new prompts can be matched by similarity and reuse past answers?",
    answer: "Embedded vectors",
    category: "Math",
  },
  {
    id: 34,
    text: "Which nuclei are often used as porous aluminosilicate industrial adsorbents and catalysts?",
    answer: "Zeolites",
    category: "Chemistry",
  },
  {
    id: 35,
    text: "Min Verstappen takes Copse corner with lateral acceleration of 5g on a 144 m radius. To the nearest m/s, how fast is he going?",
    answer: "84",
    category: "Physics",
  },
  {
    id: 36,
    text: "What is the term for the boundary between two separate terranes that collided to form a single continent?",
    answer: "Suture",
    category: "Earth",
  },
  {
    id: 37,
    text: "On a 2025-dimensional hypercube, how many vertices are adjacent to a given vertex?",
    answer: "2025",
    category: "Math",
  },
  {
    id: 38,
    text: "What neurotransmitter is released by photoreceptor cells when they are not exposed to light?",
    answer: "Glutamate",
    category: "Biology",
  },
  {
    id: 39,
    text: "A single qubit is in state √3/2 |0⟩ + 1/2 |1⟩. Measuring in the computational basis, what is the probability of observing |1⟩?",
    answer: "1/4",
    category: "Math",
  },
  {
    id: 40,
    text: "The energy density of a magnetic field is proportional to what power of its flux density?",
    answer: "2",
    category: "Physics",
  },
  {
    id: 41,
    text: "Cotidal zones appear to rotate around what points, which lack tidal ranges?",
    answer: "Amphidromic points",
    category: "Earth",
  },
  {
    id: 42,
    text: "Gauss showed the heptadecagon is constructible because 17 is an example of what kind of prime?",
    answer: "Fermat prime",
    category: "Math",
  },
  {
    id: 43,
    text: "Which difference best explains the higher protein concentration in lung interstitial fluid compared to that of other organs?",
    answer: "Lower pulmonary blood pressure requires higher osmotic pressure to maintain fluid balance",
    category: "Biology",
  },
  {
    id: 44,
    text: "Which role best describes an auxiliary in chemical synthesis: accelerating rate, controlling stereochemical outcome, protecting side chains, or enhancing nucleophilicity?",
    answer: "Controlling the stereochemical outcome",
    category: "Chemistry",
  },
  {
    id: 45,
    text: "Some NP-hard problems remain intractable even when input numbers are bounded. What term describes these problems?",
    answer: "Strongly NP-hard",
    category: "Math",
  },
  {
    id: 46,
    text: "What kind of topography found in areas with parallel drainage systems has interfluves, minimal vegetation, steep slopes, and thin regolith levels?",
    answer: "Badlands",
    category: "Earth",
  },
  {
    id: 47,
    text: "Two fair dice are rolled. What is the probability that the product of the two values is divisible by 4?",
    answer: "5/12",
    category: "Math",
  },
  {
    id: 48,
    text: "What gaseous neurotransmitter is synthesized from arginine?",
    answer: "Nitric oxide",
    category: "Biology",
  },
  {
    id: 49,
    text: "Which statement is true for pericyclic reactions: (1) cyclic transition state; (2) net increase in sigma bonds; (3) net increase in pi bonds?",
    answer: "1",
    category: "Chemistry",
  },
  {
    id: 50,
    text: "Identify all spacetime separations that allow causation between two events: lightlike, spacelike, timelike.",
    answer: "Lightlike and timelike",
    category: "Physics",
  },
];
