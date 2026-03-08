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

    if (!state.ids || !Array.isArray(state.ids) || state.ids.length === 0) {
      return null;
    }

    return {
      fileId: state.ids[0],
      userId: state.userId || null,
    };
  } catch {
    return null;
  }
}

module.exports = { parseStateParam };
