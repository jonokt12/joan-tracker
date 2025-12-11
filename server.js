const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Get port from CLI argument
const port = process.argv[2] || 3000;

// Data file path - configurable via environment variable
// Defaults to current working directory, not __dirname (which would be read-only in nix store)
const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize data file if it doesn't exist
function initDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ entries: [] }, null, 2));
  }
}

// Read data from file
function readData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    return { entries: [] };
  }
}

// Write data to file
function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
}

// Calculate totals and percentages
function calculateStats(entries) {
  const totals = {
    textbook: 0,
    podcast: 0,
    notes: 0,
    flashcards: 0,
    practice: 0
  };

  entries.forEach(entry => {
    totals.textbook += entry.textbook || 0;
    totals.podcast += entry.podcast || 0;
    totals.notes += entry.notes || 0;
    totals.flashcards += entry.flashcards || 0;
    totals.practice += entry.practice || 0;
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
  const data = readData();
  const stats = calculateStats(data.entries);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Study Time Tracker</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h1 {
      color: #2c3e50;
      margin-bottom: 30px;
      text-align: center;
    }

    h2 {
      color: #34495e;
      margin-top: 40px;
      margin-bottom: 20px;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }

    form {
      display: grid;
      gap: 20px;
      margin-bottom: 40px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    label {
      font-weight: 600;
      margin-bottom: 5px;
      color: #555;
    }

    input[type="date"],
    input[type="number"] {
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }

    input[type="number"] {
      max-width: 200px;
    }

    button {
      background: #3498db;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.3s;
    }

    button:hover {
      background: #2980b9;
    }

    .message {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
      display: none;
    }

    .message.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .message.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #555;
    }

    tr:hover {
      background: #f8f9fa;
    }

    .chart-container {
      margin-top: 30px;
      position: relative;
      height: 400px;
    }

    @media (max-width: 768px) {
      .container {
        padding: 15px;
      }

      input[type="number"] {
        max-width: 100%;
      }

      .chart-container {
        height: 300px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Study Time Tracker</h1>

    <div id="message" class="message"></div>

    <form id="studyForm">
      <div class="form-group">
        <label for="date">Date:</label>
        <input type="date" id="date" name="date" required value="${new Date().toISOString().split('T')[0]}">
      </div>

      <div class="form-group">
        <label for="textbook">Textbook Reading (minutes):</label>
        <input type="number" id="textbook" name="textbook" min="0" max="1440" value="0">
      </div>

      <div class="form-group">
        <label for="podcast">Podcast Listening (minutes):</label>
        <input type="number" id="podcast" name="podcast" min="0" max="1440" value="0">
      </div>

      <div class="form-group">
        <label for="notes">Note Writing (minutes):</label>
        <input type="number" id="notes" name="notes" min="0" max="1440" value="0">
      </div>

      <div class="form-group">
        <label for="flashcards">Flashcard Questions (minutes):</label>
        <input type="number" id="flashcards" name="flashcards" min="0" max="1440" value="0">
      </div>

      <div class="form-group">
        <label for="practice">Practice Questions (minutes):</label>
        <input type="number" id="practice" name="practice" min="0" max="1440" value="0">
      </div>

      <button type="submit">Submit Study Time</button>
    </form>

    <h2>Running Totals</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Total Minutes</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Textbook Reading</td>
          <td>${stats.totals.textbook}</td>
          <td>${stats.percentages.textbook || 0}%</td>
        </tr>
        <tr>
          <td>Podcast Listening</td>
          <td>${stats.totals.podcast}</td>
          <td>${stats.percentages.podcast || 0}%</td>
        </tr>
        <tr>
          <td>Note Writing</td>
          <td>${stats.totals.notes}</td>
          <td>${stats.percentages.notes || 0}%</td>
        </tr>
        <tr>
          <td>Flashcard Questions</td>
          <td>${stats.totals.flashcards}</td>
          <td>${stats.percentages.flashcards || 0}%</td>
        </tr>
        <tr>
          <td>Practice Questions</td>
          <td>${stats.totals.practice}</td>
          <td>${stats.percentages.practice || 0}%</td>
        </tr>
        <tr style="font-weight: bold; background: #f8f9fa;">
          <td>Total</td>
          <td>${stats.grandTotal}</td>
          <td>100%</td>
        </tr>
      </tbody>
    </table>

    <h2>Running Totals Over Time</h2>
    <div class="chart-container">
      <canvas id="studyChart"></canvas>
    </div>

    <h2>Daily Averages Over Time</h2>
    <div class="chart-container">
      <canvas id="averageChart"></canvas>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script>
    // Form submission
    document.getElementById('studyForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        date: document.getElementById('date').value,
        textbook: parseInt(document.getElementById('textbook').value) || 0,
        podcast: parseInt(document.getElementById('podcast').value) || 0,
        notes: parseInt(document.getElementById('notes').value) || 0,
        flashcards: parseInt(document.getElementById('flashcards').value) || 0,
        practice: parseInt(document.getElementById('practice').value) || 0
      };

      try {
        const response = await fetch('/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        const messageDiv = document.getElementById('message');
        if (response.ok) {
          messageDiv.textContent = result.message;
          messageDiv.className = 'message success';
          messageDiv.style.display = 'block';

          // Reload page after short delay to show updated stats
          setTimeout(() => window.location.reload(), 1000);
        } else {
          messageDiv.textContent = result.error || 'Error submitting data';
          messageDiv.className = 'message error';
          messageDiv.style.display = 'block';
        }
      } catch (error) {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = 'Error submitting data: ' + error.message;
        messageDiv.className = 'message error';
        messageDiv.style.display = 'block';
      }
    });

    // Load chart data
    async function loadChart() {
      try {
        const response = await fetch('/api/data');
        const data = await response.json();

        if (data.entries.length === 0) {
          return;
        }

        // Sort entries by date
        const sortedEntries = data.entries.sort((a, b) =>
          new Date(a.date) - new Date(b.date)
        );

        // Calculate running totals
        let runningTotals = {
          textbook: [],
          podcast: [],
          notes: [],
          flashcards: [],
          practice: [],
          total: []
        };

        let cumulativeTextbook = 0;
        let cumulativePodcast = 0;
        let cumulativeNotes = 0;
        let cumulativeFlashcards = 0;
        let cumulativePractice = 0;

        sortedEntries.forEach(entry => {
          cumulativeTextbook += entry.textbook || 0;
          cumulativePodcast += entry.podcast || 0;
          cumulativeNotes += entry.notes || 0;
          cumulativeFlashcards += entry.flashcards || 0;
          cumulativePractice += entry.practice || 0;

          runningTotals.textbook.push(cumulativeTextbook);
          runningTotals.podcast.push(cumulativePodcast);
          runningTotals.notes.push(cumulativeNotes);
          runningTotals.flashcards.push(cumulativeFlashcards);
          runningTotals.practice.push(cumulativePractice);
          runningTotals.total.push(
            cumulativeTextbook + cumulativePodcast + cumulativeNotes +
            cumulativeFlashcards + cumulativePractice
          );
        });

        const labels = sortedEntries.map(entry => entry.date);

        const ctx = document.getElementById('studyChart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Total',
                data: runningTotals.total,
                borderColor: '#2c3e50',
                backgroundColor: 'rgba(44, 62, 80, 0.1)',
                borderWidth: 3,
                tension: 0.1
              },
              {
                label: 'Textbook',
                data: runningTotals.textbook,
                borderColor: '#3498db',
                borderWidth: 2,
                tension: 0.1
              },
              {
                label: 'Podcast',
                data: runningTotals.podcast,
                borderColor: '#e74c3c',
                borderWidth: 2,
                tension: 0.1
              },
              {
                label: 'Notes',
                data: runningTotals.notes,
                borderColor: '#2ecc71',
                borderWidth: 2,
                tension: 0.1
              },
              {
                label: 'Flashcards',
                data: runningTotals.flashcards,
                borderColor: '#f39c12',
                borderWidth: 2,
                tension: 0.1
              },
              {
                label: 'Practice',
                data: runningTotals.practice,
                borderColor: '#9b59b6',
                borderWidth: 2,
                tension: 0.1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom'
              },
              title: {
                display: true,
                text: 'Running Total Minutes by Category'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Minutes'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Date'
                }
              }
            }
          }
        });
      } catch (error) {
        console.error('Error loading chart:', error);
      }
    }

    // Load average chart data
    async function loadAverageChart() {
      try {
        const response = await fetch('/api/data');
        const data = await response.json();

        if (data.entries.length === 0) {
          return;
        }

        // Aggregate entries by date (sum all entries for the same date)
        const dailyTotals = {};
        data.entries.forEach(entry => {
          if (!dailyTotals[entry.date]) {
            dailyTotals[entry.date] = {
              textbook: 0,
              podcast: 0,
              notes: 0,
              flashcards: 0,
              practice: 0
            };
          }
          dailyTotals[entry.date].textbook += entry.textbook || 0;
          dailyTotals[entry.date].podcast += entry.podcast || 0;
          dailyTotals[entry.date].notes += entry.notes || 0;
          dailyTotals[entry.date].flashcards += entry.flashcards || 0;
          dailyTotals[entry.date].practice += entry.practice || 0;
        });

        // Sort dates and create array of daily totals
        const dates = Object.keys(dailyTotals).sort((a, b) => new Date(a) - new Date(b));

        // Calculate running averages (cumulative total / number of unique days)
        let runningAverages = {
          textbook: [],
          podcast: [],
          notes: [],
          flashcards: [],
          practice: [],
          total: []
        };

        let cumulativeTextbook = 0;
        let cumulativePodcast = 0;
        let cumulativeNotes = 0;
        let cumulativeFlashcards = 0;
        let cumulativePractice = 0;

        dates.forEach((date, index) => {
          const dayCount = index + 1;
          const dayData = dailyTotals[date];

          cumulativeTextbook += dayData.textbook;
          cumulativePodcast += dayData.podcast;
          cumulativeNotes += dayData.notes;
          cumulativeFlashcards += dayData.flashcards;
          cumulativePractice += dayData.practice;

          runningAverages.textbook.push((cumulativeTextbook / dayCount).toFixed(1));
          runningAverages.podcast.push((cumulativePodcast / dayCount).toFixed(1));
          runningAverages.notes.push((cumulativeNotes / dayCount).toFixed(1));
          runningAverages.flashcards.push((cumulativeFlashcards / dayCount).toFixed(1));
          runningAverages.practice.push((cumulativePractice / dayCount).toFixed(1));

          const totalAverage = (
            (cumulativeTextbook + cumulativePodcast + cumulativeNotes +
            cumulativeFlashcards + cumulativePractice) / dayCount
          ).toFixed(1);
          runningAverages.total.push(totalAverage);
        });

        const labels = dates;

        const ctx = document.getElementById('averageChart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Total',
                data: runningAverages.total,
                borderColor: '#2c3e50',
                backgroundColor: 'rgba(44, 62, 80, 0.1)',
                borderWidth: 3,
                tension: 0.1
              },
              {
                label: 'Textbook',
                data: runningAverages.textbook,
                borderColor: '#3498db',
                borderWidth: 2,
                tension: 0.1
              },
              {
                label: 'Podcast',
                data: runningAverages.podcast,
                borderColor: '#e74c3c',
                borderWidth: 2,
                tension: 0.1
              },
              {
                label: 'Notes',
                data: runningAverages.notes,
                borderColor: '#2ecc71',
                borderWidth: 2,
                tension: 0.1
              },
              {
                label: 'Flashcards',
                data: runningAverages.flashcards,
                borderColor: '#f39c12',
                borderWidth: 2,
                tension: 0.1
              },
              {
                label: 'Practice',
                data: runningAverages.practice,
                borderColor: '#9b59b6',
                borderWidth: 2,
                tension: 0.1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom'
              },
              title: {
                display: true,
                text: 'Daily Average Minutes by Category'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Minutes per Day (Average)'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Date'
                }
              }
            }
          }
        });
      } catch (error) {
        console.error('Error loading average chart:', error);
      }
    }

    loadChart();
    loadAverageChart();
  </script>
</body>
</html>`;

  res.send(html);
});

// Submit study time
app.post('/submit', (req, res) => {
  const { date, textbook, podcast, notes, flashcards, practice } = req.body;

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
    timestamp: new Date().toISOString()
  };

  const data = readData();
  data.entries.push(entry);

  if (writeData(data)) {
    res.json({ message: 'Study time recorded successfully!', entry });
  } else {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// API endpoint for chart data
app.get('/api/data', (req, res) => {
  const data = readData();
  res.json(data);
});

// Initialize and start server
initDataFile();

app.listen(port, () => {
  console.log(`Study Time Tracker running on http://localhost:${port}`);
  console.log(`Data file: ${DATA_FILE}`);
});
