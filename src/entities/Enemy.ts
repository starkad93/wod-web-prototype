import Phaser from 'phaser';

export interface EnemyData {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  color?: number;
  attackDamage?: number;
  xpReward?: number;
}

export default class Enemy extends Phaser.GameObjects.Container {
  public hp: number;
  public readonly maxHp: number;
  public readonly name: string;
  public alive = true;
  public readonly attackDamage: number;
  public readonly xpReward: number;

  private readonly body: Phaser.GameObjects.Circle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly healthBarBg: Phaser.GameObjects.Rectangle;
  private readonly healthBar: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, data: EnemyData) {
    super(scene, data.x, data.y);

    this.name = data.name;
    this.maxHp = data.maxHp;
    this.hp = data.hp;
    this.attackDamage = data.attackDamage ?? 8;
    this.xpReward = data.xpReward ?? 25;

    this.body = scene.add.circle(0, 0, 18, data.color ?? 0xf87171, 1);
    this.label = scene.add.text(0, -28, data.name, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#fff6e6',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      padding: { x: 6, y: 2 },
    });
    this.label.setOrigin(0.5);

    this.healthBarBg = scene.add.rectangle(0, 26, 34, 6, 0x3d3d3d, 1);
    this.healthBar = scene.add.rectangle(-17, 26, 34, 6, 0xfbbf24, 1);
    this.healthBar.setOrigin(0, 0.5);

    this.add([this.body, this.label, this.healthBarBg, this.healthBar]);
    scene.add.existing(this);
    this.setDepth(12);

    this.setSize(36, 36);
    this.setInteractive();
    this.on('pointerdown', () => {
      scene.events.emit('enemy-target', this);
    });
  }

  public damage(amount: number): number {
    if (!this.alive) return 0;

    this.hp = Math.max(0, this.hp - amount);
    this.healthBar.width = 34 * (this.hp / this.maxHp);

    const damageText = this.scene.add.text(this.x, this.y - 24, `-${amount}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#fca5a5',
      fontStyle: 'bold',
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      padding: { x: 4, y: 2 },
    });
    damageText.setDepth(150);
    this.scene.tweens.add({
      targets: damageText,
      y: this.y - 54,
      alpha: 0,
      duration: 500,
      onComplete: () => damageText.destroy(),
    });

    if (this.hp <= 0) {
      this.alive = false;
      this.setVisible(false);
      this.label.setVisible(false);
      this.healthBarBg.setVisible(false);
      this.healthBar.setVisible(false);
      this.body.setVisible(false);
    }

    return this.hp;
  }
}
