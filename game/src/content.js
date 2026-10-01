// All tunable content: driver archetypes, escalation rungs, dialogue, events.
export const BASE_FEE = 300;

export const ARCHETYPES = [
  {
    id: 'fearful', name: 'Nervous Danfo Man', emoji: '😟',
    trait: 'Hands shaking on the wheel', weight: 30,
    payBonus: 15, fightBack: 0.15, dmg: [5, 12], yield: [200, 350],
    lines: [
      'Ah! Oga agbero! I go pay! I go pay! No vex!',
      'Take am, take am! I no want wahala today!',
      'Oga, I don keep your money since morning. Here!',
    ],
  },
  {
    id: 'stubborn', name: 'Stubborn Veteran', emoji: '😠',
    trait: '20 years on this road. Respects nobody.', weight: 25,
    payBonus: -25, fightBack: 0.55, dmg: [12, 25], yield: [300, 500],
    lines: [
      'You again? I don pay your oga yesterday. Waka!',
      'This bus na my own. You no fit shake me.',
      'Bring your wahala. I dey here since before you born.',
    ],
  },
  {
    id: 'connected', name: 'Connected Big Man', emoji: '🕶️',
    trait: 'Police sticker on the windscreen. Careful.', weight: 15,
    payBonus: -10, fightBack: 0.3, dmg: [8, 18], yield: [350, 500], heatMult: 2,
    lines: [
      'Do you know who I am? I get police sticker oh.',
      'My oga na DPO. Touch this bus and see.',
      'I fit pay, but no rough-handling. We be gentlemen.',
    ],
  },
  {
    id: 'broke', name: 'Broke Young Driver', emoji: '😞',
    trait: 'Empty pockets. Fuel light is on.', weight: 20,
    payBonus: -40, fightBack: 0.35, dmg: [8, 20], yield: [50, 150],
    lines: [
      'Brother, fuel don cost. I never even load passenger today. Abeg.',
      'Check my pocket yourself. Na only air dey inside.',
      'I go pay tomorrow, I swear. Today hard.',
    ],
  },
  {
    id: 'smooth', name: 'Smooth Talker', emoji: '😏',
    trait: 'Smiles too much. Probably lying.', weight: 10,
    payBonus: 0, fightBack: 0.25, dmg: [8, 16], yield: [250, 450],
    lines: [
      'My chairman! Long time! I been wan find you sef.',
      'Oga, make we reason am. I go add something for you.',
      'No need for gra-gra. We be family for this park.',
    ],
  },
];

export function pickArchetype() {
  const total = ARCHETYPES.reduce((a, x) => a + x.weight, 0);
  let r = Math.random() * total;
  for (const a of ARCHETYPES) { r -= a.weight; if (r <= 0) return a; }
  return ARCHETYPES[0];
}

// Escalation rungs. success: base % the driver pays at this rung.
export const RUNGS = [
  { id: 'demand',  label: 'Demand ₦300',      sub: 'Talk am well',        success: 70, heat: 0,  dmg: [0, 0],   fear: 3 },
  { id: 'block',   label: 'Block the bus',    sub: 'Stand for front',     success: 80, heat: 3,  dmg: [0, 8],   fear: 5 },
  { id: 'slap',    label: 'Slap conductor',   sub: 'Small correction',    success: 88, heat: 8,  dmg: [10, 15], fear: 8, danger: true },
  { id: 'mirror',  label: 'Rip side mirror',  sub: 'Na so e dey be',      success: 94, heat: 15, dmg: [15, 25], fear: 12, danger: true },
  { id: 'screen',  label: 'Smash windscreen', sub: 'Point of no return',  success: 97, heat: 25, dmg: [20, 35], fear: 16, danger: true },
  { id: 'drag',    label: 'Drag driver out',  sub: 'Brawl guaranteed',    success: 99, heat: 30, dmg: [25, 40], fear: 20, danger: true },
  { id: 'brawl',   label: 'Full brawl',       sub: 'Winner takes all',    success: 100, heat: 35, dmg: [30, 45], fear: 25, danger: true },
];

export const KABIRU_CALLS = [
  'Kabiru dey fight two boys for the other side! You dey come?',
  'Rival crew wan take our corner! I need backup NOW!',
];

export const DAY_EVENTS = [
  { id: 'rain', label: '🌧️ Rain', desc: 'Rainy day — half the danfos.', danfoMult: 0.5 },
  { id: 'fuel', label: '⛽ Fuel scarcity', desc: 'Fuel scarcity — fewer buses, drivers poorer (fees −30%).', danfoMult: 0.7, yieldMult: 0.7 },
  { id: 'inspect', label: '🧐 Oga inspection', desc: 'Oga Sule is watching the stop today. Quota better dey ready.' },
  { id: 'rival', label: '⚔️ Rival crew', desc: 'Rival crew wan take your corner. Defend am or lose the day.' },
  { id: 'parade', label: '🚔 Police parade', desc: 'Police parade for area — heat +20 for everybody. Lie low.' },
];
