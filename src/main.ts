import Phaser from 'phaser';
import PlazaScene from './scenes/PlazaScene';
import './styles.css';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 800,
  backgroundColor: '#15251e',
  render: { antialias: true, pixelArt: false },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [PlazaScene],
});

window.addEventListener('beforeunload', () => game.destroy(true));
