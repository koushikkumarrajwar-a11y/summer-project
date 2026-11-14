const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);

router.post('/', reservationController.createReservation);
router.get('/me', reservationController.getMyReservations);
router.patch('/:id', reservationController.updateReservation);

// Staff access
router.get('/', authorize('admin', 'librarian'), reservationController.getReservations);

module.exports = router;
