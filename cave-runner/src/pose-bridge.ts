/** Module-level PoseEngine reference — set from main orchestration once camera/tracking boots (Task 3). */
export let poseEngine: EventTarget | null = null;

export function setPoseEngine(engine: EventTarget | null) {
  poseEngine = engine;
}
