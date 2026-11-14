const express = require('express');
const router = express.Router();
const fineController = require('../controllers/fineController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);

router.get('/me', fineController.getMyFines);

router.get('/', authorize('admin', 'librarian'), fineController.getFines);
router.post('/:id/payments', authorize('admin', 'librarian'), fineController.recordPayment);
router.post('/:id/waive', authorize('admin', 'librarian'), fineController.waiveFine);

module.exports = router;
