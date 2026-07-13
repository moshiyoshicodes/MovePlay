import { WebGLRenderer, PerspectiveCamera } from 'three';

import { PoseEngine } from './pose-engine.js';
import { runCalibration } from './calibration.js';
import { setPoseEngine } from './pose-bridge';

import RunningScene from './scenes/RunningScene';
import MainMenuScene from './scenes/MainMenuScene';
import CharacterSelectionScene from './scenes/CharacterSelectionScene';

const $ = (id: string) => document.getElementById(id);

const width = window.innerWidth;
const height = window.innerHeight;

const renderer = new WebGLRenderer({
  canvas: document.getElementById('app') as HTMLCanvasElement,
  antialias: true,
  precision: 'mediump',
});

renderer.setSize(width, height);

let currentScene: MainMenuScene | RunningScene | CharacterSelectionScene;

const mainCamera = new PerspectiveCamera(60, width / height, 0.1, 1000);

function onWindowResize() {
  mainCamera.aspect = window.innerWidth / window.innerHeight;
  mainCamera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

const runningScene = new RunningScene();
const mainMenuScene = new MainMenuScene();
const characterSelectionScene = new CharacterSelectionScene();

const video = $('cam') as HTMLVideoElement;

let engine: PoseEngine | null = null;
let calibrated = false;
let trackingPausedGame = false;
let trackingOkSince = 0;
let trackingListener: ((e: Event) => void) | null = null;

function showCalibrationScreen() {
  $('screen-calibrate')?.classList.add('active');
}

function hideCalibrationScreen() {
  $('screen-calibrate')?.classList.remove('active');
}

function showPoseError(msg: string) {
  const el = $('pose-error') as HTMLElement;
  el.textContent = msg;
  el.hidden = false;
}

function clearPoseError() {
  const el = $('pose-error') as HTMLElement;
  el.textContent = '';
  el.hidden = true;
}

function showTrackingLost() {
  ($('tracking-lost') as HTMLElement).hidden = false;
}

function hideTrackingLost() {
  ($('tracking-lost') as HTMLElement).hidden = true;
}

function bindTrackingListener() {
  if (!engine || trackingListener) return;

  trackingListener = (e: Event) => {
    if (currentScene !== runningScene || !engine) return;

    const { ok } = (e as CustomEvent<{ ok: boolean }>).detail;

    if (!ok) {
      if (!trackingPausedGame) {
        runningScene.setPaused(true);
        trackingPausedGame = true;
      }
      showTrackingLost();
      trackingOkSince = 0;
    } else {
      trackingOkSince = performance.now();
      setTimeout(() => {
        if (
          trackingOkSince
          && performance.now() - trackingOkSince >= 780
          && engine?.tracking
          && currentScene === runningScene
        ) {
          hideTrackingLost();
          if (trackingPausedGame) {
            runningScene.setPaused(false);
            trackingPausedGame = false;
          }
        }
      }, 800);
    }
  };

  engine.addEventListener('tracking', trackingListener);
}

async function bootCamera(): Promise<boolean> {
  clearPoseError();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    const denied = err instanceof DOMException && err.name === 'NotAllowedError';
    showPoseError(
      denied
        ? 'Camera blocked — playing with keyboard/touch only. Allow camera access to use motion controls.'
        : 'Camera unavailable — playing with keyboard/touch only. Use HTTPS and ensure no other app is using the camera.',
    );
    return false;
  }

  try {
    engine = new PoseEngine(video);
    await engine.init();
    engine.start();
    setPoseEngine(engine);
    bindTrackingListener();
    return true;
  } catch {
    showPoseError('Motion tracking failed to load — playing with keyboard/touch only. Check your connection and refresh.');
    engine = null;
    setPoseEngine(null);
    return false;
  }
}

const switchToRunningScene = () => {
  currentScene.hide();
  currentScene = runningScene;
  currentScene.initialize();
};

const switchToMainMenuScene = () => {
  hideTrackingLost();
  if (trackingPausedGame) {
    runningScene.setPaused(false);
    trackingPausedGame = false;
  }
  currentScene.hide();
  currentScene = mainMenuScene;
  currentScene.initialize();
};

const switchToCharacterSelectionScene = () => {
  currentScene.hide();
  currentScene = characterSelectionScene;
  currentScene.initialize();
};

async function startPlayFlow() {
  const playBtn = $('play-game-button') as HTMLButtonElement;
  playBtn.disabled = true;

  if (!engine) {
    await bootCamera();
  }

  if (engine && !calibrated) {
    showCalibrationScreen();
    await runCalibration(engine, video);
    hideCalibrationScreen();
    calibrated = true;
  }

  switchToRunningScene();
  playBtn.disabled = false;
}

($('play-game-button') as HTMLInputElement).onclick = () => {
  startPlayFlow();
};

($('quit-button') as HTMLInputElement).onclick = () => {
  (document.getElementById('game-over-modal') as HTMLInputElement).style.display = 'none';
  switchToMainMenuScene();
};

($('game-over-quit-button') as HTMLInputElement).onclick = () => {
  (document.getElementById('game-over-modal') as HTMLInputElement).style.display = 'none';
  switchToMainMenuScene();
};

currentScene = mainMenuScene;
const render = () => {
  currentScene.update();
  renderer.render(currentScene, mainCamera);
  requestAnimationFrame(render);
};

($('Characters-selection-button') as HTMLInputElement).onclick = () => {
  switchToCharacterSelectionScene();
};
(document.querySelector('.home-menu') as HTMLInputElement).onclick = () => {
  switchToMainMenuScene();
};

const main = async () => {
  hideTrackingLost();
  await runningScene.load();
  await mainMenuScene.load();
  await characterSelectionScene.load();
  (document.querySelector('.loading-container') as HTMLInputElement).style.display = 'none';
  currentScene.initialize();
  render();
};

main();
