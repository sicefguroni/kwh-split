const express = require('express');
const cors = require('cors');
const syncRouter = require('./routes/sync');
const { pool, inMemoryStore } = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/sync', syncRouter);

app.get('/api/expenses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (dbErr) {
    // Fallback to in-memory store
    res.json(inMemoryStore.expenses.sort((a, b) => b.timestamp - a.timestamp));
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
