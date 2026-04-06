// routes/dashboard.js — FinSight Dashboard Route
// Returns all data needed for the dashboard in one single API call
//
// Routes:
//   GET /api/dashboard  → returns aggregated financial data + ML prediction

const express         = require('express');
const axios           = require('axios');
const db              = require('../db');
const isAuthenticated = require('../middleware/auth');
const router          = express.Router();

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5000';

// ─────────────────────────────────────────────
// Helper: call Flask regression model
// Returns predicted next month spending
// ─────────────────────────────────────────────
async function predictSpending(monthlyTotals) {
  try {
    const response = await axios.post(
      `${FLASK_URL}/predict-spending`,
      { monthly_totals: monthlyTotals },
      { timeout: 5000 }
    );
    return response.data;
  } catch (err) {
    console.warn('Flask spending prediction unavailable:', err.message);
    return {
      predicted_next_month: null,
      enough_data         : false,
      message             : 'ML service unavailable.'
    };
  }
}


// ─────────────────────────────────────────────
// GET /api/dashboard
// Returns everything the frontend dashboard needs:
//   - totalIncome       this month
//   - totalExpenses     this month
//   - totalBalance      (income - expenses, all time)
//   - savingsYield      % saved this month
//   - categoryBreakdown (pie chart data)
//   - monthlyTrend      (line chart — last 6 months)
//   - recentTransactions(last 5)
//   - predictedNextMonth(ML regression)
//   - overspendingAlert (true/false)
// ─────────────────────────────────────────────
router.get('/', isAuthenticated, async (req, res) => {
  const user_id = req.session.user.id;

  try {

    // ── 1. Total income this month ─────────────────
    const [incomeRows] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE user_id = ?
        AND amount >= 0
        AND MONTH(date) = MONTH(CURRENT_DATE())
        AND YEAR(date)  = YEAR(CURRENT_DATE())
    `, [user_id]);
    const totalIncome = parseFloat(incomeRows[0].total);


    // ── 2. Total expenses this month ───────────────
    const [expenseRows] = await db.query(`
      SELECT COALESCE(SUM(ABS(amount)), 0) AS total
      FROM transactions
      WHERE user_id = ?
        AND amount < 0
        AND MONTH(date) = MONTH(CURRENT_DATE())
        AND YEAR(date)  = YEAR(CURRENT_DATE())
    `, [user_id]);
    const totalExpenses = parseFloat(expenseRows[0].total);


    // ── 3. Total balance all time ──────────────────
    const [balanceRows] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE user_id = ?
    `, [user_id]);
    const totalBalance = parseFloat(balanceRows[0].total);


    // ── 4. Savings yield this month ────────────────
    // Formula: ((income - expenses) / income) * 100
    const savingsYield = totalIncome > 0
      ? parseFloat((((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1))
      : 0;


    // ── 5. Category breakdown (expenses only) ──────
    // Used for pie/donut chart on dashboard
    const [categoryRows] = await db.query(`
      SELECT
        c.category_name  AS category,
        SUM(ABS(t.amount)) AS total
      FROM transactions t
      JOIN categories c ON t.category_id = c.category_id
      WHERE t.user_id = ?
        AND t.amount < 0
        AND MONTH(t.date) = MONTH(CURRENT_DATE())
        AND YEAR(t.date)  = YEAR(CURRENT_DATE())
      GROUP BY c.category_name
      ORDER BY total DESC
    `, [user_id]);


    // ── 6. Monthly trend — last 6 months ───────────
    // Used for line/bar chart on dashboard
    const [trendRows] = await db.query(`
      SELECT
        DATE_FORMAT(date, '%b %Y')   AS month,
        DATE_FORMAT(date, '%Y-%m')   AS month_key,
        SUM(CASE WHEN amount >= 0 THEN amount        ELSE 0 END) AS income,
        SUM(CASE WHEN amount < 0  THEN ABS(amount)   ELSE 0 END) AS expenses
      FROM transactions
      WHERE user_id = ?
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      GROUP BY month_key, month
      ORDER BY month_key ASC
    `, [user_id]);


    // ── 7. Recent transactions — last 5 ────────────
    const [recentRows] = await db.query(`
      SELECT
        t.transaction_id,
        t.description,
        t.amount,
        t.date,
        c.category_name AS category,
        CASE WHEN t.amount >= 0 THEN 'income' ELSE 'expense' END AS type
      FROM transactions t
      JOIN categories c ON t.category_id = c.category_id
      WHERE t.user_id = ?
      ORDER BY t.date DESC, t.transaction_id DESC
      LIMIT 5
    `, [user_id]);


    // ── 8. ML spending prediction ──────────────────
    // Extract monthly expense totals for last 6 months
    // and pass them to Flask regression model
    const monthlyExpenseTotals = trendRows.map(r => parseFloat(r.expenses));
    const prediction = await predictSpending(monthlyExpenseTotals);


    // ── 9. Overspending alert ──────────────────────
    // Alert if predicted next month > average of last 3 months by 20%
    let overspendingAlert = false;
    if (prediction.enough_data && prediction.predicted_next_month) {
      const last3 = monthlyExpenseTotals.slice(-3);
      const avg3  = last3.reduce((a, b) => a + b, 0) / last3.length;
      overspendingAlert = prediction.predicted_next_month > avg3 * 1.2;
    }


    // ── 10. Top category this month ────────────────
    const topCategory = categoryRows.length > 0 ? categoryRows[0].category : 'N/A';


    // ── Send everything to frontend ────────────────
    return res.status(200).json({
      // Summary cards
      totalIncome,
      totalExpenses,
      totalBalance    : parseFloat(totalBalance.toFixed(2)),
      savingsYield,

      // Charts
      categoryBreakdown: categoryRows.map(r => ({
        category: r.category,
        total   : parseFloat(r.total)
      })),
      monthlyTrend: trendRows.map(r => ({
        month   : r.month,
        income  : parseFloat(r.income),
        expenses: parseFloat(r.expenses)
      })),

      // Recent transactions
      recentTransactions: recentRows,

      // ML prediction
      predictedNextMonth: prediction.predicted_next_month,
      predictionMessage : prediction.message || null,
      enoughDataForML   : prediction.enough_data,

      // Alert
      overspendingAlert,
      topCategory,

      // Meta
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});


module.exports = router;