import type { Car } from './cars';

/** Start a new listing with the source's details and the draft's own photos. */
export function applyCarTemplate(draft: Car, source: Car): Car {
  const { version: _version, ...details } = source;
  return structuredClone({ ...details, id: draft.id, image: draft.image, gallery: draft.gallery });
}
