const db = require('../config/db');

function dateRangeParams(query) {
  const { from, to } = query;
  const effectiveFrom = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const effectiveTo = to || new Date().toISOString().slice(0, 10);
  return { effectiveFrom, effectiveTo };
}

// GET /api/reports/dashboard
async function getDashboard(req, res) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { rows: todaySalesRows } = await db.query(
    `SELECT COALESCE(SUM(s.total_usd), 0) AS total, COUNT(*) AS count
     FROM sales s WHERE s.status = 'completed' AND s.created_at >= $1`,
    [todayStart.toISOString()]
  );

  const { rows: totalRevenueRows } = await db.query(
    `SELECT COALESCE(SUM(s.total_usd), 0) AS total FROM sales s WHERE s.status = 'completed'`
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { rows: expenseRows } = await db.query(
    `SELECT COALESCE(SUM(e.amount_usd), 0) AS total FROM expenses e WHERE e.expense_date >= $1`,
    [monthStart.toISOString().slice(0, 10)]
  );

  const { rows: lowStockRows } = await db.query(
    `SELECT COUNT(*) AS count FROM products p WHERE p.is_active = true AND p.quantity_on_hand <= p.reorder_level`
  );

  const { rows: outstandingRows } = await db.query(
    `SELECT COALESCE(SUM(charged.total), 0) - COALESCE(SUM(paid.total), 0) AS outstanding
     FROM (
       SELECT c.id,
         (SELECT COALESCE(SUM(s.total_usd), 0) FROM sales s WHERE s.customer_id = c.id AND s.is_on_account = true AND s.status = 'completed') AS total
       FROM customers c WHERE c.customer_type = 'monthly_account'
     ) AS charged
     LEFT JOIN (
       SELECT c.id,
         (SELECT COALESCE(SUM(p.amount_usd), 0) FROM payments p WHERE p.customer_id = c.id) AS total
       FROM customers c WHERE c.customer_type = 'monthly_account'
     ) AS paid ON paid.id = charged.id`
  );

  const { rows: topProducts } = await db.query(
    `SELECT p.name, SUM(si.quantity) AS units_sold, SUM(si.line_total_usd) AS revenue_usd
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed' AND s.created_at >= $1
     GROUP BY p.id, p.name
     ORDER BY revenue_usd DESC
     LIMIT 5`,
    [monthStart.toISOString()]
  );

  const { rows: last7Days } = await db.query(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
       COALESCE(SUM(s.total_usd), 0) AS total_usd
     FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
     LEFT JOIN sales s ON s.status = 'completed' AND DATE(s.created_at) = d.day
     GROUP BY d.day
     ORDER BY d.day ASC`
  );

  res.json({
    todaySalesUsd: Number(todaySalesRows[0].total),
    todaySalesCount: Number(todaySalesRows[0].count),
    totalRevenueUsd: Number(totalRevenueRows[0].total),
    totalExpensesUsdThisMonth: Number(expenseRows[0].total),
    lowStockCount: Number(lowStockRows[0].count),
    outstandingBalancesUsd: Number(outstandingRows[0].outstanding || 0),
    topProducts: topProducts.map(p => ({ name: p.name, unitsSold: Number(p.units_sold), revenueUsd: Number(p.revenue_usd) })),
    salesLast7Days: last7Days.map(d => ({ date: d.date, totalUsd: Number(d.total_usd) })),
  });
}

// GET /api/reports/sales?from=&to=&groupBy=day|week|month
async function getSalesReport(req, res) {
  const { effectiveFrom, effectiveTo } = dateRangeParams(req.query);
  const groupBy = ['day', 'week', 'month'].includes(req.query.groupBy) ? req.query.groupBy : 'day';

  const { rows } = await db.query(
    `SELECT to_char(date_trunc($1, s.created_at), 'YYYY-MM-DD') AS period,
       COUNT(*) AS sale_count,
       COALESCE(SUM(s.subtotal_usd), 0) AS subtotal_usd,
       COALESCE(SUM(s.discount_usd), 0) AS discount_usd,
       COALESCE(SUM(s.tax_usd), 0) AS tax_usd,
       COALESCE(SUM(s.total_usd), 0) AS total_usd
     FROM sales s
     WHERE s.status = 'completed' AND s.created_at >= $2 AND s.created_at < ($3::date + INTERVAL '1 day')
     GROUP BY period
     ORDER BY period ASC`,
    [groupBy, effectiveFrom, effectiveTo]
  );

  res.json({
    from: effectiveFrom,
    to: effectiveTo,
    groupBy,
    rows: rows.map(r => ({
      period: r.period,
      saleCount: Number(r.sale_count),
      subtotalUsd: Number(r.subtotal_usd),
      discountUsd: Number(r.discount_usd),
      taxUsd: Number(r.tax_usd),
      totalUsd: Number(r.total_usd),
    })),
  });
}

// GET /api/reports/profit-loss?from=&to=
async function getProfitLoss(req, res) {
  const { effectiveFrom, effectiveTo } = dateRangeParams(req.query);

  const { rows: revenueRows } = await db.query(
    `SELECT COALESCE(SUM(si.line_total_usd), 0) AS revenue,
            COALESCE(SUM(si.quantity * p.cost_price_usd), 0) AS cost_of_goods
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed' AND s.created_at >= $1 AND s.created_at < ($2::date + INTERVAL '1 day')`,
    [effectiveFrom, effectiveTo]
  );

  const { rows: expenseRows } = await db.query(
    `SELECT COALESCE(SUM(e.amount_usd), 0) AS total FROM expenses e
     WHERE e.expense_date >= $1 AND e.expense_date <= $2`,
    [effectiveFrom, effectiveTo]
  );

  const revenue = Number(revenueRows[0].revenue);
  const costOfGoods = Number(revenueRows[0].cost_of_goods);
  const expenses = Number(expenseRows[0].total);
  const grossProfit = revenue - costOfGoods;
  const netProfit = grossProfit - expenses;

  res.json({ from: effectiveFrom, to: effectiveTo, revenue, costOfGoods, grossProfit, expenses, netProfit });
}

// GET /api/reports/best-sellers?from=&to=&limit=
async function getBestSellers(req, res) {
  try {
  const { effectiveFrom, effectiveTo } = dateRangeParams(req.query);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  const { rows } = await db.query(
    `SELECT p.id, p.name, SUM(si.quantity) AS units_sold, SUM(si.line_total_usd) AS revenue_usd
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed' AND s.created_at >= $1 AND s.created_at < ($2::date + INTERVAL '1 day')
     GROUP BY p.id, p.name
     ORDER BY units_sold DESC
     LIMIT $3`,
    [effectiveFrom, effectiveTo, limit]
  );

  res.json({
    from: effectiveFrom,
    to: effectiveTo,
    products: rows.map(r => ({ productId: r.id, name: r.name, unitsSold: Number(r.units_sold), revenueUsd: Number(r.revenue_usd) })),
  });
  } catch (err) {
    console.error('Best sellers report error:', err);
    res.status(500).json({ error: 'Could not load best sellers report.' });
  }
}

// GET /api/reports/cashier-performance?from=&to=
async function getCashierPerformance(req, res) {
  try {
  const { effectiveFrom, effectiveTo } = dateRangeParams(req.query);

  const { rows } = await db.query(
    `SELECT u.id, u.full_name, COUNT(s.id) AS sale_count, COALESCE(SUM(s.total_usd), 0) AS total_usd
     FROM users u
     LEFT JOIN sales s ON s.cashier_id = u.id AND s.status = 'completed'
       AND s.created_at >= $1 AND s.created_at < ($2::date + INTERVAL '1 day')
     WHERE u.id IN (SELECT DISTINCT cashier_id FROM sales)
     GROUP BY u.id, u.full_name
     ORDER BY total_usd DESC`,
    [effectiveFrom, effectiveTo]
  );

  res.json({
    from: effectiveFrom,
    to: effectiveTo,
    cashiers: rows.map(r => ({ userId: r.id, fullName: r.full_name, saleCount: Number(r.sale_count), totalUsd: Number(r.total_usd) })),
  });
  } catch (err) {
    console.error('Cashier performance report error:', err);
    res.status(500).json({ error: 'Could not load cashier performance report.' });
  }
}

// GET /api/reports/customer-balances
async function getCustomerBalances(req, res) {
  try {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.phone, c.customer_type, c.credit_limit_usd,
       COALESCE(charged.total, 0) - COALESCE(paid.total, 0) AS outstanding_balance_usd
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, SUM(total_usd) AS total FROM sales
       WHERE is_on_account = true AND status = 'completed' GROUP BY customer_id
     ) AS charged ON charged.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(amount_usd) AS total FROM payments
       WHERE customer_id IS NOT NULL GROUP BY customer_id
     ) AS paid ON paid.customer_id = c.id
     WHERE c.is_active = true
     ORDER BY outstanding_balance_usd DESC NULLS LAST`
  );

  res.json({
    customers: rows.map(r => ({
      customerId: r.id, name: r.name, phone: r.phone, customerType: r.customer_type,
      creditLimitUsd: Number(r.credit_limit_usd),
      outstandingBalanceUsd: Number(r.outstanding_balance_usd || 0),
    })),
  });
  } catch (err) {
    console.error('Customer balances report error:', err);
    res.status(500).json({ error: 'Could not load customer balances report.' });
  }
}

// GET /api/reports/inventory
async function getInventoryReport(req, res) {
  try {
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.sku, p.barcode, p.quantity_on_hand, p.reorder_level,
            p.cost_price_usd, p.sell_price_usd,
            (p.quantity_on_hand * p.cost_price_usd) AS stock_value_usd,
            c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = true
     ORDER BY p.name ASC`
  );

  const totalValuationUsd = rows.reduce((sum, r) => sum + Number(r.stock_value_usd), 0);

  res.json({
    totalValuationUsd,
    products: rows.map(r => ({
      productId: r.id, name: r.name, sku: r.sku, barcode: r.barcode,
      quantityOnHand: Number(r.quantity_on_hand), reorderLevel: Number(r.reorder_level),
      costPriceUsd: Number(r.cost_price_usd), sellPriceUsd: Number(r.sell_price_usd),
      stockValueUsd: Number(r.stock_value_usd), categoryName: r.category_name,
      lowStock: Number(r.quantity_on_hand) <= Number(r.reorder_level),
    })),
  });
  } catch (err) {
    console.error('Inventory report error:', err);
    res.status(500).json({ error: 'Could not load inventory report.' });
  }
}

// GET /api/reports/walkins?from=&to=
async function getWalkinSales(req, res) {
  try {
    const { effectiveFrom, effectiveTo } = dateRangeParams(req.query);

    const { rows } = await db.query(
      `SELECT s.id, s.invoice_number, s.walkin_customer_name, s.total_usd, s.created_at, u.full_name AS cashier_name
       FROM sales s JOIN users u ON u.id = s.cashier_id
       WHERE s.customer_id IS NULL AND s.status = 'completed'
         AND s.created_at >= $1 AND s.created_at < ($2::date + INTERVAL '1 day')
       ORDER BY s.created_at DESC
       LIMIT 500`,
      [effectiveFrom, effectiveTo]
    );

    res.json({
      from: effectiveFrom,
      to: effectiveTo,
      sales: rows.map(r => ({
        saleId: r.id, invoiceNumber: r.invoice_number,
        customerName: r.walkin_customer_name || 'Walk-in (no name given)',
        totalUsd: Number(r.total_usd), createdAt: r.created_at, cashierName: r.cashier_name,
      })),
    });
  } catch (err) {
    console.error('Walk-in sales report error:', err);
    res.status(500).json({ error: 'Could not load walk-in sales report.' });
  }
}

module.exports = {
  getDashboard, getSalesReport, getProfitLoss, getBestSellers,
  getCashierPerformance, getCustomerBalances, getInventoryReport, getWalkinSales,
};
