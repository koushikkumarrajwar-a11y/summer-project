const Setting = require('../models/Setting');

const calculateOverdueFine = async (loan, bookPrice = null) => {
  const settings = await Setting.findOne() || { finePerDay: 5, maxFineCap: 50 };
  const now = new Date();
  const dueDate = new Date(loan.dueDate);

  if (now <= dueDate) {
    return { daysOverdue: 0, fineAmount: 0 };
  }

  const diffTime = Math.abs(now - dueDate);
  const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  let fineAmount = daysOverdue * (settings.finePerDay || 5);

  const cap = settings.maxFineCap || (bookPrice ? bookPrice : 0);
  if (cap > 0 && fineAmount > cap) {
    fineAmount = cap;
  }

  return { daysOverdue, fineAmount };
};

module.exports = { calculateOverdueFine };
