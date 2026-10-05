export const AVAILABLE_ENEMIES = Object.freeze([
  {
    id: "cultist",
    name: "Cultist",
    kind: "Humanoid",
    maxHealth: 9,
    image: "assets/images/Cultist.webp",
    attackBehaviour: { type: "fixed", text: "attack 1, gain 1 strength" },
  },
  {
    id: "fungibeast1",
    name: "Fungi beast",
    kind: "Wildlife",
    maxHealth: 6,
    image: "assets/images/Fungibeast.webp",
    attackBehaviour: {
      type: "dice",
      faces: [
        { range: "1–2", text: "attack 2" },
        { range: "3–4", text: "attack 1 AOE, gain 1 strength" },
        { range: "5–6", text: "gain 2 strength" },
      ],
    },
    passiveEffect: "Spore Cloud: On death, apply 1 vulnerable"
  },
  {
    id: "fungibeast2",
    name: "Fungi beast",
    kind: "Wildlife",
    maxHealth: 6,
    image: "assets/images/Fungibeast.webp",
    attackBehaviour: {
      type: "dice",
      faces: [
        { range: "1–2", text: "gain 2 strength" },
        { range: "3–4", text: "attack 2" },
        { range: "5–6", text: "attack 1 AOE, gain 1 strength" },
      ],
    },
    passiveEffect: "Spore Cloud: On death, apply 1 vulnerable"
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
    spawnPool: Object.freeze(["ironhowl"]),
    name: "Ironhowl Brute",
    kind: "Armored raider",
    maxHealth: 58,
    image: "assets/images/ironhowl.svg",
    attackBehaviour: { type: "fixed", text: "Crush · 11" },
  },
]);

const definitions = new Map(AVAILABLE_ENEMIES.map((enemy) => [enemy.id, enemy]));

export const ENEMY_POOL = Object.freeze([
  { ...definitions.get("cultist") },
  { ...definitions.get("fungibeast1"), companions: Object.freeze(["fungibeast2"]) },
  { ...definitions.get("mireling"), companions: Object.freeze(["mireling", "mireling"]) },
  { ...definitions.get("ironhowl") },
]);
