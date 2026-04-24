require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./db/knex');
const searchRoutes = require('./routes/search');
const imageRoutes = require('./routes/images');
const projectRoutes = require('./routes/projects');
const { router: templateRoutes, TEMPLATES_DIR } = require('./routes/templates');
const previewRoutes = require('./routes/preview');
const pageRoutes = require('./routes/pages');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;
const STORAGE_DIR = path.resolve(__dirname, process.env.STORAGE_PATH || '../storage');

// Ensure storage directories exist
['originals', 'variants'].forEach((dir) => {
  fs.mkdirSync(path.join(STORAGE_DIR, dir), { recursive: true });
});

app.use(cors());
app.use(express.json());

// Serve stored images
app.use('/storage', express.static(STORAGE_DIR));

// Serve template files (CSS, JS referenced from preview HTML)
app.use('/templates', express.static(TEMPLATES_DIR));

// API routes
app.use('/api', searchRoutes);
app.use('/api', imageRoutes);
app.use('/api', projectRoutes);
app.use('/api', templateRoutes);
app.use('/api', pageRoutes);
app.use('/api', exportRoutes);

// Preview (non-API — returns full HTML documents)
app.use(previewRoutes);

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.resolve(__dirname, '../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// Error handler — all API errors return { error, code }
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error', code: err.code || 'INTERNAL_ERROR' });
});

// Run migrations then start
db.migrate.latest()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Fresco server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
