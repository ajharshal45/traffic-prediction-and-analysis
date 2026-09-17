/**
 * Normalizes a pathId by replacing en-dashes (–) with standard hyphens (-).
 * This fixes data inconsistencies where duplicates were created due to typography.
 * 
 * @param {string} pathId - The pathId to normalize
 * @returns {string} The normalized pathId
 */
export const normalizePathId = (pathId) => {
  if (!pathId) return pathId;
  // Replace en-dash (U+2013) with hyphen-minus (U+002D)
  return pathId.replace(/–/g, '-');
};
