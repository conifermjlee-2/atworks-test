const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] }));
router.get('/:id', (req, res) => res.json({ user: { id: req.params.id, name: 'Alice' } }));
router.put('/:id', (req, res) => res.json({ message: `User ${req.params.id} updated` }));
router.delete('/:id', (req, res) => res.json({ message: `User ${req.params.id} deleted` }));
router.put('/:id/password', (req, res) => res.json({ message: `Password for user ${req.params.id} updated` }));

module.exports = router;
