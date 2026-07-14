const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ items: [{ id: 1, name: 'Item A', qty: 2 }] }));
router.post('/items', (req, res) => res.json({ message: 'Item added to cart' }));
router.put('/items/:id', (req, res) => res.json({ message: `Item ${req.params.id} updated in cart` }));
router.delete('/items/:id', (req, res) => res.json({ message: `Item ${req.params.id} removed from cart` }));
router.delete('/', (req, res) => res.json({ message: 'Cart cleared' }));

module.exports = router;
