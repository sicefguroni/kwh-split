const express = require('express');
const router = express.Router();
const { pool, inMemoryStore } = require('../db/pool');

router.post('/', async (req, res) => {
  const { items } = req.body;
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const successIds = [];

  for (const item of items) {
    const { action, payload, id: outboxId } = item;

    try {
      if (action === 'INSERT') {
        try {
          // Try Postgres first
          await pool.query(
            `INSERT INTO expenses (id, description, amount, timestamp) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE 
             SET description = EXCLUDED.description, 
                 amount = EXCLUDED.amount, 
                 timestamp = EXCLUDED.timestamp`,
            [payload.id, payload.description, payload.amount, payload.timestamp]
          );
        } catch (dbErr) {
          // Fallback to in-memory if PG is not configured
          const existingIdx = inMemoryStore.expenses.findIndex(e => e.id === payload.id);
          if (existingIdx > -1) {
            inMemoryStore.expenses[existingIdx] = payload;
          } else {
            inMemoryStore.expenses.push(payload);
          }
        }
      } else if (action === 'DELETE') {
        try {
          await pool.query('DELETE FROM expenses WHERE id = $1', [payload.id]);
        } catch (dbErr) {
          inMemoryStore.expenses = inMemoryStore.expenses.filter(e => e.id !== payload.id);
        }
      }
      successIds.push(outboxId);
    } catch (err) {
      console.error('Error processing item:', err);
    }
  }

  res.json({ success: true, successIds });
});

module.exports = router;
