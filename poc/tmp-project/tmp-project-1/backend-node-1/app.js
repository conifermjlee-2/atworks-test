const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const cartRoutes = require('./routes/cart');
const productRoutes = require('./routes/product');
const userRoutes = require('./routes/user');
const orderRoutes = require('./routes/order');

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => {
  res.send('API Server is running! Check /api/auth, /api/payments, /api/cart, /api/products, /api/users, /api/orders');
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
