const express = require('express');
const { getAdapter } = require('../adapters');

const router = express.Router();

router.get('/search', async (req, res, next) => {
  const {
    q, source, page, limit,
    departmentId, isHighlight, isOnView, medium,
    dateBegin, dateEnd, geoLocation, searchIn,
    artworkType, placeOfOrigin,
  } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Query parameter q is required', code: 'MISSING_QUERY' });
  }
  if (!source) {
    return res.status(400).json({ error: 'Query parameter source is required', code: 'MISSING_SOURCE' });
  }

  try {
    const adapter = getAdapter(source);

    const options = {
      page: Math.max(0, parseInt(page) || 0),
      limit: Math.min(Math.max(1, parseInt(limit) || 20), 40),
    };

    // Source-specific filter params — adapters ignore options they don't recognise
    if (departmentId) options.departmentId = parseInt(departmentId);
    if (isHighlight === 'true') options.isHighlight = true;
    if (isOnView === 'true') options.isOnView = true;
    if (medium) options.medium = medium;
    if (dateBegin && dateEnd) {
      options.dateBegin = parseInt(dateBegin);
      options.dateEnd = parseInt(dateEnd);
    }
    if (geoLocation) options.geoLocation = geoLocation;
    if (searchIn) options.searchIn = searchIn;
    // ARTIC-specific
    if (artworkType) options.artworkType = artworkType;
    if (placeOfOrigin) options.placeOfOrigin = placeOfOrigin;

    const data = await adapter.search(q.trim(), options);
    res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    next(err);
  }
});

router.get('/search/artwork-types', async (req, res, next) => {
  const { source } = req.query;
  if (!source) {
    return res.status(400).json({ error: 'Query parameter source is required', code: 'MISSING_SOURCE' });
  }
  try {
    const adapter = getAdapter(source);
    if (typeof adapter.getArtworkTypes !== 'function') return res.json([]);
    const types = await adapter.getArtworkTypes();
    res.json(types);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    next(err);
  }
});

router.get('/search/departments', async (req, res, next) => {
  const { source } = req.query;
  if (!source) {
    return res.status(400).json({ error: 'Query parameter source is required', code: 'MISSING_SOURCE' });
  }
  try {
    const adapter = getAdapter(source);
    if (typeof adapter.getDepartments !== 'function') return res.json([]);
    const departments = await adapter.getDepartments();
    res.json(departments);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    next(err);
  }
});

module.exports = router;
