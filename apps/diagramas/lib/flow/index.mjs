/**
 * Lib compartida swimlane-flow (puro, sin DOM).
 */

export * from './schema.mjs';
export { normalizeFlow, modeloVacioFlow } from './normalize.mjs';
export { autoPlace } from './autoplace.mjs';
export {
  laneGeometry,
  phaseGeometry,
  contentWidth,
  absolutePosition,
  placeFromAbsolute,
  phaseAt,
  colOf,
  slotOf,
  minLaneHeight,
} from './geometry.mjs';
export { lintFlow } from './lint.mjs';
export { fromCarriles, toCarriles } from './convert.mjs';
export {
  addNode,
  addNodeAfter,
  moveNodes,
  resizeNode,
  updateNode,
  deleteElements,
  addEdge,
  reconnectEdge,
  updateEdge,
  reverseEdge,
  addLane,
  updateLane,
  moveLane,
  deleteLane,
  addPhase,
  updatePhase,
  movePhase,
  deletePhase,
  pasteNodes,
  duplicateNodes,
  alignNodes,
  distributeNodes,
} from './edit.mjs';
export { toText } from './totext.mjs';
export { toNarrative } from './narrative.mjs';
export { buildFlowAiPrompt } from './aiprompt.mjs';
export { EXAMPLE_MINI, EXAMPLE_ARRIENDO } from './examples.mjs';
