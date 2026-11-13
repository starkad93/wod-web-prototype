import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Player from '../entities/Player';
import Npc from '../entities/Npc';
import npcData from '../data/npcs.json';

interface GridPoint {
  x: number;
  y: number;
}

export default class PlazaScene extends Phaser.Scene {
  private readonly worldWidth = 1600;
  private readonly worldHeight = 1200;
  private readonly tileSize = 32;
  private grid: number[][] = [];
  private easystar!: EasyStar.js;
  private player!: Player;
  private npcs: Npc[] = [];
  private dialogueText!: Phaser.GameObjects.Text;

  constructor() {
    super('PlazaScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#243b38');
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    this.createGround();
    this.setupNavigationGrid();

    this.player = new Player(this, 260, 420);
    this.player.setDepth(20);

    this.npcs = (npcData as Array<Record<string, unknown>>).map((npc) => {
      return new Npc(this, {
        id: String(npc.id),
        name: String(npc.name),
        x: Number(npc.x),
        y: Number(npc.y),
        role: npc.role ? String(npc.role) : undefined,
        quest: npc.quest ? String(npc.quest) : undefined,
        event: npc.event ? String(npc.event) : undefined,
      });
    });

    this.dialogueText = this.add.text(24, 20, 'Click on the plaza to walk.', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f8fafc',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      padding: { x: 10, y: 6 },
    });
    this.dialogueText.setScrollFactor(0);
    this.dialogueText.setDepth(100);

    this.events.on('dialogue', (message: string) => {
      this.dialogueText.setText(message);
    });

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;
      const targetGrid = this.worldToGrid(worldX, worldY);

      if (!this.isWalkable(targetGrid.x, targetGrid.y)) {
        return;
      }

      const startGrid = this.worldToGrid(this.player.x, this.player.y);
      const path = this.findPath(startGrid, targetGrid);

      if (path.length > 0) {
        const worldPath = path.slice(1).map((point) => ({
          x: (point.x + 0.5) * this.tileSize,
          y: (point.y + 0.5) * this.tileSize,
        }));

        this.player.setPath(worldPath);
      }
    });
  }

  private createGround(): void {
    const ground = this.add.rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0x2d6a4f);
    ground.setDepth(0);

    const stoneRoad = this.add.rectangle(this.worldWidth / 2, 600, 900, 140, 0x5a6c47);
    stoneRoad.setDepth(1);

    const plazaSquare = this.add.rectangle(780, 600, 420, 260, 0x48694d);
    plazaSquare.setDepth(2);

    const fountain = this.add.circle(780, 600, 55, 0x7dd3fc, 0.6);
    fountain.setDepth(3);

    const fountainCore = this.add.circle(780, 600, 18, 0xfdf2a3, 1);
    fountainCore.setDepth(4);

    const flowerA = this.add.circle(260, 260, 18, 0xf7c948, 0.8);
    const flowerB = this.add.circle(1340, 360, 18, 0xf7c948, 0.8);
    const flowerC = this.add.circle(1180, 820, 18, 0xf7c948, 0.8);
    const flowerD = this.add.circle(420, 980, 18, 0xf7c948, 0.8);

    [flowerA, flowerB, flowerC, flowerD].forEach((flower) => flower.setDepth(4));
  }

  private setupNavigationGrid(): void {
    const cols = Math.ceil(this.worldWidth / this.tileSize);
    const rows = Math.ceil(this.worldHeight / this.tileSize);

    this.grid = Array.from({ length: rows }, () => Array(cols).fill(1));

    this.blockRect(14, 12, 8, 7);
    this.blockRect(29, 5, 7, 5);
    this.blockRect(28, 22, 8, 6);
    this.blockRect(9, 28, 8, 5);
    this.blockRect(20, 17, 3, 3);

    this.easystar = new EasyStar.js();
    this.easystar.setGrid(this.grid);
    this.easystar.setAcceptableTiles([1]);
    this.easystar.enableSync();
  }

  private blockRect(gridX: number, gridY: number, width: number, height: number): void {
    for (let y = gridY; y < gridY + height; y += 1) {
      for (let x = gridX; x < gridX + width; x += 1) {
        if (y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[0].length) {
          this.grid[y][x] = 0;
        }
      }
    }
  }

  private isWalkable(tileX: number, tileY: number): boolean {
    if (tileY < 0 || tileX < 0) {
      return false;
    }
    if (!this.grid[tileY] || !this.grid[tileY][tileX]) {
      return false;
    }
    return this.grid[tileY][tileX] === 1;
  }

  private worldToGrid(worldX: number, worldY: number): GridPoint {
    return {
      x: Math.floor(worldX / this.tileSize),
      y: Math.floor(worldY / this.tileSize),
    };
  }

  private findPath(start: GridPoint, end: GridPoint): Array<GridPoint> {
    const result: Array<GridPoint> = [];

    this.easystar.findPath(start.x, start.y, end.x, end.y, (path: Array<{ x: number; y: number }> | null) => {
      if (path && path.length > 0) {
        path.forEach((node) => {
          result.push({ x: node.x, y: node.y });
        });
      }
    });

    this.easystar.calculate();
    return result;
  }
}
