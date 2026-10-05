export const ENEMY_POOL = Object.freeze([
  {
    id: "ashbound",
    name: "Ashbound Initiate",
    kind: "Cinder cultist",
    maxHealth: 34,
    image: "assets/images/ashbound.svg",
    attackBehaviour: { type: "fixed", text: "Strike for 7" },
  },
  {
    id: "glasswarden",
    name: "Glass Warden",
    kind: "Ruined sentinel",
    maxHealth: 48,
    image: "assets/images/glasswarden.svg",
    attackBehaviour: {
      type: "loop",
      attacks: ["Shard volley · 8", "Brace · gain 6 block", "Heavy cut · 12"],
    },
  },
  {
    id: "mireling",
    name: "Mireling Swarm",
    kind: "Bog-born creature",
    maxHealth: 27,
    image: "assets/images/mireling.svg",
    attackBehaviour: {
      type: "dice",
      faces: [
        { range: "1–2", text: "Bite · 5" },
        { range: "3–4", text: "Spore cloud · 3 + weak" },
        { range: "5–6", text: "Rend · 10" },
      ],
    },
  },
  {
    id: "ironhowl",
    name: "Ironhowl Brute",
    kind: "Armored raider",
    maxHealth: 58,
    image: "assets/images/glasswarden.svg",
    attackBehaviour: { type: "fixed", text: "Crush · 11" },
  },
]);

export const ENCOUNTER_PRESETS = Object.freeze([
  { id: "ashbound-pair", enemyIds: ["ashbound", "ashbound"] },
  { id: "glass-warden", enemyIds: ["glasswarden"] },
  { id: "mireling-trio", enemyIds: ["mireling", "mireling", "mireling"] },
  { id: "ironhowl", enemyIds: ["ironhowl"] },
  { id: "ashbound-mireling", enemyIds: ["ashbound", "mireling"] },
  { id: "warden-ashbound", enemyIds: ["glasswarden", "ashbound"] },
].map((preset) => Object.freeze({ ...preset, enemyIds: Object.freeze(preset.enemyIds) })));