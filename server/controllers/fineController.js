const Fine = require('../models/Fine');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Notification = require('../models/Notification');
const { logAudit } = require('../utils/auditLogger');

// @desc Get all fines (Admin/Librarian)
// @route GET /api/v1/fines
exports.getFines = async (req, res, next) => {
  try {
    const { status, studentId, reason, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (studentId) query.studentId = studentId;
    if (reason) query.reason = reason;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Fine.countDocuments(query);
    const fines = await Fine.find(query)
      .populate('studentId', 'name studentId email')
      .populate({
        path: 'loanId',
        populate: { path: 'bookId', select: 'title isbn' }
      })
      .populate('payments.receivedBy', 'name')
      .populate('waivedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate totals
    const allMatching = await Fine.find(query);
    const totalAmount = allMatching.reduce((s, f) => s + f.amount, 0);
    const totalPaid = allMatching.reduce((s, f) => s + f.amountPaid, 0);
    const totalWaived = allMatching.reduce((s, f) => s + f.waivedAmount, 0);
    const totalOutstanding = totalAmount - totalPaid - totalWaived;

    return res.status(200).json({
      success: true,
      data: {
        fines,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        summary: {
          totalAmount,
          totalPaid,
          totalWaived,
          totalOutstanding
        }
      },
      message: 'Fines retrieved'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get student's own fines
// @route GET /api/v1/fines/me
exports.getMyFines = async (req, res, next) => {
  try {
    const fines = await Fine.find({ studentId: req.user._id })
      .populate({
        path: 'loanId',
        populate: { path: 'bookId', select: 'title isbn coverUrl' }
      })
      .sort({ createdAt: -1 });

    const totalAmount = fines.reduce((s, f) => s + f.amount, 0);
    const totalPaid = fines.reduce((s, f) => s + f.amountPaid, 0);
    const totalWaived = fines.reduce((s, f) => s + f.waivedAmount, 0);
    const totalOutstanding = Math.max(0, totalAmount - totalPaid - totalWaived);

    return res.status(200).json({
      success: true,
      data: {
        fines,
        summary: {
          totalAmount,
          totalPaid,
          totalWaived,
          totalOutstanding
        }
      },
      message: 'My fines retrieved'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Record payment for fine (full or partial)
// @route POST /api/v1/fines/:id/payments
exports.recordPayment = async (req, res, next) => {
  try {
    const { amount, method = 'cash' } = req.body;
    const paymentAmount = parseFloat(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Valid payment amount greater than zero is required.'
      });
    }

    const fine = await Fine.findById(req.params.id).populate('studentId');
    if (!fine) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Fine record not found.'
      });
    }

    const remainingBalance = fine.amount - fine.amountPaid - fine.waivedAmount;
    if (remainingBalance <= 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'This fine has already been fully paid or waived.'
      });
    }

    if (paymentAmount > remainingBalance) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Payment amount (${paymentAmount}) exceeds the remaining balance of ${remainingBalance}.`
      });
    }

    const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    fine.payments.push({
      amount: paymentAmount,
      date: new Date(),
      receivedBy: req.user._id,
      method,
      receiptNumber
    });

    fine.amountPaid += paymentAmount;
    if (fine.amountPaid + fine.waivedAmount >= fine.amount) {
      fine.status = 'paid';
    } else {
      fine.status = 'partial';
    }

    await fine.save();

    await Notification.create({
      userId: fine.studentId._id,
      type: 'fine',
      message: `Fine payment received: $${paymentAmount} (${method}). Receipt: ${receiptNumber}. Remaining balance: $${Math.max(0, fine.amount - fine.amountPaid - fine.waivedAmount)}.`
    });

    await logAudit(req, 'RECORD_FINE_PAYMENT', 'Fine', fine._id, {
      amount: paymentAmount,
      method,
      receiptNumber,
      student: fine.studentId.name
    });

    return res.status(200).json({
      success: true,
      data: {
        fine,
        receiptNumber,
        paidNow: paymentAmount,
        remainingBalance: Math.max(0, fine.amount - fine.amountPaid - fine.waivedAmount)
      },
      message: 'Payment recorded and receipt generated.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Waive or reduce fine
// @route POST /api/v1/fines/:id/waive
exports.waiveFine = async (req, res, next) => {
  try {
    const { amount, reason } = req.body;
    const waiveAmount = parseFloat(amount);

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'A detailed reason is required for any fine waiver or reduction.'
      });
    }

    if (!waiveAmount || waiveAmount <= 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Please provide a valid waiver amount greater than zero.'
      });
    }

    const settings = await Setting.findOne() || { waiverApprovalThreshold: 15 };

    // Waivers above the threshold require admin approval (Section G)
    if (waiveAmount > (settings.waiverApprovalThreshold || 15) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        data: null,
        message: `Waivers above $${settings.waiverApprovalThreshold} require Administrator approval. Please refer this request to an Admin.`
      });
    }

    const fine = await Fine.findById(req.params.id).populate('studentId');
    if (!fine) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Fine record not found.'
      });
    }

    const remaining = fine.amount - fine.amountPaid - fine.waivedAmount;
    if (waiveAmount > remaining) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Waiver amount ($${waiveAmount}) cannot exceed the outstanding balance ($${remaining}).`
      });
    }

    fine.waivedAmount += waiveAmount;
    fine.waiveReason = reason.trim();
    fine.waivedBy = req.user._id;

    if (fine.amountPaid + fine.waivedAmount >= fine.amount) {
      fine.status = 'waived';
    } else {
      fine.status = 'partial';
    }

    await fine.save();

    await Notification.create({
      userId: fine.studentId._id,
      type: 'fine',
      message: `Fine reduction/waiver of $${waiveAmount} applied. Reason: ${reason}. Remaining: $${Math.max(0, fine.amount - fine.amountPaid - fine.waivedAmount)}.`
    });

    await logAudit(req, 'WAIVE_FINE', 'Fine', fine._id, {
      waivedAmount: waiveAmount,
      reason,
      approvedByRole: req.user.role
    });

    return res.status(200).json({
      success: true,
      data: fine,
      message: 'Fine waiver processed successfully.'
    });
  } catch (error) {
    next(error);
  }
};
