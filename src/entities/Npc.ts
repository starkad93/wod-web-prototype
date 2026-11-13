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
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, data: NpcData, onInteract?: (npcData: NpcData) => void) {
    super(scene, data.x, data.y);

    const body = scene.add.rectangle(0, 0, 20, 24, 0x7c3aed, 1);
    const head = scene.add.circle(0, -10, 8, 0xf3d7aa, 1);
    const halo = scene.add.circle(0, -18, 12, 0x7dd3fc, 0.28);

    this.label = scene.add.text(0, -30, data.name, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f8fafc',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      padding: { x: 6, y: 2 },
    });
    this.label.setOrigin(0.5);

    this.add([halo, body, head, this.label]);
    this.setDepth(10);
    scene.add.existing(this);

    this.setSize(32, 32);
    this.setInteractive();

    this.on('pointerdown', () => {
      if (onInteract) {
        onInteract(data);
      }
      scene.events.emit('npc-interact', data);
    });
  }
}
