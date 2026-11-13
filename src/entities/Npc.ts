import Phaser from 'phaser';

export default class Player extends Phaser.GameObjects.Container {
  private speed = 180;
  private path: Array<{ x: number; y: number }> = [];
  private targetMarker: Phaser.GameObjects.Arc;
  private body: Phaser.GameObjects.Rectangle;
  private wings: Phaser.GameObjects.Rectangle[];
  private face: Phaser.GameObjects.Circle;
  private staff: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.setDepth(20);

    const shadow = scene.add.ellipse(0, 24, 34, 12, 0x000000, 0.3);
    this.body = scene.add.rectangle(0, 0, 22, 30, 0xef4444, 1);
    this.face = scene.add.circle(0, -6, 8, 0xf8d3a7, 1);
    this.staff = scene.add.rectangle(16, 4, 6, 40, 0xfacc15, 1);

    this.wings = [
      scene.add.rectangle(-18, -8, 18, 12, 0xf8fafc, 0.9),
      scene.add.rectangle(18, -8, 18, 12, 0xf8fafc, 0.9),
    ];

    this.wings[0].setOrigin(0.5, 0.5);
    this.wings[1].setOrigin(0.5, 0.5);

    this.targetMarker = scene.add.circle(0, 0, 6, 0x7dd3fc, 0.8);
    this.targetMarker.setVisible(false);

    this.add([shadow, this.wings[0], this.wings[1], this.body, this.face, this.staff, this.targetMarker]);
    scene.add.existing(this);
  }

  public setPath(path: Array<{ x: number; y: number }>): void {
    this.path = path;
    if (this.path.length > 0) {
      const last = this.path[this.path.length - 1];
      this.targetMarker.setPosition(last.x, last.y);
      this.targetMarker.setVisible(true);
    }
  }

  public update(_time: number, delta: number): void {
    if (this.path.length === 0) {
      return;
    }

    const target = this.path[0];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 4) {
      this.path.shift();
      if (this.path.length === 0) {
        this.targetMarker.setVisible(false);
      } else {
        const nextTarget = this.path[this.path.length - 1];
        this.targetMarker.setPosition(nextTarget.x, nextTarget.y);
      }
      return;
    }

    const angle = Math.atan2(dy, dx);
    const stepX = Math.cos(angle) * (this.speed * delta) / 1000;
    const stepY = Math.sin(angle) * (this.speed * delta) / 1000;

    this.x += stepX;
    this.y += stepY;

    this.setScale(Math.abs(Math.cos(angle)) > 0.1 ? 1 : 1);
    this.setFlipX(dx < 0);

    this.wings[0].setRotation(-0.5 + Math.sin(_time * 0.01) * 0.4);
    this.wings[1].setRotation(0.5 - Math.sin(_time * 0.01) * 0.4);
  }
}
