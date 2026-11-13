import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import Player from '../entities/Player';
import Npc, { type NpcData } from '../entities/Npc';
import Enemy, { type EnemyData } from '../entities/Enemy';
import npcRows from '../data/npcs.json';
import enemyRows from '../data/enemies.json';
import questRows from '../data/quests.json';

interface Point { x: number; y: number; }
interface Quest { id: string; title: string; description: string; type: 'talk' | 'kill'; targetId: string; targetCount?: number; }
interface SaveData { level: number; xp: number; questIndex: number; defeated: string[]; }

export default class PlazaScene extends Phaser.Scene {
  private readonly worldW = 1800;
  private readonly worldH = 1300;
  private readonly tile = 32;
  private grid: number[][] = [];
  private pathfinder: any;
  private player!: Player;
  private npcs: Npc[] = [];
  private enemies: Enemy[] = [];
  private quests: Quest[] = [];
  private questIndex = 0;
  private killCount = 0;
  private defeated = new Set<string>();
  private selectedEnemy: Enemy | null = null;
  private hud!: Phaser.GameObjects.Text;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private mpFill!: Phaser.GameObjects.Rectangle;
  private xpFill!: Phaser.GameObjects.Rectangle;
  private questText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Container[] = [];
  private attackTimer = 0;
  private autosaveTimer = 0;
  private loadError = false;

  constructor() { super('PlazaScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#15251e');
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    const saved = this.loadSave();
    this.questIndex = Math.min(saved?.questIndex ?? 0, questRows.length);
    this.defeated = new Set(saved?.defeated ?? []);
    this.quests = (questRows as Quest[]).map((q) => ({ ...q }));
    this.drawWorld();
    this.makeGrid();
    this.player = new Player(this, 270, 450, saved);
    this.npcs = (npcRows as NpcData[]).map((row) => new Npc(this, row, (npc) => this.interactNpc(npc)));
    this.enemies = (enemyRows as EnemyData[]).map((row) => {
      const enemy = new Enemy(this, row, (target) => this.selectAndCast(target));
      if (this.defeated.has(row.id)) { enemy.alive = false; enemy.setVisible(false); enemy.disableInteractive(); }
      return enemy;
    });
    this.makeHud();
    this.refreshHud();
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);

    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => this.castMagicBlast());
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.TWO).on('down', () => this.castArcaneBurst());
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.closeDialogue());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleWorldClick(pointer));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.saveProgress());
    if (this.loadError) this.showMessage('Save data was invalid; starting a fresh adventure.');
  }

  update(_time: number, delta: number): void {
    this.player?.update(_time, delta);
    this.attackTimer += delta;
    this.autosaveTimer += delta;
    if (this.attackTimer >= 1000) { this.attackTimer = 0; this.enemyTurn(); }
    if (this.autosaveTimer >= 5000) { this.autosaveTimer = 0; this.saveProgress(); }
    this.refreshHud();
  }

  private drawWorld(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x35694c, 0x35694c, 0x244b39, 0x244b39, 1); g.fillRect(0, 0, this.worldW, this.worldH);
    // Hand-drawn tile pattern made from simple original shapes.
    for (let y = 0; y < this.worldH; y += 64) for (let x = (y % 128 ? 32 : 0); x < this.worldW; x += 64) {
      g.lineStyle(1, 0x8ab174, 0.08); g.strokeRect(x, y, 64, 64);
    }
    g.fillStyle(0x796c52, 1); g.fillRoundedRect(160, 510, 1480, 175, 34);
    g.fillStyle(0x85775a, 1); g.fillRoundedRect(600, 220, 560, 780, 40);
    g.fillStyle(0x48664c, 1); g.fillRoundedRect(600, 480, 560, 280, 24);
    g.lineStyle(6, 0xd0b879, 0.85); g.strokeRoundedRect(600, 480, 560, 280, 24);
    // Fountain.
    this.add.circle(880, 620, 76, 0xdbc88d).setDepth(2);
    this.add.circle(880, 620, 64, 0x54aeb7).setDepth(3);
    this.add.circle(880, 620, 25, 0xb8eef0).setDepth(4);
    this.add.rectangle(880, 604, 12, 42, 0xd5c18d).setDepth(5);
    // Trees and flower beds.
    const trees: Point[] = [{x:170,y:210},{x:430,y:290},{x:1480,y:280},{x:1570,y:850},{x:350,y:1010},{x:1450,y:1080},{x:110,y:850}];
    for (const p of trees) {
      this.add.ellipse(p.x, p.y + 26, 62, 20, 0x14271c).setDepth(p.y);
      this.add.rectangle(p.x, p.y + 8, 15, 47, 0x75563a).setDepth(p.y + 1);
      this.add.circle(p.x, p.y - 10, 37, 0x36734c).setDepth(p.y + 2);
      this.add.circle(p.x - 16, p.y - 20, 20, 0x4c8b58).setDepth(p.y + 3);
      this.add.circle(p.x + 17, p.y - 23, 19, 0x43804f).setDepth(p.y + 4);
    }
    const flowerPts: Point[] = [{x:480,y:500},{x:1240,y:490},{x:480,y:720},{x:1260,y:740},{x:690,y:390},{x:1090,y:850}];
    for (const p of flowerPts) {
      this.add.ellipse(p.x, p.y, 52, 24, 0x28583c).setDepth(p.y);
      for (let i=0;i<5;i++) this.add.circle(p.x + Math.cos(i * 1.25) * 14, p.y + Math.sin(i * 1.25) * 7, 4, i%2 ? 0xf4d484 : 0xe8a9b0).setDepth(p.y+1);
    }
    this.add.text(880, 420, 'FORRESTER PLAZA', { fontFamily: 'serif', fontSize: '19px', color: '#f4e4b7', stroke: '#243c2b', strokeThickness: 4 }).setOrigin(0.5).setDepth(10);
  }

  private makeGrid(): void {
    const cols = Math.ceil(this.worldW / this.tile), rows = Math.ceil(this.worldH / this.tile);
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(1));
    // Block tree trunks / hedge-like flower beds, leaving broad walking lanes.
    for (const p of [{x:170,y:210},{x:430,y:290},{x:1480,y:280},{x:1570,y:850},{x:350,y:1010},{x:1450,y:1080},{x:110,y:850}]) this.blockAt(p.x,p.y,2,2);
    this.pathfinder = new (EasyStar as any).js();
    this.pathfinder.setGrid(this.grid); this.pathfinder.setAcceptableTiles([1]); this.pathfinder.enableSync();
  }

  private blockAt(px: number, py: number, w: number, h: number): void {
    for (let y=Math.floor(py/this.tile)-h; y<=Math.floor(py/this.tile)+h; y++) for (let x=Math.floor(px/this.tile)-w; x<=Math.floor(px/this.tile)+w; x++) if (this.grid[y]?.[x] !== undefined) this.grid[y][x]=0;
  }

  private handleWorldClick(pointer: Phaser.Input.Pointer): void {
    const sx = pointer.x, sy = pointer.y;
    if (sy < 162 || sy > this.scale.height - 65 || sx > this.scale.width - 255) return;
    const x = pointer.worldX, y = pointer.worldY;
    if (this.npcs.some((n) => Math.hypot(n.x-x,n.y-y)<34) || this.enemies.some((e) => e.alive && Math.hypot(e.x-x,e.y-y)<48)) return;
    const start = this.toTile(this.player.x,this.player.y), end = this.toTile(x,y);
    if (!this.grid[end.y]?.[end.x]) return;
    const path: Point[] = [];
    this.pathfinder.findPath(start.x,start.y,end.x,end.y,(nodes: Point[]|null) => { if(nodes) path.push(...nodes); });
    this.pathfinder.calculate();
    if (path.length) this.player.setPath(path.slice(1).map((p) => ({x:(p.x+.5)*this.tile,y:(p.y+.5)*this.tile})));
  }

  private toTile(x:number,y:number):Point { return {x:Math.floor(x/this.tile),y:Math.floor(y/this.tile)}; }

  private selectAndCast(enemy: Enemy): void { this.selectedEnemy = enemy; this.castMagicBlast(); }

  private castMagicBlast(): void {
    const enemy = this.selectedEnemy?.alive ? this.selectedEnemy : this.nearestEnemy();
    if (!enemy) { this.showMessage('No living target.'); return; }
    if (this.distanceTo(enemy) > 310) { this.showMessage('Too far away. Move closer to the target.'); return; }
    if (this.player.spellCooldown > 0 || this.player.mana < 12) { this.showMessage(this.player.mana < 12 ? 'Not enough mana.' : 'Magic Blast is recharging.'); return; }
    this.player.spellCooldown = 850; this.player.mana -= 12;
    this.fireProjectile(enemy, 0x8ce8ff, 12);
    const damage = 18 + (this.player.level-1)*5 + Phaser.Math.Between(0,9);
    enemy.damage(damage); this.showMessage(`Magic Blast hits ${enemy.data.name} for ${damage}.`);
    this.onEnemyDamaged(enemy);
  }

  private castArcaneBurst(): void {
    const enemy = this.selectedEnemy?.alive ? this.selectedEnemy : this.nearestEnemy();
    if (!enemy) { this.showMessage('Choose a target for Arcane Burst.'); return; }
    if (this.distanceTo(enemy) > 230) { this.showMessage('Arcane Burst is out of range.'); return; }
    if (this.player.burstCooldown > 0 || this.player.mana < 24) { this.showMessage(this.player.mana < 24 ? 'Arcane Burst needs 24 mana.' : 'Arcane Burst is recharging.'); return; }
    this.player.burstCooldown = 2600; this.player.mana -= 24;
    const burst = this.add.circle(enemy.x, enemy.y, 14, 0xa57aff, 0.55).setDepth(9000);
    this.tweens.add({targets:burst, scale:7, alpha:0, duration:330, onComplete:()=>burst.destroy()});
    const victims = this.enemies.filter((e)=>e.alive && Phaser.Math.Distance.Between(e.x,e.y,enemy.x,enemy.y)<=115);
    for(const victim of victims) { const damage=32+(this.player.level-1)*7+Phaser.Math.Between(0,8); victim.damage(damage); this.onEnemyDamaged(victim); }
    this.showMessage(`Arcane Burst strikes ${victims.length} target${victims.length===1?'':'s'}!`);
  }

  private fireProjectile(target: Enemy, color: number, radius: number): void {
    const orb=this.add.circle(this.player.x,this.player.y-12,radius,color).setDepth(9000);
    this.tweens.add({targets:orb,x:target.x,y:target.y,duration:190,onComplete:()=>orb.destroy()});
  }

  private onEnemyDamaged(enemy:Enemy):void {
    if(!enemy.alive){
      this.defeated.add(enemy.data.id);
      const levelled=this.player.gainXp(enemy.data.xpReward??25);
      if(levelled) this.showMessage(`Level up! You are now level ${this.player.level}.`);
      this.player.hp=Math.min(this.player.maxHp,this.player.hp+7);
      this.player.mana=Math.min(this.player.maxMana,this.player.mana+12);
      this.selectedEnemy=null;
      if(enemy.data.boss) { this.questIndex=this.quests.length; this.showMessage('The Shadow Warden is defeated. The plaza is safe!'); }
      this.advanceKillQuest(enemy);
      this.saveProgress();
    }
    this.refreshHud();
  }

  private advanceKillQuest(enemy:Enemy):void {
    const quest=this.quests[this.questIndex];
    if(!quest||quest.type!=='kill') return;
    if(quest.targetId && enemy.data.id!==quest.targetId) return;
    this.killCount++;
    if(this.killCount >= (quest.targetCount??1)) { this.questIndex++; this.killCount=0; this.showMessage(`Quest complete: ${quest.title}`); }
  }

  private interactNpc(npc:NpcData):void {
    const quest=this.quests[this.questIndex];
    if(quest?.type==='talk'&&quest.targetId===npc.id){
      this.questIndex++; this.showMessage(`${npc.name}: Thank you, adventurer. I have another task for you.`); this.refreshHud(); this.saveProgress(); return;
    }
    this.showMessage(npc.quest ? `${npc.name}: ${npc.quest}` : npc.event ? `${npc.name}: ${npc.event}` : `${npc.name}: Welcome to the plaza.`);
  }

  private enemyTurn():void {
    const aggressors=this.enemies.filter((e)=>e.alive&&this.distanceTo(e)<85);
    if(!aggressors.length) return;
    const damage=aggressors.reduce((sum,e)=>sum+(e.data.attackDamage??6),0);
    this.player.hp=Math.max(0,this.player.hp-damage);
    this.showMessage(`${aggressors.length>1?'Enemies attack':'An enemy attacks'} for ${damage} damage.`);
    if(this.player.hp===0){ this.player.hp=this.player.maxHp; this.player.mana=this.player.maxMana; this.player.setPosition(270,450); this.player.setPath([]); this.showMessage('You were rescued and returned to the plaza.'); }
    this.refreshHud();
  }

  private distanceTo(enemy:Enemy):number{return Phaser.Math.Distance.Between(this.player.x,this.player.y,enemy.x,enemy.y);}
  private nearestEnemy():Enemy|null { return this.enemies.filter(e=>e.alive).sort((a,b)=>this.distanceTo(a)-this.distanceTo(b))[0]??null; }

  private makeHud():void {
    const fixed=(obj:Phaser.GameObjects.GameObject)=>obj.setScrollFactor(0).setDepth(10000);
    const panel=this.add.rectangle(184,87,330,142,0x101a18,.92).setStrokeStyle(2,0xc6a866,.8); fixed(panel);
    fixed(this.add.text(28,22,'WINGED MAGE',{fontFamily:'serif',fontSize:'18px',color:'#f7e6b6',fontStyle:'bold'}));
    this.hud=this.add.text(28,50,'',{fontFamily:'system-ui',fontSize:'12px',color:'#eff5e9',lineSpacing:3});fixed(this.hud);
    this.add.text(28,102,'HP',{fontSize:'10px',color:'#fff'}).setScrollFactor(0).setDepth(10001);
    const hpbg=this.add.rectangle(67,109,245,9,0x452331);fixed(hpbg); this.hpFill=this.add.rectangle(67,109,245,7,0xe85261).setOrigin(0,.5);fixed(this.hpFill);
    this.add.text(28,117,'MP',{fontSize:'10px',color:'#fff'}).setScrollFactor(0).setDepth(10001);
    const mpbg=this.add.rectangle(67,124,245,9,0x1b3555);fixed(mpbg); this.mpFill=this.add.rectangle(67,124,245,7,0x4e9bec).setOrigin(0,.5);fixed(this.mpFill);
    const qpanel=this.add.rectangle(this.scale.width-170,88,300,130,0x101a18,.92).setStrokeStyle(2,0xc6a866,.8);fixed(qpanel);
    this.questText=this.add.text(this.scale.width-300,35,'',{fontFamily:'system-ui',fontSize:'13px',color:'#f2e8cc',wordWrap:{width:260},lineSpacing:4});fixed(this.questText);
    this.xpFill=this.add.rectangle(0,this.scale.height-13,1,6,0xe3bd5c).setOrigin(0,.5);fixed(this.xpFill);
    const xpbg=this.add.rectangle(this.scale.width/2,this.scale.height-13,this.scale.width,6,0x222522).setDepth(9999).setScrollFactor(0);
    this.xpFill.setDepth(10000);
    this.message=this.add.text(24,0,'Click the ground to move. Click an NPC to talk; click an enemy to attack.',{fontFamily:'system-ui',fontSize:'14px',color:'#fff5da',backgroundColor:'#111a18e8',padding:{x:12,y:9},wordWrap:{width:600}}).setScrollFactor(0).setDepth(10001);
    this.positionMessage();
    this.scale.on('resize',()=>{qpanel.setX(this.scale.width-170);this.questText.setX(this.scale.width-300);xpbg.setX(this.scale.width/2);xpbg.width=this.scale.width;this.positionMessage();this.layoutButtons();});
    this.makeSpellButton('Magic Blast','SPACE',this.scale.width-250,this.scale.height-74,()=>this.castMagicBlast());
    this.makeSpellButton('Arcane Burst [2]','2',this.scale.width-112,this.scale.height-74,()=>this.castArcaneBurst());
  }

  private makeSpellButton(name:string,key:string,x:number,y:number,action:()=>void):void {
    const container=this.add.container(x,y).setScrollFactor(0).setDepth(10002);
    const bg=this.add.rectangle(0,0,124,52,0x202d35,.96).setStrokeStyle(2,0x9d7fe0,1).setInteractive({useHandCursor:true});
    const label=this.add.text(0,-5,name,{fontFamily:'system-ui',fontSize:'12px',color:'#fff',fontStyle:'bold'}).setOrigin(.5);
    const hotkey=this.add.text(0,14,`[${key}]`,{fontFamily:'system-ui',fontSize:'10px',color:'#d9c8ff'}).setOrigin(.5);
    container.add([bg,label,hotkey]); bg.on('pointerdown',action); this.buttons.push(container);
  }

  private layoutButtons():void { this.buttons.forEach((b,i)=>{b.x=this.scale.width-250+i*138;b.y=this.scale.height-74;}); }
  private positionMessage():void { if(this.message) this.message.setPosition(20,this.scale.height-68); }

  private refreshHud():void {
    if(!this.player||!this.hud) return;
    this.hud.setText(`Level ${this.player.level}    XP ${this.player.xp}/${this.player.xpNext}\nForrester Plaza`);
    this.hpFill.width=245*this.player.hp/this.player.maxHp;
    this.mpFill.width=245*this.player.mana/this.player.maxMana;
    const quest=this.quests[this.questIndex];
    if(quest){
      const progress=quest.type==='kill'?`\nProgress: ${this.killCount}/${quest.targetCount??1}`:'';
      this.questText.setText(`ACTIVE QUEST\n${quest.title}\n${quest.description}${progress}`);
    }else this.questText.setText('PLAZA STORY\nAll current objectives complete.\nExplore and practice your spells.');
    const xpRatio=this.player.xp/this.player.xpNext;
    this.xpFill.width=this.scale.width*xpRatio;
    this.children.list.filter((o:any)=>o instanceof Phaser.GameObjects.Text && (o.text==='Magic Blast'||String(o.text).startsWith('Magic Blast ('))).forEach((o:any)=>o.setText(this.player.spellCooldown?`Magic Blast (${(this.player.spellCooldown/1000).toFixed(1)}s)`:'Magic Blast'));
    this.children.list.filter((o:any)=>o instanceof Phaser.GameObjects.Text && (o.text==='Arcane Burst [2]'||String(o.text).startsWith('Arcane Burst ('))).forEach((o:any)=>o.setText(this.player.burstCooldown?`Arcane Burst (${(this.player.burstCooldown/1000).toFixed(1)}s)`:'Arcane Burst [2]'));
  }

  private showMessage(text:string):void { if(this.message) this.message.setText(text); }
  private closeDialogue():void { this.showMessage('Click the ground to move. Click an NPC to talk; click an enemy to attack.'); }

  private loadSave():SaveData|undefined {
    try { const raw=localStorage.getItem('wod-web-prototype-save-v1'); return raw?JSON.parse(raw) as SaveData:undefined; }
    catch { this.loadError=true; localStorage.removeItem('wod-web-prototype-save-v1'); return undefined; }
  }
  private saveProgress():void {
    if(!this.player) return;
    const data:SaveData={level:this.player.level,xp:this.player.xp,questIndex:this.questIndex,defeated:[...this.defeated]};
    try { localStorage.setItem('wod-web-prototype-save-v1',JSON.stringify(data)); } catch { this.showMessage('Could not save progress in this browser.'); }
  }
}
