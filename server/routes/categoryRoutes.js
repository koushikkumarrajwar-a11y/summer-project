const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.get('/', categoryController.getCategories);

router.use(protect);
router.post('/', authorize('admin', 'librarian'), categoryController.createCategory);
router.put('/:id', authorize('admin'), categoryController.updateCategory);
router.delete('/:id', authorize('admin'), categoryController.deleteCategory);

module.exports = router;
