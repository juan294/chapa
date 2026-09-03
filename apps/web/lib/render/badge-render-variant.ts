/**
 * Cache-key version for the rendered badge artifact.
 *
 * Keep this in an alias-free, dependency-free module so standalone maintenance
 * scripts can share the app's exact cache key without importing the Next.js
 * cache implementation.
 */
export const BADGE_RENDER_VARIANT = "jade-v1";
