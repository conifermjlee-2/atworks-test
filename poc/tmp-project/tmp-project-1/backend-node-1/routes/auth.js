const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => res.json({ message: 'Login successful' }));
router.post('/logout', (req, res) => res.json({ message: 'Logout successful' }));
router.post('/register', (req, res) => res.json({ message: 'Registration successful' }));
router.post('/refresh-token', (req, res) => res.json({ message: 'Token refreshed' }));
router.get('/me', (req, res) => res.json({ user: { id: 1, name: 'John Doe' } }));

module.exports = router;
