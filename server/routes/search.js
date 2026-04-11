const express = require('express');
const { getAdapter } = require('../adapters');

const router = express.Router();

router.get('/search', async (req, res, next) => {
  const { q, source } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Query parameter q is required', code: 'MISSING_QUERY' });
  }
  if (!source) {
    return res.status(400).json({ error: 'Query parameter source is required', code: 'MISSING_SOURCE' });
  }

  try {
    const adapter = getAdapter(source);
    const results = await adapter.search(q.trim());
    res.json(results);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    next(err);
  }
});

module.exports = router;
