// Utility to log detailed information about analysis counters and image states
// This is a debug-only file that will be excluded from production builds

/**
 * Calculate detailed counters for the images in the app
 * @param {Array} captures - Array of all image captures
 * @param {Set} imagesSentForAnalysis - Set of image URIs currently being analyzed
 * @returns {Object} Object containing various counter values
 */
export const calculateCounters = (captures, imagesSentForAnalysis) => {
  // Basic counts
  const totalImages = captures.length;
  const analyzedCount = captures.filter(img => img.analyzed).length;
  const unanalyzedCount = captures.filter(img => !img.analyzed).length;
  const inProgressCount = captures.filter(img => imagesSentForAnalysis.has(img.uri)).length;
  
  // Count images needing analysis (not analyzed AND not being processed)
  const pendingManualCount = captures.filter(img => 
    !img.analyzed && 
    !imagesSentForAnalysis.has(img.uri)
  ).length;

  // Previous definition was the same now
  const pendingOldCount = pendingManualCount;
  
  return {
    totalImages,
    analyzedCount,
    unanalyzedCount,
    inProgressCount,
    pendingManualCount,  // New definition (red circle counter)
    pendingOldCount      // Old definition (now the same)
  };
};

/**
 * Log detailed counter information
 * @param {Object} counters - Counter object from calculateCounters
 * @param {string} source - Source of the log call for tracing
 */
export const logCounting = (counters, source) => {
  console.log(`\n[COUNTER DEBUG] ${source} ===== Counter Analysis =====`);
  console.log(`Total images: ${counters.totalImages}`);
  console.log(`Analyzed: ${counters.analyzedCount}, Unanalyzed: ${counters.unanalyzedCount}`);
  console.log(`In progress analyses: ${counters.inProgressCount}`);
  console.log(`Pending (not analyzed, not in progress): ${counters.pendingManualCount} <-- RED CIRCLE COUNTER`);
  console.log(`==============================\n`);
};

/**
 * Log the state of each image for detailed debugging
 * @param {Array} captures - Array of all image captures
 * @param {Set} imagesSentForAnalysis - Set of image URIs currently being analyzed
 */
export const logImageStates = (captures, imagesSentForAnalysis) => {
  console.log(`\n[IMAGE DEBUG] ===== Individual Image States =====`);
  captures.forEach((img, index) => {
    const shortUri = img.uri.substring(0, 20) + '...';
    const analyzed = img.analyzed ? 'YES' : 'NO';
    const inProgress = imagesSentForAnalysis.has(img.uri) ? 'YES' : 'NO';
    // Whether this image contributes to the red circle count
    const pendingManual = !img.analyzed && !imagesSentForAnalysis.has(img.uri) ? 'YES' : 'NO';
    
    console.log(`Image ${index+1} (${shortUri}):`);
    console.log(`  Analyzed: ${analyzed}, In Progress: ${inProgress}`);
    console.log(`  Red Circle Count: ${pendingManual}`);
    console.log(`  ---------`);
  });
  console.log(`=======================================\n`);
};