const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ orders: [{ id: 101, total: 50 }, { id: 102, total: 150 }] }));
router.get('/:id', (req, res) => res.json({ order: { id: req.params.id, total: 50, status: 'shipped' } }));
router.post('/', (req, res) => res.json({ message: 'Order created', id: 103 }));
router.put('/:id/status', (req, res) => res.json({ message: `Order ${req.params.id} status updated` }));
router.delete('/:id', (req, res) => res.json({ message: `Order ${req.params.id} cancelled` }));

module.exports = router;
