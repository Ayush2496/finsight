// routes/transactions.js
const express         = require('express');
const axios           = require('axios');
const db              = require('../db');
const isAuthenticated = require('../middleware/auth');
const router          = express.Router();

const FLASK_URL = process.env.FLASK_URL || 'http://127.0.0.1:5000';

// Get category_id from name, fallback to Miscellaneous
async function getCategoryId(categoryName) {
  const [rows] = await db.query(
    'SELECT category_id FROM categories WHERE category_name = ?', [categoryName]
  );
  if (rows.length > 0) return rows[0].category_id;
  const [fallback] = await db.query(
    'SELECT category_id FROM categories WHERE category_name = ?', ['Miscellaneous']
  );
  return fallback.length > 0 ? fallback[0].category_id : null;
}

// Call Flask ML to predict category from description
async function predictCategory(description) {
  try {
    const response = await axios.post(
      `${FLASK_URL}/predict-category`,
      { description },
      { timeout: 5000 }
    );
    return { category: response.data.category, confidence: response.data.confidence };
  } catch (err) {
    console.warn('Flask ML unavailable — using Miscellaneous:', err.message);
    return { category: 'Miscellaneous', confidence: 'low' };
  }
}

// ── POST /api/transactions/add ─────────────────────────────────────────────
// category is OPTIONAL — if omitted ML classifies from description
router.post('/add', isAuthenticated, async (req, res) => {
  const { description, amount, date, type, category } = req.body;
  const user_id = req.session.user.id;

  if (!description || !amount || !date || !type) {
    return res.status(400).json({ error: 'description, amount, date and type are required.' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: "type must be 'income' or 'expense'." });
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  try {
    let categoryName, confidence;

    if (type === 'income') {
      // Income always goes to Miscellaneous (or you can add an Income category)
      categoryName = 'Miscellaneous';
      confidence   = 'high';
    } else if (category && category.trim() !== '') {
      // User manually selected a category — use it directly, skip ML
      categoryName = category.trim();
      confidence   = 'manual';
    } else {
      // No category selected — let ML classify from description
      const prediction = await predictCategory(description);
      categoryName = prediction.category;
      confidence   = prediction.confidence;
    }

    const category_id = await getCategoryId(categoryName);
    if (!category_id) return res.status(500).json({ error: 'Category lookup failed.' });

    const storedAmount = type === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    const [result] = await db.query(
      'INSERT INTO transactions (user_id, amount, description, date, category_id) VALUES (?, ?, ?, ?, ?)',
      [user_id, storedAmount, description.trim(), date, category_id]
    );

    return res.status(201).json({
      message: 'Transaction added successfully.',
      transaction: {
        transaction_id: result.insertId,
        user_id, description: description.trim(),
        amount: storedAmount, type, date,
        category: categoryName, category_id,
        ml_confidence: confidence
      }
    });

  } catch (err) {
    console.error('Add transaction error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── GET /api/transactions ──────────────────────────────────────────────────
router.get('/', isAuthenticated, async (req, res) => {
  const user_id = req.session.user.id;
  const { category, type, sort } = req.query;

  try {
    let query = `
      SELECT t.transaction_id, t.amount, t.description, t.date, t.category_id,
             c.category_name AS category,
             CASE WHEN t.amount >= 0 THEN 'income' ELSE 'expense' END AS type
      FROM transactions t
      JOIN categories c ON t.category_id = c.category_id
      WHERE t.user_id = ?`;
    const params = [user_id];

    if (category && category !== 'all') { query += ' AND c.category_name = ?'; params.push(category); }
    if (type === 'income')  query += ' AND t.amount >= 0';
    if (type === 'expense') query += ' AND t.amount < 0';
    if (sort === 'asc')  query += ' ORDER BY ABS(t.amount) ASC';
    else if (sort === 'desc') query += ' ORDER BY ABS(t.amount) DESC';
    else query += ' ORDER BY t.date DESC, t.transaction_id DESC';

    const [rows] = await db.query(query, params);
    return res.status(200).json({ count: rows.length, transactions: rows });

  } catch (err) {
    console.error('Get transactions error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ── DELETE /api/transactions/:id ───────────────────────────────────────────
router.delete('/:id', isAuthenticated, async (req, res) => {
  const user_id = req.session.user.id;
  const transaction_id = parseInt(req.params.id);
  if (isNaN(transaction_id)) return res.status(400).json({ error: 'Invalid transaction ID.' });

  try {
    const [rows] = await db.query(
      'SELECT transaction_id FROM transactions WHERE transaction_id = ? AND user_id = ?',
      [transaction_id, user_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Transaction not found.' });

    await db.query('DELETE FROM transactions WHERE transaction_id = ? AND user_id = ?', [transaction_id, user_id]);
    return res.status(200).json({ message: 'Transaction deleted.' });

  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

// ── POST /api/transactions/preview-category ───────────────────────────────
// Called by frontend as user types — returns ML prediction without saving
router.post('/preview-category', isAuthenticated, async (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });
  const result = await predictCategory(description);
  return res.status(200).json(result);
});