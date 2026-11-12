// The sort. Cheapest step that can decide wins, and only what is left moves on:
//   keywords  clinical or urgent words: to the responder, no model.
//   keywords  routine words (price, booking, a treatment name) and nothing clinical: routine.
//   model     only what is left, and only when the clinic's adapter is on. Unsure is unclear.
//   people    unclear goes to the responder.
// Every result says which step decided, so the Friday review can show how often the model earned its place.

import { clinicalMatches, routineMatches, fitAnswers } from './keywords.js';

export async function sortEnquiry(text, { config, ai } = {}) {
  const extraClinical = (config && config.keywords && config.keywords.extraClinical) || [];
  const extraRoutine = (config && config.keywords && config.keywords.extraRoutine) || [];
  const fit = fitAnswers(text);

  const clinical = clinicalMatches(text, extraClinical);
  if (clinical.length) {
    return { label: 'clinical', decidedBy: 'keywords', reason: `clinical or urgent words: ${clinical.join(', ')}`, matched: clinical, fit };
  }

  const routine = routineMatches(text, extraRoutine);
  if (routine.length) {
    return { label: 'routine', decidedBy: 'keywords', reason: `routine words: ${routine.slice(0, 4).join(', ')}`, matched: routine, fit };
  }

  if (ai && ai.enabled) {
    const verdict = await ai.classify({ text });
    if (verdict && verdict.label === 'routine' && verdict.confidence >= (config.ai.confidenceFloor ?? 0.8)) {
      return {
        label: 'routine',
        decidedBy: 'model',
        reason: `model: routine (${Math.round(verdict.confidence * 100)}%)`,
        matched: [],
        fit: { ...fit, ...(verdict.fit || {}) },
      };
    }
    const why = verdict ? `model unsure (${verdict.label || 'no label'}, ${Math.round((verdict.confidence || 0) * 100)}%)` : 'model gave no answer';
    return { label: 'unclear', decidedBy: 'model', reason: why, matched: [], fit };
  }

  return { label: 'unclear', decidedBy: 'keywords', reason: 'no routine words and no clinical words; model off', matched: [], fit };
}
