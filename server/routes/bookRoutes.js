const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const upload = require('../middleware/upload');

// Public or student-accessible routes
router.get('/', bookController.getBooks);
router.get('/export', protect, authorize('admin', 'librarian'), bookController.exportBooks);
router.get('/:id', bookController.getBookById);

// Protected routes (Admin & Librarian)
router.use(protect);
router.use(authorize('admin', 'librarian'));

router.post('/', bookController.createBook);
router.put('/:id', bookController.updateBook);
router.delete('/:id', bookController.deleteBook);
router.post('/:id/cover', upload.single('cover'), bookController.uploadCover);
router.post('/import', bookController.importBooks);

module.exports = router;
