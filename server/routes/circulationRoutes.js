const express = require('express');
const router = express.Router();
const circulationController = require('../controllers/circulationController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);

router.get('/me', circulationController.getMyLoans);
router.post('/:id/renew', circulationController.renewLoan);

// Librarian & Admin operations
router.get('/', authorize('admin', 'librarian'), circulationController.getLoans);
router.post('/', authorize('admin', 'librarian'), circulationController.issueBook);
router.post('/:id/return', authorize('admin', 'librarian'), circulationController.returnBook);

module.exports = router;
