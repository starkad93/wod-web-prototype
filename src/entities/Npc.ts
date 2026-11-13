import Phaser from 'phaser';

export interface NpcData {
  id: string;
  name: string;
  x: number;
  y: number;
  role?: string;
  quest?: string;
  event?: string;
}

export default class Npc extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, data: NpcData, onInteract: (npc: NpcData) => void) {
    super(scene, data.x, data.y);
    const shadow = scene.add.ellipse(0, 17, 30, 9, 0x07130d, 0.35);
    const robe = scene.add.ellipse(0, 2, 24, 31, 0x7653a6);
    const trim = scene.add.arc(0, 2, 12, 200, 340, false, 0xf3d18a).setStrokeStyle(3, 0xf3d18a);
    const head = scene.add.circle(0, -17, 9, 0xf1c9a5);
    const marker = scene.add.text(0, -52, '◆', { fontSize: '17px', color: '#f6d36b' }).setOrigin(0.5);
    const label = scene.add.text(0, -39, data.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#fff8e6',
      backgroundColor: '#18251ddd', padding: { x: 5, y: 3 },
    }).setOrigin(0.5);
    this.add([shadow, robe, trim, head, marker, label]);
    scene.add.existing(this);
    this.setDepth(data.y);
    this.setSize(38, 42);
    this.setInteractive(new Phaser.Geom.Rectangle(-19, -25, 38, 50), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => onInteract(data));
  }
}
