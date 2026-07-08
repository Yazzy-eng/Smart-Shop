require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const exchangeRateRoutes = require('./routes/exchangeRates');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const salesRoutes = require('./routes/sales');
const categoryRoutes = require('./routes/categories');
const expenseRoutes = require('./routes/expenses');
const reportsRoutes = require('./routes/reports');

const app = express();

// --- Security middleware ---
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Global rate limit as a baseline defense; /auth/login has its own tighter limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exchange-rates', exchangeRateRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportsRoutes);

// TODO (next modules): dashboard PDF/Excel export, backups, full admin screens.

// --- 404 + error handling ---
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Deeqsan POS API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
