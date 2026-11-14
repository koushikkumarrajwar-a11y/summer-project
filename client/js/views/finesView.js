// ==========================================================
// FINES & PAYMENTS VIEW (Ledger, Payments, Receipts, Waivers)
// ==========================================================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, escapeHTML } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';

export const finesView = {
  async render(container) {
    const user = store.getState().user;
    const isStudent = user && user.role === 'student';

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${isStudent ? 'My Library Fines' : 'Fines & Financial Ledger'}</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Assessments, receipts, and waiver audits</p>
        </div>
      </div>

      <!-- Financial Metric Highlights -->
      <div id="fines-metrics" class="metric-grid"></div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                ${!isStudent ? '<th>Student</th>' : ''}
                <th>Title / Description</th>
                <th>Reason</th>
                <th>Total Fine</th>
                <th>Paid</th>
                <th>Waived</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="fines-table-body">
              <tr><td colspan="9" style="text-align: center;">Loading ledger records...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const endpoint = isStudent ? '/fines/me' : '/fines';
      const res = await api.get(endpoint);
      const fines = isStudent ? res.data.fines : res.data.fines;
      const summary = res.data.summary;

      // Summary Metrics
      const mContainer = document.getElementById('fines-metrics');
      mContainer.innerHTML = `
        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(239, 68, 68, 0.15); color: var(--color-danger);">💳</div>
          <div class="metric-data">
            <div class="metric-value" style="color: var(--color-danger);">$${summary.totalOutstanding}</div>
            <div class="metric-label">Outstanding Unpaid Balance</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: var(--color-success);">💵</div>
          <div class="metric-data">
            <div class="metric-value">$${summary.totalPaid}</div>
            <div class="metric-label">Total Amount Paid</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(99, 102, 241, 0.15); color: var(--primary-600);">🏷️</div>
          <div class="metric-data">
            <div class="metric-value">$${summary.totalWaived}</div>
            <div class="metric-label">Approved Waivers</div>
          </div>
        </div>
      `;

      const tbody = document.getElementById('fines-table-body');
      if (fines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No fine records on file. Excellent!</td></tr>';
        return;
      }

      tbody.innerHTML = fines.map((f) => {
        const balance = Math.max(0, f.amount - f.amountPaid - f.waivedAmount);
        let badge = 'badge-danger';
        if (f.status === 'paid') badge = 'badge-success';
        else if (f.status === 'partial') badge = 'badge-warning';
        else if (f.status === 'waived') badge = 'badge-neutral';

        return `
          <tr>
            ${!isStudent ? `
              <td>
                <strong>${escapeHTML(f.studentId ? f.studentId.name : 'Unknown')}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(f.studentId ? f.studentId.studentId : '')}</div>
              </td>
            ` : ''}
            <td>
              <div>${escapeHTML(f.description || (f.loanId && f.loanId.bookId ? f.loanId.bookId.title : 'Overdue fine'))}</div>
              <div style="font-size: 0.7rem; color: var(--text-subtle);">${new Date(f.createdAt).toLocaleDateString()}</div>
            </td>
            <td><span class="badge badge-info">${f.reason}</span></td>
            <td><strong>$${f.amount}</strong></td>
            <td style="color: var(--color-success);">$${f.amountPaid}</td>
            <td style="color: var(--text-muted);">$${f.waivedAmount}</td>
            <td style="color: ${balance > 0 ? 'var(--color-danger)' : 'inherit'}; font-weight: 700;">$${balance}</td>
            <td><span class="badge ${badge}">${f.status}</span></td>
            <td>
              ${!isStudent && balance > 0 ? `
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-primary btn-sm pay-fine-btn" data-id="${f._id}" data-bal="${balance}">Record Pay</button>
                  <button class="btn btn-secondary btn-sm waive-fine-btn" data-id="${f._id}" data-bal="${balance}">Waive</button>
                </div>
              ` : '<span style="font-size: 0.8rem; color: var(--text-subtle);">Cleared</span>'}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.pay-fine-btn').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const bal = btn.getAttribute('data-bal');
          finesView.showPaymentModal(id, bal);
        };
      });

      tbody.querySelectorAll('.waive-fine-btn').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const bal = btn.getAttribute('data-bal');
          finesView.showWaiveModal(id, bal);
        };
      });
    } catch (err) {
      document.getElementById('fines-table-body').innerHTML = `<tr><td colspan="9" style="color: var(--color-danger); text-align: center;">${escapeHTML(err.message)}</td></tr>`;
    }
  },

  showPaymentModal(fineId, balance) {
    openModal({
      title: 'Record Fine Payment',
      size: 'md',
      bodyHTML: `
        <div style="margin-bottom: 1rem;">
          <div style="font-size: 0.85rem; color: var(--text-muted);">Outstanding Balance: <strong>$${balance}</strong></div>
        </div>
        <div class="form-group">
          <label class="form-label required" for="pay-amount">Payment Amount ($)</label>
          <input type="number" id="pay-amount" class="form-control" value="${balance}" max="${balance}" min="1" step="0.5" required />
        </div>
        <div class="form-group">
          <label class="form-label required" for="pay-method">Payment Method</label>
          <select id="pay-method" class="form-control">
            <option value="cash" selected>Cash at Circulation Desk</option>
            <option value="card">Card / Terminal</option>
            <option value="bank_transfer">Campus Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" id="pay-cancel">Cancel</button>
        <button class="btn btn-primary" id="pay-submit">Confirm & Print Receipt</button>
      `
    });

    document.getElementById('pay-cancel').onclick = closeModal;

    document.getElementById('pay-submit').onclick = async () => {
      const amount = document.getElementById('pay-amount').value;
      const method = document.getElementById('pay-method').value;

      try {
        const res = await api.post(`/fines/${fineId}/payments`, { amount, method });
        showToast(res.message, 'success');
        closeModal();

        // Show receipt
        openModal({
          title: 'Official Payment Receipt',
          size: 'md',
          bodyHTML: `
            <div style="text-align: center; border-bottom: 2px dashed var(--border-color); padding-bottom: 1rem; margin-bottom: 1rem;">
              <div style="font-size: 1.2rem; font-weight: 700;">Library Circulation Desk</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">Payment Receipt: <code>${res.data.receiptNumber}</code></div>
            </div>
            <div style="font-size: 0.875rem; display: flex; flex-direction: column; gap: 0.5rem;">
              <div><strong>Amount Paid:</strong> $${res.data.paidNow}</div>
              <div><strong>Payment Method:</strong> ${method}</div>
              <div><strong>Date:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>Remaining Balance:</strong> $${res.data.remainingBalance}</div>
            </div>
          `,
          footerHTML: `
            <button class="btn btn-secondary" onclick="window.print()">Print Receipt</button>
            <button class="btn btn-primary" onclick="closeModal()">Close</button>
          `
        });

        const appContent = document.getElementById('main-content');
        finesView.render(appContent);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  },

  showWaiveModal(fineId, balance) {
    const isAdmin = store.getState().user.role === 'admin';
    openModal({
      title: 'Waive or Reduce Fine',
      size: 'md',
      bodyHTML: `
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
          Waivers above $15 require Administrator authorization.
        </p>
        <div class="form-group">
          <label class="form-label required" for="waive-amount">Waive Amount ($)</label>
          <input type="number" id="waive-amount" class="form-control" value="${balance}" max="${balance}" min="1" step="0.5" />
        </div>
        <div class="form-group">
          <label class="form-label required" for="waive-reason">Detailed Reason for Waiver</label>
          <textarea id="waive-reason" class="form-control" rows="3" placeholder="Document medical leave, system error, exceptional Dean waiver..." required></textarea>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" id="waive-cancel">Cancel</button>
        <button class="btn btn-danger" id="waive-submit">Apply Waiver</button>
      `
    });

    document.getElementById('waive-cancel').onclick = closeModal;

    document.getElementById('waive-submit').onclick = async () => {
      const amount = document.getElementById('waive-amount').value;
      const reason = document.getElementById('waive-reason').value.trim();

      if (!reason) return showToast('A reason is mandatory for any fine waiver.', 'warning');

      try {
        const res = await api.post(`/fines/${fineId}/waive`, { amount, reason });
        showToast(res.message, 'success');
        closeModal();
        const appContent = document.getElementById('main-content');
        finesView.render(appContent);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
};
