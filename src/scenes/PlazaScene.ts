import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Player from '../entities/Player';
import Npc, { type NpcData } from '../entities/Npc';
import Enemy from '../entities/Enemy';
import npcData from '../data/npcs.json';
import questData from '../data/quests.json';
import enemyData from '../data/enemies.json';

interface GridPoint { x: number; y: number; }

interface Quest {
  id: string;
  title: string;
  description: string;
  targetNpcId: string;
  completed: boolean;
}

export default class PlazaScene extends Phaser.Scene {
  private readonly worldWidth = 1600;
  private readonly worldHeight = 1200;
  private readonly tileSize = 32;
  private grid: number[][] = [];
  private easystar: any;
  private player!: Player;
  private npcs: Npc[] = [];
  private enemies: Enemy[] = [];
  private selectedEnemy: Enemy | null = null;
  private dialogueText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private manaFill!: Phaser.GameObjects.Rectangle;
  private spellButton!: Phaser.GameObjects.Container;
  private spellButtonText!: Phaser.GameObjects.Text;
  private quests: Quest[] = [];
  private currentQuestIndex = 0;
  private currentQuestDefeated = 0;
  private enemyAttackTimer = 0;

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

    this.quests = (questData as Array<Record<string, unknown>>).map((quest) => ({
      id: String(quest.id),
      title: String(quest.title),
      description: String(quest.description),
      targetNpcId: String(quest.targetNpcId ?? ''),
      completed: false,
    }));

    this.npcs = (npcData as Array<Record<string, unknown>>).map((npc) => {
      const details: NpcData = {
        id: String(npc.id),
        name: String(npc.name),
        x: Number(npc.x),
        y: Number(npc.y),
        role: npc.role ? String(npc.role) : undefined,
        quest: npc.quest ? String(npc.quest) : undefined,
        event: npc.event ? String(npc.event) : undefined,
      };
      return new Npc(this, details, (selectedNpc) => this.handleNpcInteraction(selectedNpc));
    });

    this.enemies = (enemyData as Array<Record<string, unknown>>).map((enemy) => new Enemy(this, {
      id: String(enemy.id),
      name: String(enemy.name),
      x: Number(enemy.x),
      y: Number(enemy.y),
      hp: Number(enemy.hp),
      maxHp: Number(enemy.maxHp),
      color: Number(enemy.color ?? 0xf87171),
      attackDamage: Number(enemy.attackDamage ?? 8),
    }));

    this.createHud();
    this.createSpellButton();
    this.updateHud();
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.events.on('enemy-target', (enemy: Enemy) => {
      this.selectedEnemy = enemy;
      this.castBasicSpell(enemy);
    });

    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => {
      const target = this.selectedEnemy ?? this.getNearestEnemy();
      if (target) this.castBasicSpell(target);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const clickedEnemy = this.enemies.find((enemy) => enemy.alive && Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, enemy.x, enemy.y) < 28);
      if (clickedEnemy) {
        this.selectedEnemy = clickedEnemy;
        this.castBasicSpell(clickedEnemy);
        return;
      }

      const targetGrid = this.worldToGrid(pointer.worldX, pointer.worldY);
      if (!this.isWalkable(targetGrid.x, targetGrid.y)) return;

      const startGrid = this.worldToGrid(this.player.x, this.player.y);
      const path = this.findPath(startGrid, targetGrid);
      if (path.length > 0) {
        this.player.setPath(path.slice(1).map((point) => ({
          x: (point.x + 0.5) * this.tileSize,
          y: (point.y + 0.5) * this.tileSize,
        })));
      }
    });
  }

  update(time: number, delta: number): void {
    this.player.update(time, delta);
    this.enemyAttackTimer += delta;

    if (this.enemyAttackTimer > 1200) {
      this.enemyAttackTimer = 0;
      this.performEnemyAttacks();
    }

    this.updateSpellButton();
  }

  private createSpellButton(): void {
    const bg = this.add.rectangle(this.scale.width - 150, this.scale.height - 80, 220, 56, 0x1f2937, 0.9);
    bg.setStrokeStyle(2, 0x60a5fa, 1);
    bg.setScrollFactor(0);
    bg.setDepth(100);
    bg.setInteractive();
    bg.on('pointerdown', () => {
      const target = this.selectedEnemy ?? this.getNearestEnemy();
      if (target) {
        this.castBasicSpell(target);
      }
    });

    this.spellButtonText = this.add.text(this.scale.width - 215, this.scale.height - 96, 'Magic Blast', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#f8fafc',
      fontStyle: 'bold',
    });
    this.spellButtonText.setScrollFactor(0);
    this.spellButtonText.setDepth(101);

    this.spellButton = this.add.container(this.scale.width - 150, this.scale.height - 80);
    this.spellButton.add([bg, this.spellButtonText]);
    this.spellButton.setDepth(100);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.spellButton.x = gameSize.width - 150;
      this.spellButton.y = gameSize.height - 80;
      this.spellButtonText.x = -65;
      this.spellButtonText.y = -16;
    });
  }

  private updateSpellButton(): void {
    if (!this.spellButtonText) return;
    const ready = this.player.canCastSpell();
    const label = ready ? 'Magic Blast' : `Magic Blast (${Math.ceil(this.player.cooldownRemaining / 100) / 10}s)`;
    this.spellButtonText.setText(label);
    this.spellButtonText.setColor(ready ? '#f8fafc' : '#fbbf24');
  }

  private performEnemyAttacks(): void {
    const aliveEnemies = this.enemies.filter((enemy) => enemy.alive);
    for (const enemy of aliveEnemies) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (distance < 90) {
        const damage = enemy.attackDamage;
        this.player.hp = Math.max(0, this.player.hp - damage);
        this.dialogueText.setText(`${enemy.name} hits you for ${damage} damage.`);
      }
    }

    if (this.player.hp <= 0) {
      this.player.hp = this.player.maxHp;
      this.dialogueText.setText('You fall, but the Plaza Keeper restores you to full health.');
    }

    this.updateHud();
  }

  private castBasicSpell(enemy: Enemy): void {
    if (!enemy.alive) {
      this.dialogueText.setText('The target has already fallen.');
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
    if (distance > this.player.attackRange) {
      this.dialogueText.setText('You are out of range. Get closer to the target.');
      return;
    }

    if (!this.player.canCastSpell()) {
      this.dialogueText.setText(this.player.mana < this.player.spellCost ? 'Not enough mana for Magic Blast.' : 'Magic Blast is still cooling down.');
      return;
    }

    this.player.mana = Math.max(0, this.player.mana - this.player.spellCost);
    this.player.startSpellCooldown();
    const damage = 18 + Math.floor(Math.random() * 10);
    enemy.damage(damage);
    this.dialogueText.setText(`Magic Blast hits ${enemy.name} for ${damage} damage.`);

    if (!enemy.alive) {
      this.currentQuestDefeated += 1;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 6);
      this.player.mana = Math.min(this.player.maxMana, this.player.mana + 12);
      this.handleCombatQuestProgress();
    }

    this.updateHud();
  }

  private handleCombatQuestProgress(): void {
    const quest = this.quests[this.currentQuestIndex];
    if (!quest || quest.id !== 'slime-clearing') return;

    if (this.currentQuestDefeated >= 2) {
      quest.completed = true;
      this.dialogueText.setText('Quest complete: the first battle is won.');
      this.currentQuestIndex += 1;
      this.currentQuestDefeated = 0;
    } else {
      this.dialogueText.setText(`Defeated ${this.currentQuestDefeated}/2 enemies.`);
    }
  }

  private getNearestEnemy(): Enemy | null {
    const aliveEnemies = this.enemies.filter((enemy) => enemy.alive);
    if (aliveEnemies.length === 0) return null;

    let nearest = aliveEnemies[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of aliveEnemies) {
      const currentDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (currentDistance < bestDistance) {
        bestDistance = currentDistance;
        nearest = enemy;
      }
    }
    return nearest;
  }

  private createHud(): void {
    const panel = this.add.rectangle(190, 112, 350, 184, 0x101827, 0.88);
    panel.setStrokeStyle(2, 0xcaa65a, 0.9).setScrollFactor(0).setDepth(90);

    this.add.text(28, 32, 'WINGED MAGE  •  LV 1', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#f7e7b0', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(100);

    this.add.text(28, 60, 'HP', { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#f8fafc' }).setScrollFactor(0).setDepth(100);
    this.add.rectangle(86, 69, 220, 12, 0x3f1721).setScrollFactor(0).setDepth(95);
    this.hpFill = this.add.rectangle(86, 69, 220, 10, 0xe94b5a).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96);

    this.add.text(28, 84, 'MP', { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#f8fafc' }).setScrollFactor(0).setDepth(100);
    this.add.rectangle(86, 93, 220, 12, 0x142747).setScrollFactor(0).setDepth(95);
    this.manaFill = this.add.rectangle(86, 93, 220, 10, 0x4389ee).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96);

    this.hudText = this.add.text(28, 116, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#e8edf5',
      lineSpacing: 4, wordWrap: { width: 320 },
    }).setScrollFactor(0).setDepth(100);

    this.dialogueText = this.add.text(24, 0, 'Click the plaza to move. Click an enemy or press Space to cast Magic Blast.', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#fff8e6',
      backgroundColor: 'rgba(16, 24, 39, 0.9)', padding: { x: 12, y: 8 },
      wordWrap: { width: 560 },
    }).setScrollFactor(0).setDepth(100);
    this.dialogueText.setY(this.scale.height - 54);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.dialogueText.setY(gameSize.height - 54);
    });
  }

  private updateHud(): void {
    const ratioHp = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    const ratioMana = Phaser.Math.Clamp(this.player.mana / this.player.maxMana, 0, 1);
    this.hpFill.width = 220 * ratioHp;
    this.manaFill.width = 220 * ratioMana;

    const quest = this.quests[this.currentQuestIndex];
    if (quest) {
      const extra = quest.id === 'slime-clearing' ? ` (${this.currentQuestDefeated}/2 defeated)` : '';
      this.hudText.setText(`HP ${this.player.hp}/${this.player.maxHp}   MP ${this.player.mana}/${this.player.maxMana}\n${quest.title}\n${quest.description}${extra}`);
    } else {
      this.hudText.setText(`HP ${this.player.hp}/${this.player.maxHp}   MP ${this.player.mana}/${this.player.maxMana}\nAll plaza quests complete!`);
    }
  }

  private handleNpcInteraction(data: NpcData): void {
    const quest = this.quests[this.currentQuestIndex];
    if (quest && data.id === quest.targetNpcId) {
      quest.completed = true;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
      this.player.mana = Math.min(this.player.maxMana, this.player.mana + 10);
      this.currentQuestIndex += 1;
      this.currentQuestDefeated = 0;

      const nextQuest = this.quests[this.currentQuestIndex];
      if (nextQuest) {
        this.dialogueText.setText(`${data.name}: Thanks for your help. New objective: ${nextQuest.description}`);
      } else {
        this.dialogueText.setText(`${data.name}: The plaza is secure. All available quests are complete!`);
      }
      this.updateHud();
      return;
    }

    if (data.quest) {
      this.dialogueText.setText(`${data.name}: ${data.quest}`);
    } else if (data.event) {
      this.dialogueText.setText(`${data.name}: ${data.event}`);
    } else {
      this.dialogueText.setText(`${data.name}: Welcome to the plaza.`);
    }
  }

  private createGround(): void {
    this.add.rectangle(this.worldWidth / 2, this.worldHeight / 2, this.worldWidth, this.worldHeight, 0x2d6a4f).setDepth(0);
    this.add.rectangle(this.worldWidth / 2, 600, 900, 140, 0x5a6c47).setDepth(1);
    this.add.rectangle(780, 600, 420, 260, 0x48694d).setDepth(2);
    this.add.circle(780, 600, 55, 0x7dd3fc, 0.6).setDepth(3);
    this.add.circle(780, 600, 18, 0xfdf2a3, 1).setDepth(4);

    const flowers = [[260, 260], [1340, 360], [1180, 820], [420, 980]];
    flowers.forEach(([x, y]) => this.add.circle(x, y, 18, 0xf7c948, 0.8).setDepth(4));
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

    this.easystar = new (EasyStar as any).js();
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
    return tileY >= 0 && tileX >= 0 && Boolean(this.grid[tileY]?.[tileX]) && this.grid[tileY][tileX] === 1;
  }

  private worldToGrid(worldX: number, worldY: number): GridPoint {
    return { x: Math.floor(worldX / this.tileSize), y: Math.floor(worldY / this.tileSize) };
  }

  private findPath(start: GridPoint, end: GridPoint): GridPoint[] {
    const result: GridPoint[] = [];
    this.easystar.findPath(start.x, start.y, end.x, end.y, (path: GridPoint[] | null) => {
      if (path) result.push(...path.map(({ x, y }) => ({ x, y })));
    });
    this.easystar.calculate();
    return result;
  }
}
