export type QAType = "tossup" | "bonus";

export type Category =
  | "Physics"
  | "Chemistry"
  | "Biology"
  | "Math"
  | "Energy"
  | "Earth"
  | "Space";

export type QuestionCategory =
  | "short_answer"
  | "multiple_choice"
  | "identify_all"
  | "rank";

export type MCLabel = "W" | "X" | "Y" | "Z";

export type Question = {
  id: number;
  text: string;
  answer: string; // for MC: correct label "W" | "X" | "Y" | "Z"; otherwise free-form
  category: Category;
  type: QAType; // tossup vs bonus
  year: number;
  questionCategory: QuestionCategory;
  choices?: {
    label: MCLabel;
    text: string;
  }[];
  attributes?: string[]; // for identify_all and rank
};

export const questions: Question[] = [
  // 1) Earth & Space – Alps boundary
  {
    id: 1,
    text: "The Alps in northern Italy are an example of which of the following types of tectonic boundaries?",
    answer: "W",
    category: "Earth",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Continental-continental convergence" },
      { label: "X", text: "Continental-oceanic convergence" },
      { label: "Y", text: "Oceanic-oceanic convergence" },
      { label: "Z", text: "Continental-continental divergence" },
    ],
  },
  {
    id: 2,
    text: "Identify all of the following three landmarks that are usually glacial in origin.",
    answer: "1 ONLY",
    category: "Earth",
    type: "bonus",
    year: 2025,
    questionCategory: "identify_all",
    attributes: ["Kettle lake", "Intermittent stream", "Submarine valley"],
  },

  // 2) Chemistry – octet rule
  {
    id: 3,
    text: "Which of the following compounds violates the octet rule?",
    answer: "W",
    category: "Chemistry",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Sulfur tetrafluoride" },
      { label: "X", text: "Ozone" },
      { label: "Y", text: "Dinitrogen tetroxide" },
      { label: "Z", text: "Phosphorus trichloride" },
    ],
  },
  {
    id: 4,
    text: "Which of the following inorganic acids has the highest pKa?",
    answer: "X",
    category: "Chemistry",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Sulfuric acid" },
      { label: "X", text: "Hydrofluoric acid" },
      { label: "Y", text: "Perchloric acid" },
      { label: "Z", text: "Nitric acid" },
    ],
  },

  // 3) Biology – Tay-Sachs frameshift
  {
    id: 5,
    text: "Tay-Sachs disease is caused by a 4 base pair insertion into the hexosaminidase A gene. This 4 base pair insertion is an example of what type of mutation?",
    answer: "Frameshift mutation",
    category: "Biology",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 6,
    text: "In 2007, scientists successfully induced the differentiation of a fibroblast into a stem cell. These induced stem cells have which of the following potencies?",
    answer: "Z",
    category: "Biology",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Totipotent" },
      { label: "X", text: "Unipotent" },
      { label: "Y", text: "Multipotent" },
      { label: "Z", text: "Pluripotent" },
    ],
  },

  // 4) Math – powers of 2
  {
    id: 7,
    text: "Half of 16^16 can be expressed as 2 raised to what power?",
    answer: "63",
    category: "Math",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 8,
    text: "Juliet is on a ship at 0 degrees East, 60 degrees North. She sails along the 60 degree latitude line to reach Romeo at 45 degrees West, 60 degrees North. If the Earth’s circumference is 40,000 kilometers, how many kilometers does Juliet travel?",
    answer: "2500",
    category: "Math",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 5) Energy – torpor / hibernation
  {
    id: 9,
    text: "MIT researchers at the Whitehead Institute are studying daily torpor, a state of dormancy with low metabolic activity. In addition to daily torpor, animals in harsh winter conditions often undergo what type of prolonged torpor?",
    answer: "Hibernation",
    category: "Energy",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 10,
    text: "Researchers in the Ovchinnikov Group developed a heuristic to efficiently search for high-scoring phylogenetic trees. What principle is used to score phylogenetic trees by the total number of character-state changes?",
    answer: "Principle of maximum parsimony",
    category: "Energy",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 6) Physics – terminal velocity
  {
    id: 11,
    text: "Which of the following gives the magnitude and direction, respectively, of the net acceleration experienced by an object falling to the ground at its terminal velocity?",
    answer: "Y",
    category: "Physics",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "g downward" },
      { label: "X", text: "g/2 downward" },
      { label: "Y", text: "0" },
      { label: "Z", text: "g upward" },
    ],
  },
  {
    id: 12,
    text: "Josh places a 10-gram wooden block at rest on his desk and applies a constant force of 10 millinewtons along the surface. If the coefficients of static and kinetic friction are 0.6 and 0.05, respectively, what is the acceleration of the block in meters per second squared?",
    answer: "0",
    category: "Physics",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 7) Earth & Space – meandering streams
  {
    id: 13,
    text: "Identify all of the following three characteristics of meandering streams that typically increase as one moves downstream: 1) Capacity; 2) Competence; 3) Gradient.",
    answer: "1 ONLY",
    category: "Earth",
    type: "tossup",
    year: 2025,
    questionCategory: "identify_all",
    attributes: ["Capacity", "Competence", "Gradient"],
  },
  {
    id: 14,
    text: "Which quadrant of a Northern Hemisphere hurricane, relative to its direction of motion, experiences the strongest storm surge?",
    answer: "X",
    category: "Earth",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Left front" },
      { label: "X", text: "Right front" },
      { label: "Y", text: "Left rear" },
      { label: "Z", text: "Right rear" },
    ],
  },

  // 8) Math – expected value, bread/patty
  {
    id: 15,
    text: "Ricky rolls a fair six-sided die and sees an even number. What is the expected value of the number Ricky saw?",
    answer: "4",
    category: "Math",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 16,
    text: "A cheeseburger has 2 slices of bread and 1 patty, and is 300 calories. A Big Mac has 3 slices of bread and 2 patties, and is 560 calories. How many calories does one slice of bread have?",
    answer: "40",
    category: "Math",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 9) Biology – gibberellins / Allee effect
  {
    id: 17,
    text: "Foolish rice seedling disease is characterized by rice plants growing so tall that they topple over before they mature. This disease is associated with the hypersecretion of which plant hormone?",
    answer: "Gibberellins",
    category: "Biology",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 18,
    text: "The Allee effect states that at smaller population sizes, per capita population growth slows. Which of the following is NOT a valid explanation for the Allee effect?",
    answer: "Z",
    category: "Biology",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "At smaller population sizes, organisms are more vulnerable to predator attack" },
      { label: "X", text: "At smaller population sizes, populations are more likely to experience strong genetic drift" },
      { label: "Y", text: "At smaller population sizes, organisms have a harder time finding mates" },
      { label: "Z", text: "At smaller population sizes, disease spreads more rapidly" },
    ],
  },

  // 10) Energy – methane monooxygenase / Moho
  {
    id: 19,
    text: "Researchers in the Kulik Group computationally studied the enzyme methane monooxygenase, which catalyzes the transformation of methane to what simple alcohol?",
    answer: "Methanol",
    category: "Energy",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 20,
    text: "Researchers in the Van der Hilst Group are using seismic imaging to study the Mohorovičić discontinuity. Where is the Mohorovičić discontinuity located?",
    answer: "X",
    category: "Energy",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Between the upper and lower crust" },
      { label: "X", text: "Between the lower crust and upper mantle" },
      { label: "Y", text: "Between the upper and lower mantle" },
      { label: "Z", text: "Between the lower mantle and outer core" },
    ],
  },

  // 11) Chemistry – titration / SOF4 bonds
  {
    id: 21,
    text: "A 0.40 molar solution of hydrochloric acid is used to titrate 25 milliliters of 0.16 molar sodium hydroxide. In milliliters, how much hydrochloric acid is required to reach the equivalence point?",
    answer: "10",
    category: "Chemistry",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 22,
    text: "How many sigma and pi bonds, respectively, are found in the highest contributing resonance form of SOF4?",
    answer: "5 sigma, 1 pi",
    category: "Chemistry",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 12) Physics – angle of incidence / satellite g
  {
    id: 23,
    text: "In optics, the angle of incidence is always equal to which of the following angles?",
    answer: "X",
    category: "Physics",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Angle of refraction" },
      { label: "X", text: "Angle of reflection" },
      { label: "Y", text: "Critical angle" },
      { label: "Z", text: "Brewster’s angle" },
    ],
  },
  {
    id: 24,
    text: "A satellite is orbiting the Earth at 12,800 kilometers above the Earth’s surface. If the radius of the Earth is 6,400 kilometers, then to two significant figures, what is the gravitational acceleration experienced by the satellite in meters per second squared?",
    answer: "1.1",
    category: "Physics",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 13) Energy – dark energy / helium-4
  {
    id: 25,
    text: "Physicists from the Kavli Institute studied the Hubble tension, the disparity between measurements of the universe’s current rate of expansion. What is the proposed source for the accelerating expansion of the universe?",
    answer: "Dark energy",
    category: "Energy",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 26,
    text: "Physicists at the Plasma Science and Fusion Center are studying tritium breeding by bombarding lithium-7 with a neutron. This reaction splits the resulting lithium-8 nucleus into tritium, a neutron, and what other nuclide?",
    answer: "Helium-4",
    category: "Energy",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 14) Physics – inelastic collision / magnetic fields from charges
  {
    id: 27,
    text: "A 10-gram billiard ball traveling at 10 meters per second collides perfectly inelastically with a 500-gram wooden block at rest on a flat pool table. In kilogram-meters per second, what is the momentum of the ball-block system after the collision?",
    answer: "0.1",
    category: "Physics",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 28,
    text: "Identify all of the following three systems that generate a magnetic field: 1) Point charge at rest in zero external electric field; 2) Point charge at rest in a nonzero external electric field; 3) Point charge moving in a line with constant speed in zero external electric field.",
    answer: "3 ONLY",
    category: "Physics",
    type: "bonus",
    year: 2025,
    questionCategory: "identify_all",
    attributes: [
      "Point charge at rest in zero external electric field",
      "Point charge at rest in a nonzero external electric field",
      "Point charge moving in a line with constant speed in zero external electric field",
    ],
  },

  // 15) Math – theorems on |x| / bubble tea ice
  {
    id: 29,
    text: "Identify all of the following three theorems that always apply to the absolute value function on any closed interval: 1) Intermediate value theorem; 2) Mean value theorem; 3) Extreme value theorem.",
    answer: "1 AND 3",
    category: "Math",
    type: "tossup",
    year: 2025,
    questionCategory: "identify_all",
    attributes: [
      "Intermediate value theorem",
      "Mean value theorem",
      "Extreme value theorem",
    ],
  },
  {
    id: 30,
    text: "Eric has an 8-ounce cup of bubble tea that is currently 50% ice by volume. If Eric drinks the bubble tea until it is 80% ice by volume and no ice melts, how many ounces of bubble tea did he drink?",
    answer: "3",
    category: "Math",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 16) Chemistry – colligative properties / ionization energies
  {
    id: 31,
    text: "Which of the following properties of a liquid increases when a non-volatile solute is added to form a dilute solution?",
    answer: "Z",
    category: "Chemistry",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Vapor pressure" },
      { label: "X", text: "Surface tension" },
      { label: "Y", text: "Freezing point" },
      { label: "Z", text: "Boiling point" },
    ],
  },
  {
    id: 32,
    text: "The first, second, and third ionization energies of an element are 500, 950, and 3500 kilojoules per mole, respectively. Which of the following is the most likely identity of the element?",
    answer: "Y",
    category: "Chemistry",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Tellurium" },
      { label: "X", text: "Antimony" },
      { label: "Y", text: "Barium" },
      { label: "Z", text: "Cesium" },
    ],
  },

  // 17) Biology – taxis / respiration order
  {
    id: 33,
    text: "Moths circle around lights due to an innate response that causes them to orient themselves such that light sources are behind them. This kind of movement is a general example of which of the following phenomena?",
    answer: "X",
    category: "Biology",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Kinesis" },
      { label: "X", text: "Taxis" },
      { label: "Y", text: "Tropism" },
      { label: "Z", text: "Mimicry" },
    ],
  },
  {
    id: 34,
    text: "Order the following three steps of cellular respiration in chronological order starting from glucose: 1) Glucose phosphorylation; 2) Cytochrome c reduction; 3) Citrate formation.",
    answer: "1, 3, 2",
    category: "Biology",
    type: "bonus",
    year: 2025,
    questionCategory: "rank",
    attributes: [
      "Glucose phosphorylation",
      "Cytochrome c reduction",
      "Citrate formation",
    ],
  },

  // 18) Earth & Space – star lifetime / galaxy type (astronomy → Space)
  {
    id: 35,
    text: "A star with which of the following solar masses would have the longest lifespan?",
    answer: "Z",
    category: "Space",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "100" },
      { label: "X", text: "10" },
      { label: "Y", text: "1" },
      { label: "Z", text: "0.1" },
    ],
  },
  {
    id: 36,
    text: "Which of the following terms describes a galaxy with a densely populated halo and prominent dust rings forming a disk?",
    answer: "W",
    category: "Space",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Lenticular" },
      { label: "X", text: "Spiral" },
      { label: "Y", text: "Irregular" },
      { label: "Z", text: "Elliptical" },
    ],
  },

  // 19) Energy – Gaussian elimination / Poisson processes
  {
    id: 37,
    text: "Researchers at CSAIL’s Julia Lab improved an upper bound on the Gaussian elimination algorithm. Which of the following tasks could Gaussian elimination directly perform?",
    answer: "X",
    category: "Energy",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Removing blurring from an image" },
      { label: "X", text: "Solving a system of linear equations" },
      { label: "Y", text: "Optimizing a real-valued function" },
      { label: "Z", text: "Finding roots to higher-order polynomials" },
    ],
  },
  {
    id: 38,
    text: "Researchers in the Aouad Group studied stochastic processes where independent events occur at a constant mean rate. For these processes, the number of occurrences in a fixed time interval follows what family of probability distributions?",
    answer: "Y",
    category: "Energy",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Normal" },
      { label: "X", text: "Exponential" },
      { label: "Y", text: "Poisson" },
      { label: "Z", text: "Gamma" },
    ],
  },

  // 20) Math – median robustness / hexagon ratio
  {
    id: 39,
    text: "A class of 48 people takes a 50-point exam. When grading, the professor accidentally adds an extra three 0s at the end of someone’s score. Which measure of the class’s grades will have the smallest change in magnitude?",
    answer: "X",
    category: "Math",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Mean" },
      { label: "X", text: "Median" },
      { label: "Y", text: "Range" },
      { label: "Z", text: "Variance" },
    ],
  },
  {
    id: 40,
    text: "A regular hexagon has side lengths of 2 meters. What is the ratio between the length from the midpoint of a side to the center and a vertex to the center?",
    answer: "sqrt(3)/2",
    category: "Math",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 21) Physics – pair production / integrating acceleration
  {
    id: 41,
    text: "Claire observes the conversion of a high energy photon near an atomic nucleus to an electron and a positron. This is an example of what process?",
    answer: "Pair production",
    category: "Physics",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 42,
    text: "A particle’s acceleration is given by a(t) = 12t^2, where t is in seconds. If the particle’s velocity at t = 0 is 1 meter per second, what is the particle’s velocity at t = 2 seconds?",
    answer: "33",
    category: "Physics",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 22) Biology – Wolff-Chaikoff / protein absorption organs
  {
    id: 43,
    text: "The Wolff-Chaikoff effect is caused by high levels of what essential trace element, used in a thyroid hormone that increases basal metabolic rate?",
    answer: "Iodine",
    category: "Biology",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 44,
    text: "Identify all of the following three organs that, if removed, would cause a significant reduction in protein absorption in humans: 1) Pancreas; 2) Submandibular salivary gland; 3) Small intestine.",
    answer: "1 AND 3",
    category: "Biology",
    type: "bonus",
    year: 2025,
    questionCategory: "identify_all",
    attributes: ["Pancreas", "Submandibular salivary gland", "Small intestine"],
  },

  // 23) Chemistry – p-type doping / CaCO3 solubility
  {
    id: 45,
    text: "When added in trace amounts to pure silicon, which of the following elements would create a p-type semiconductor?",
    answer: "Z",
    category: "Chemistry",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Germanium" },
      { label: "X", text: "Phosphorus" },
      { label: "Y", text: "Antimony" },
      { label: "Z", text: "Gallium" },
    ],
  },
  {
    id: 46,
    text: "Yunyi is studying the solubility of calcium carbonate in aqueous solution and observes the solubility decreases as temperature increases. Which of the following best explains this observation?",
    answer: "X",
    category: "Chemistry",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Dissolving calcium carbonate is endothermic" },
      { label: "X", text: "Dissolving calcium carbonate is exothermic" },
      { label: "Y", text: "Dissolving calcium carbonate increases the solution’s entropy" },
      { label: "Z", text: "Dissolving calcium carbonate decreases the solution’s entropy" },
    ],
  },

  // 24) Earth & Space – Mercury transit / contact binary L1 (astronomy → Space)
  {
    id: 47,
    text: "Although Mercury orbits the Sun quickly, we only observe Mercury transiting the Sun about once every seven years. Which of the following considerations explains this pattern?",
    answer: "Z",
    category: "Space",
    type: "tossup",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Mercury’s orbit is highly eccentric" },
      { label: "X", text: "Mercury’s orbital precession is rapid" },
      { label: "Y", text: "Mercury’s transits can only be observed when Mercury is near its aphelion" },
      { label: "Z", text: "Mercury’s orbit is tilted relative to the ecliptic" },
    ],
  },
  {
    id: 48,
    text: "In a contact binary, the two stars’ respective envelopes meet at which Lagrange point?",
    answer: "L1",
    category: "Space",
    type: "bonus",
    year: 2025,
    questionCategory: "short_answer",
  },

  // 25) Chemistry – permanganate electrons / superacid + glass
  {
    id: 49,
    text: "How many electrons are transferred per manganese atom in the redox reaction between potassium permanganate and iron(II) chloride in acidic solution?",
    answer: "5",
    category: "Chemistry",
    type: "tossup",
    year: 2025,
    questionCategory: "short_answer",
  },
  {
    id: 50,
    text: "Which of the following acids could not be safely stored using glass containers?",
    answer: "W",
    category: "Chemistry",
    type: "bonus",
    year: 2025,
    questionCategory: "multiple_choice",
    choices: [
      { label: "W", text: "Fluoroantimonic acid" },
      { label: "X", text: "Sulfuric acid" },
      { label: "Y", text: "Hydrochloric acid" },
      { label: "Z", text: "Trichloroacetic acid" },
    ],
  },
];
