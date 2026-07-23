const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ products: [{ id: 1, name: 'Product A' }, { id: 2, name: 'Product B' }] }));
router.get('/:id', (req, res) => res.json({ product: { id: req.params.id, name: 'Product Detail' } }));
router.post('/', (req, res) => res.json({ message: 'Product created', id: 3 }));
router.put('/:id', (req, res) => res.json({ message: `Product ${req.params.id} updated` }));
router.delete('/:id', (req, res) => res.json({ message: `Product ${req.params.id} deleted` }));

module.exports = router;
