const express = require('express');
const router = express.Router();

router.post('/process', (req, res) => res.json({ message: 'Payment processed' }));
router.get('/methods', (req, res) => res.json({ methods: ['card', 'paypal', 'bank_transfer'] }));
router.post('/refund', (req, res) => res.json({ message: 'Refund initiated' }));
router.get('/history', (req, res) => res.json({ history: [{ id: 1, amount: 100 }, { id: 2, amount: 200 }] }));
router.get('/:id', (req, res) => res.json({ payment: { id: req.params.id, status: 'completed' } }));

module.exports = router;
