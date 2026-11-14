const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);

router.put('/me', userController.updateMe);
router.put('/me/password', userController.updatePassword);

router.get('/', authorize('admin', 'librarian'), userController.getUsers);
router.post('/', authorize('admin', 'librarian'), userController.createUser);
router.get('/:id', userController.getUserById);
router.put('/:id', authorize('admin', 'librarian'), userController.updateUser);
router.patch('/:id/status', authorize('admin', 'librarian'), userController.updateUserStatus);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;
