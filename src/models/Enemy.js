import { MAX_STATUS_STACKS, STATUS_TYPES } from "../config/gameConfig.js";

export class Enemy {
  constructor(definition, id = crypto.randomUUID()) {
    this.id = id;
    this.definitionId = definition.id;
    this.name = definition.name;
    this.kind = definition.kind ?? "";
    this.maxHealth = definition.maxHealth;
    this.health = definition.maxHealth;
    this.block = 0;
    this.statuses = {
      [STATUS_TYPES.VULNERABLE]: 0,
      [STATUS_TYPES.WEAK]: 0,
      [STATUS_TYPES.POISON]: 0,
    };
    this.attackBehaviour = structuredClone(definition.attackBehaviour);
    this.attackIndex = 0;
    this.image = definition.image;
  }

  get isAlive() {
    return this.health > 0;
  }

  get currentAttackIndex() {
    const attacks = this.attackBehaviour.attacks;
    return attacks?.length ? this.attackIndex % attacks.length : 0;
  }

  takeDamage(amount) {
    const damage = Math.max(0, Math.floor(amount));
    const blocked = Math.min(this.block, damage);
    this.block -= blocked;
    this.health = Math.max(0, this.health - (damage - blocked));
    if (damage > blocked) this.removeStatus(STATUS_TYPES.VULNERABLE);
    return { blocked, healthLost: damage - blocked, health: this.health, block: this.block };
  }

  takePoisonDamage(amount) {
    const healthLost = Math.min(this.health, Math.max(0, Math.floor(amount)));
    this.health -= healthLost;
    return healthLost;
  }

  heal(amount) {
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + Math.max(0, Math.floor(amount)));
    return this.health - before;
  }

  adjustBlock(amount) {
    this.block = Math.max(0, this.block + Math.floor(amount));
    return this.block;
  }

  addStatus(type, amount = 1) {
    if (!Object.hasOwn(this.statuses, type) || !this.isAlive) return 0;
    const cap = type === STATUS_TYPES.POISON ? Number.POSITIVE_INFINITY : MAX_STATUS_STACKS;
    const before = this.statuses[type];
    this.statuses[type] = Math.min(cap, before + Math.max(0, Math.floor(amount)));
    return this.statuses[type] - before;
  }

  removeStatus(type, amount = 1) {
    if (!Object.hasOwn(this.statuses, type)) return 0;
    const before = this.statuses[type];
    this.statuses[type] = Math.max(0, before - Math.max(0, Math.floor(amount)));
    return before - this.statuses[type];
  }

  resurrect() {
    this.health = this.maxHealth;
    this.block = 0;
    this.statuses = {
      [STATUS_TYPES.VULNERABLE]: 0,
      [STATUS_TYPES.WEAK]: 0,
      [STATUS_TYPES.POISON]: 0,
    };
  }

  advanceAttack() {
    if (this.attackBehaviour.type === "loop" && this.attackBehaviour.attacks.length) {
      this.attackIndex = (this.attackIndex + 1) % this.attackBehaviour.attacks.length;
    }
  }
}