const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.get('/', settingController.getSettings);

router.use(protect);
router.put('/', authorize('admin'), settingController.updateSettings);

module.exports = router;
