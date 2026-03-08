function parseStateParam(stateStr) {
  if (!stateStr) return null;

  try {
    let decoded = stateStr;
    try {
      decoded = decodeURIComponent(stateStr);
    } catch {
      // already decoded, use as-is
    }

    const state = JSON.parse(decoded);

    const ids = state.ids || state.exportIds;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return null;
    }

    return {
      fileId: ids[0],
      userId: state.userId || null,
    };
  } catch {
    return null;
  }
}

module.exports = { parseStateParam };
