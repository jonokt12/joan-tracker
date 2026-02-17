const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();

// Get port from CLI argument
const port = process.argv[2] || 3000;

// Data directory - configurable via environment variable
const DATA_DIR = process.env.DATA_DIR || process.cwd();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'joan-flash-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Get the current data file path for the session
function getDataFilePath(req) {
  const currentDb = req.session.currentDb || 'data.json';
  return path.join(DATA_DIR, currentDb);
}

// Initialize data file if it doesn't exist
function initDataFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ entries: [] }, null, 2));
  }
}

// Read data from file
function readData(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data);
    // Ensure the data has the correct structure
    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    return parsed;
  } catch (error) {
    console.error('Error reading data file:', error);
    return { entries: [] };
  }
}

// Write data to file
function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
}

// List all data files
function listDataFiles() {
  try {
    const files = fs.readdirSync(DATA_DIR);
    return files.filter(file => file.endsWith('.json') && file !== 'package.json' && file !== 'package-lock.json');
  } catch (error) {
    console.error('Error listing data files:', error);
    return [];
  }
}

// Validate database name
function isValidDbName(name) {
  // Only allow alphanumeric, dash, underscore
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

// Calculate totals and percentages
function calculateStats(entries) {
  const totals = {
    textbook: 0,
    podcast: 0,
    notes: 0,
    flashcards: 0,
    practice: 0
    inperson: 0,
    lecture: 0
  };

  entries.forEach(entry => {
    totals.textbook += entry.textbook || 0;
    totals.podcast += entry.podcast || 0;
    totals.notes += entry.notes || 0;
    totals.flashcards += entry.flashcards || 0;
    totals.practice += entry.practice || 0;
    totals.inperson += entry.inperson || 0;
    totals.lecture += entry.lecture || 0;
  });

  const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

  const stats = {
    totals,
    grandTotal,
    percentages: {}
  };

  if (grandTotal > 0) {
    for (const [key, value] of Object.entries(totals)) {
      stats.percentages[key] = ((value / grandTotal) * 100).toFixed(1);
    }
  }

  return stats;
}

// Main page route
app.get('/', (req, res) => {
  const dataFile = getDataFilePath(req);
  initDataFile(dataFile);
  const data = readData(dataFile);
  const stats = calculateStats(data.entries);
  const currentDb = req.session.currentDb || 'data.json';
  const availableDbs = listDataFiles();

  // Read HTML template
  const htmlTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // Generate database options HTML
  const databaseOptions = availableDbs.map(db =>
    `<option value="${db}" ${db === currentDb ? 'selected' : ''}>${db.replace('.json', '')}</option>`
  ).join('');

  // Replace placeholders with actual data
  const html = htmlTemplate
    .replace('{{DATABASE_OPTIONS}}', databaseOptions)
    .replace('{{TODAY_DATE}}', new Date().toISOString().split('T')[0])
    .replace('{{TOTAL_TEXTBOOK}}', stats.totals.textbook)
    .replace('{{TOTAL_PODCAST}}', stats.totals.podcast)
    .replace('{{TOTAL_NOTES}}', stats.totals.notes)
    .replace('{{TOTAL_FLASHCARDS}}', stats.totals.flashcards)
    .replace('{{TOTAL_PRACTICE}}', stats.totals.practice)
    .replace('{{TOTAL_INPERSON}}', stats.totals.inperson)
    .replace('{{TOTAL_LECTURE}}', stats.totals.lecture)
    .replace('{{PERCENT_TEXTBOOK}}', stats.percentages.textbook || 0)
    .replace('{{PERCENT_PODCAST}}', stats.percentages.podcast || 0)
    .replace('{{PERCENT_NOTES}}', stats.percentages.notes || 0)
    .replace('{{PERCENT_FLASHCARDS}}', stats.percentages.flashcards || 0)
    .replace('{{PERCENT_PRACTICE}}', stats.percentages.practice || 0)
    .replace('{{PERCENT_INPERSON}}', stats.percentages.inperson || 0)
    .replace('{{PERCENT_LECTURE}}', stats.percentages.lecture || 0)
    .replace('{{GRAND_TOTAL}}', stats.grandTotal);

  res.send(html);
});

// Submit study time
app.post('/submit', (req, res) => {
  const { date, textbook, podcast, notes, flashcards, practice, inperson, lecture } = req.body;

  // Validation
  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  const entry = {
    date,
    textbook: parseInt(textbook) || 0,
    podcast: parseInt(podcast) || 0,
    notes: parseInt(notes) || 0,
    flashcards: parseInt(flashcards) || 0,
    practice: parseInt(practice) || 0,
    inperson: parseInt(inperson) || 0,
    lecture: parseInt(lecture) || 0,
    timestamp: new Date().toISOString()
  };

  const dataFile = getDataFilePath(req);
  const data = readData(dataFile);
  data.entries.push(entry);

  if (writeData(dataFile, data)) {
    res.json({ message: 'Study time recorded successfully!', entry });
  } else {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// API endpoint for chart data
app.get('/api/data', (req, res) => {
  const dataFile = getDataFilePath(req);
  const data = readData(dataFile);
  res.json(data);
});

// Switch database
app.post('/api/switch-db', (req, res) => {
  const { database } = req.body;

  if (!database || !database.endsWith('.json')) {
    return res.status(400).json({ error: 'Invalid database name' });
  }

  const dbPath = path.join(DATA_DIR, database);
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'Database not found' });
  }

  req.session.currentDb = database;

  // Save session before responding
  req.session.save((err) => {
    if (err) {
      console.error('Error saving session:', err);
      return res.status(500).json({ error: 'Failed to save session' });
    }
    res.json({ message: 'Database switched successfully' });
  });
});

// Create new database
app.post('/api/create-db', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Database name is required' });
  }

  if (!isValidDbName(name)) {
    return res.status(400).json({ error: 'Invalid database name. Use only letters, numbers, dashes, and underscores.' });
  }

  const filename = name.endsWith('.json') ? name : `${name}.json`;
  const dbPath = path.join(DATA_DIR, filename);

  if (fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database already exists' });
  }

  try {
    initDataFile(dbPath);
    req.session.currentDb = filename;

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      res.json({ message: 'Database created successfully', database: filename });
    });
  } catch (error) {
    console.error('Error creating database:', error);
    res.status(500).json({ error: 'Failed to create database' });
  }
});

// Delete database
app.post('/api/delete-db', (req, res) => {
  const { database } = req.body;

  if (!database || !database.endsWith('.json')) {
    return res.status(400).json({ error: 'Invalid database name' });
  }

  const dbPath = path.join(DATA_DIR, database);

  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'Database not found' });
  }

  // Check if we're deleting the current database
  const currentDb = req.session.currentDb || 'data.json';
  const allDbs = listDataFiles();

  if (allDbs.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last database' });
  }

  try {
    fs.unlinkSync(dbPath);

    // If we deleted the current database, switch to another one
    if (database === currentDb) {
      const remainingDbs = listDataFiles();
      if (remainingDbs.length === 0) {
        // No databases left, create a default one
        const defaultDb = 'data.json';
        initDataFile(path.join(DATA_DIR, defaultDb));
        req.session.currentDb = defaultDb;
      } else {
        req.session.currentDb = remainingDbs[0];
      }
    }

    // Save session before responding to ensure it's persisted
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      res.json({ message: 'Database deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting database:', error);
    res.status(500).json({ error: 'Failed to delete database' });
  }
});

// Initialize and start server
const defaultDataFile = path.join(DATA_DIR, 'data.json');
initDataFile(defaultDataFile);

app.listen(port, () => {
  console.log(`Study Time Tracker running on http://localhost:${port}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
