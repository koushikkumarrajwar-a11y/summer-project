const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);

router.get('/stats', reportController.getDashboardStats);
router.get('/:type', authorize('admin', 'librarian'), reportController.getReport);

module.exports = router;
