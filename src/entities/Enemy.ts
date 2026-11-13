import Phaser from 'phaser';

export interface EnemyData {
  id: string; name: string; x: number; y: number; hp: number; maxHp: number;
  color?: number; attackDamage?: number; xpReward?: number; boss?: boolean;
}

export default class Enemy extends Phaser.GameObjects.Container {
  public hp: number;
  public alive = true;
  public readonly data: EnemyData;
  private readonly hpBar: Phaser.GameObjects.Rectangle;
  private readonly hpBarWidth: number;
  private readonly orb: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, data: EnemyData, onSelect: (enemy: Enemy) => void) {
    super(scene, data.x, data.y);
    this.data = data;
    this.hp = data.hp;
    this.hpBarWidth = data.boss ? 74 : 42;
    const shadow = scene.add.ellipse(0, 16, data.boss ? 48 : 30, 10, 0x07130d, 0.45);
    this.orb = scene.add.circle(0, 0, data.boss ? 29 : 18, data.color ?? 0x8c65c7) as Phaser.GameObjects.Arc;
    const glow = scene.add.circle(0, 0, data.boss ? 35 : 22, data.color ?? 0x8c65c7, 0.18);
    const eyeL = scene.add.circle(-6, -3, 2.5, 0xffe6a3);
    const eyeR = scene.add.circle(6, -3, 2.5, 0xffe6a3);
    const label = scene.add.text(0, data.boss ? -53 : -39, data.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: data.boss ? '14px' : '12px', color: '#fff1e8',
      backgroundColor: '#271827dd', padding: { x: 5, y: 3 },
    }).setOrigin(0.5);
    const bg = scene.add.rectangle(0, data.boss ? 42 : 30, this.hpBarWidth, 6, 0x301b24);
    this.hpBar = scene.add.rectangle(-this.hpBarWidth / 2, data.boss ? 42 : 30, this.hpBarWidth, 4, data.boss ? 0xdf456b : 0xe9a64a).setOrigin(0, 0.5);
    this.add([shadow, glow, this.orb, eyeL, eyeR, label, bg, this.hpBar]);
    scene.add.existing(this);
    this.setDepth(data.y);
    const size = data.boss ? 62 : 40;
    this.setSize(size, size);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, size / 2), Phaser.Geom.Circle.Contains);
    this.on('pointerdown', () => onSelect(this));
    scene.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.35 }, scale: { from: 0.9, to: 1.12 }, duration: 900, yoyo: true, repeat: -1 });
  }

  public damage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hpBar.width = this.hpBarWidth * this.hp / this.data.maxHp;
    this.scene.tweens.add({ targets: this.orb, scale: 1.2, duration: 90, yoyo: true });
    const float = this.scene.add.text(this.x, this.y - 22, `-${amount}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffd0be', fontStyle: 'bold',
      stroke: '#401b2a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10000);
    this.scene.tweens.add({ targets: float, y: float.y - 38, alpha: 0, duration: 650, onComplete: () => float.destroy() });
    if (this.hp === 0) {
      this.alive = false;
      this.disableInteractive();
      this.scene.tweens.add({ targets: this, alpha: 0, scale: 0.4, duration: 280, onComplete: () => this.setVisible(false) });
    }
  }
}
