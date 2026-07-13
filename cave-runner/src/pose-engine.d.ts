export class PoseEngine extends EventTarget {
  tracking: boolean;

  constructor(videoEl: HTMLVideoElement);

  init(): Promise<void>;

  start(): void;
}
