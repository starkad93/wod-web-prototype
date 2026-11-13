import Phaser from 'phaser';

interface Point { x: number; y: number; }
const SAVE_KEY = 'wod-web-prototype-save-v1';
interface SaveData { level: number; xp: number; questIndex: number; defeated: string[]; }
interface Quest { id: string; title: string; description: string; type: 'talk' | 'kill'; targetId: string; targetCount?: number; }

export default class Player extends Phaser.GameObjects.Container {
  public readonly speed = 190;
  public hp = 100;
  public maxHp = 100;
  public mana = 90;
  public maxMana = 90;
  public level = 1;
  public xp = 0;
  public xpNext = 100;
  public spellCooldown = 0;
  public burstCooldown = 0;
  private path: Point[] = [];
  private readonly wings: Phaser.GameObjects.Ellipse[];
  private readonly robe: Phaser.GameObjects.Ellipse;
  private readonly staff: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, saved?: SaveData) {
    super(scene, x, y);
    const shadow = scene.add.ellipse(0, 20, 38, 11, 0x08150e, 0.4);
    this.wings = [scene.add.ellipse(-22, -9, 23, 12, 0xf4f0dc), scene.add.ellipse(22, -9, 23, 12, 0xf4f0dc)];
    this.robe = scene.add.ellipse(0, 1, 26, 34, 0xb72e42);
    const sash = scene.add.rectangle(0, 3, 22, 4, 0xf0c86c);
    const face = scene.add.circle(0, -18, 9, 0xf1c9a5);
    const hood = scene.add.arc(0, -18, 12, 180, 360, false, 0x9d2538).setStrokeStyle(6, 0x9d2538);
    this.staff = scene.add.rectangle(19, 0, 4, 45, 0xe9c361).setAngle(-12);
    const gem = scene.add.circle(19, -24, 5, 0x73ddf2).setStrokeStyle(2, 0xffe8a0);
    this.add([shadow, this.wings[0], this.wings[1], this.robe, sash, face, hood, this.staff, gem]);
    scene.add.existing(this);
    this.setDepth(y);
    if (saved) {
      this.level = Math.max(1, saved.level);
      this.xp = Math.max(0, saved.xp);
      this.maxHp += (this.level - 1) * 18;
      this.maxMana += (this.level - 1) * 12;
      this.hp = this.maxHp;
      this.mana = this.maxMana;
      this.xpNext = Math.round(100 * Math.pow(1.4, this.level - 1));
    }
  }

  public setPath(path: Point[]): void { this.path = path; }
  public get isMoving(): boolean { return this.path.length > 0; }
  public gainXp(value: number): boolean {
    this.xp += value;
    let levelled = false;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext; this.level += 1; levelled = true;
      this.xpNext = Math.round(this.xpNext * 1.4);
      this.maxHp += 18; this.maxMana += 12; this.hp = this.maxHp; this.mana = this.maxMana;
    }
    return levelled;
  }

  public update(time: number, delta: number): void {
    this.spellCooldown = Math.max(0, this.spellCooldown - delta);
    this.burstCooldown = Math.max(0, this.burstCooldown - delta);
    this.mana = Math.min(this.maxMana, this.mana + delta * 0.006);
    this.wings[0].rotation = -0.25 + Math.sin(time * 0.006) * 0.18;
    this.wings[1].rotation = 0.25 - Math.sin(time * 0.006) * 0.18;
    this.setDepth(this.y);
    if (!this.path.length) return;
    const target = this.path[0];
    const dx = target.x - this.x; const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) { this.path.shift(); return; }
    const step = Math.min(distance, this.speed * delta / 1000);
    this.x += dx / distance * step; this.y += dy / distance * step;
    if (dx < -1) this.setFlipX(true); else if (dx > 1) this.setFlipX(false);
  }
}
