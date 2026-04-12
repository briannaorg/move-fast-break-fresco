const met = require('./met/adapter');
const artic = require('./artic/adapter');
const nypl = require('./nypl/adapter');

const adapters = { met, artic, nypl };

function getAdapter(sourceId) {
  const adapter = adapters[sourceId];
  if (!adapter) throw Object.assign(new Error(`Unknown source: ${sourceId}`), { status: 400, code: 'UNKNOWN_SOURCE' });
  return adapter;
}

module.exports = { adapters, getAdapter };
