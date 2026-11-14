// ==========================================================
// CIRCULATION WORKSPACE (Split-Screen Desk for Issue & Return)
// ==========================================================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, escapeHTML } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';

export const circulationView = {
  selectedStudent: null,
  selectedCopy: null,
  activeTab: 'issue', // 'issue' or 'return'

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Circulation Desk</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Fast keyboard-friendly desk workspace for checkout and checkin</p>
        </div>
        <div class="page-actions">
          <div class="tabs-nav" style="margin-bottom: 0;">
            <button class="tab-btn ${this.activeTab === 'issue' ? 'active' : ''}" id="tab-issue">Issue Book (Desk)</button>
            <button class="tab-btn ${this.activeTab === 'return' ? 'active' : ''}" id="tab-return">Return Book (Desk)</button>
            <button class="tab-btn" id="tab-history">All Active Loans</button>
          </div>
        </div>
      </div>

      <div id="circulation-body"></div>
    `;

    document.getElementById('tab-issue').onclick = () => {
      this.activeTab = 'issue';
      this.renderIssueDesk();
      this.updateTabs();
    };

    document.getElementById('tab-return').onclick = () => {
      this.activeTab = 'return';
      this.renderReturnDesk();
      this.updateTabs();
    };

    document.getElementById('tab-history').onclick = () => {
      this.activeTab = 'history';
      this.renderLoansTable();
      this.updateTabs();
    };

    if (this.activeTab === 'issue') {
      this.renderIssueDesk();
    } else if (this.activeTab === 'return') {
      this.renderReturnDesk();
    } else {
      this.renderLoansTable();
    }
  },

  updateTabs() {
    document.querySelectorAll('.tabs-nav .tab-btn').forEach((b) => b.classList.remove('active'));
    if (this.activeTab === 'issue') document.getElementById('tab-issue').classList.add('active');
    else if (this.activeTab === 'return') document.getElementById('tab-return').classList.add('active');
    else document.getElementById('tab-history').classList.add('active');
  },

  renderIssueDesk() {
    const body = document.getElementById('circulation-body');
    body.innerHTML = `
      <div class="desk-split-layout">
        <!-- Left Pane: Student Lookup -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">1. Select Student (Borrower)</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label" for="search-student-input">Search Student (Name, Student ID, or Email)</label>
              <input type="text" id="search-student-input" class="form-control" placeholder="e.g. STU-2026-001 or Alex" autofocus />
            </div>

            <div id="student-search-results" style="max-height: 140px; overflow-y: auto; margin-bottom: 1rem;"></div>

            <!-- Selected Student Card -->
            <div id="selected-student-card" style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
              <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0;">
                No student selected. Search above to check eligibility.
              </div>
            </div>
          </div>
        </div>

        <!-- Right Pane: Book Copy Lookup -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">2. Select Book Copy (Accession)</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label" for="search-copy-input">Scan / Enter Accession Number or ISBN</label>
              <input type="text" id="search-copy-input" class="form-control" placeholder="e.g. ACC-5088-01" />
            </div>

            <!-- Selected Book Copy Card -->
            <div id="selected-copy-card" style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
              <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0;">
                No book copy scanned yet.
              </div>
            </div>

            <!-- Issue Action Button -->
            <div style="margin-top: 1.5rem;">
              <button class="btn btn-primary" id="btn-confirm-issue" style="width: 100%; height: 44px; font-size: 1rem;" disabled>
                Issue Book (14-Day Loan)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Student Search Binding
    let studentTimer;
    document.getElementById('search-student-input').addEventListener('input', (e) => {
      clearTimeout(studentTimer);
      studentTimer = setTimeout(async () => {
        const q = e.target.value.trim();
        if (q.length < 2) return;
        try {
          const res = await api.get('/users', { role: 'student', search: q });
          const list = document.getElementById('student-search-results');
          list.innerHTML = res.data.users.map((u) => `
            <div class="student-item-result" data-id="${u._id}" style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; justify-content: space-between; font-size: 0.85rem;">
              <div><strong>${escapeHTML(u.name)}</strong> (${escapeHTML(u.studentId || '')})</div>
              <span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}">${u.status}</span>
            </div>
          `).join('');

          list.querySelectorAll('.student-item-result').forEach((el) => {
            el.onclick = () => this.selectStudent(el.getAttribute('data-id'));
          });
        } catch (err) {
          console.error(err);
        }
      }, 300);
    });

    // Copy Search Binding
    let copyTimer;
    document.getElementById('search-copy-input').addEventListener('input', (e) => {
      clearTimeout(copyTimer);
      copyTimer = setTimeout(async () => {
        const acc = e.target.value.trim();
        if (acc.length < 3) return;
        try {
          const res = await api.get('/books', { search: acc });
          if (res.data.books && res.data.books.length > 0) {
            const b = res.data.books[0];
            const detail = await api.get(`/books/${b._id}`);
            const copy = detail.data.copies.find((c) => c.accessionNumber.toLowerCase().includes(acc.toLowerCase())) || detail.data.copies[0];
            if (copy) {
              this.selectCopy(b, copy);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }, 300);
    });

    // Issue Confirmation Handler
    document.getElementById('btn-confirm-issue').onclick = async () => {
      if (!this.selectedStudent || !this.selectedCopy) return;
      const btn = document.getElementById('btn-confirm-issue');
      btn.disabled = true;
      btn.textContent = 'Recording Loan...';

      try {
        const res = await api.post('/loans', {
          studentId: this.selectedStudent._id,
          accessionNumber: this.selectedCopy.copy.accessionNumber
        });

        showToast(res.message, 'success');
        this.showIssueSlip(res.data);

        // Reset workspace
        this.selectedCopy = null;
        this.renderIssueDesk();
      } catch (err) {
        showToast(err.message, 'error', 5000);
        btn.disabled = false;
        btn.textContent = 'Issue Book (14-Day Loan)';
      }
    };
  },

  async selectStudent(studentId) {
    try {
      const res = await api.get(`/users/${studentId}`);
      const { user, loans, fines } = res.data;
      this.selectedStudent = user;

      const activeLoans = (loans || []).filter((l) => l.status === 'active' || l.status === 'overdue');
      const unpaidFines = (fines || []).filter((f) => f.status === 'unpaid' || f.status === 'partial');
      const fineTotal = unpaidFines.reduce((s, f) => s + (f.amount - f.amountPaid - f.waivedAmount), 0);

      const isEligible = user.status === 'active' && activeLoans.length < 3 && fineTotal <= 20;

      const card = document.getElementById('selected-student-card');
      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
          <div>
            <div style="font-size: 1.05rem; font-weight: 700;">${escapeHTML(user.name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHTML(user.studentId)} &bull; ${escapeHTML(user.department || '')} (${escapeHTML(user.year || '')})</div>
          </div>
          <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}">${user.status}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.825rem; margin-bottom: 1rem;">
          <div style="background: var(--bg-surface); padding: 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="color: var(--text-muted);">Current Loans</div>
            <div style="font-weight: 700; font-size: 1.1rem;">${activeLoans.length} / 3</div>
          </div>
          <div style="background: var(--bg-surface); padding: 0.65rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="color: var(--text-muted);">Unpaid Fines</div>
            <div style="font-weight: 700; font-size: 1.1rem; color: ${fineTotal > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">$${fineTotal}</div>
          </div>
        </div>

        <div style="font-size: 0.85rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); background: ${isEligible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isEligible ? 'var(--color-success)' : 'var(--color-danger)'}; font-weight: 600;">
          ${isEligible ? '✅ Borrower Eligible for Checkout' : '❌ Borrower Ineligible (Check limits or unpaid fines)'}
        </div>
      `;

      this.checkIssueButton();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  selectCopy(book, copy) {
    this.selectedCopy = { book, copy };
    const card = document.getElementById('selected-copy-card');

    const isAvailable = copy.status === 'available' || copy.status === 'on_hold';

    card.innerHTML = `
      <div style="display: flex; gap: 1rem;">
        <div style="width: 70px; height: 100px; background: var(--bg-surface); border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0;">
          <img src="${book.coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200'}" alt="${escapeHTML(book.title)}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="flex-grow: 1;">
          <div style="font-weight: 700; font-size: 0.95rem;">${escapeHTML(book.title)}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Accession: <code>${escapeHTML(copy.accessionNumber)}</code></div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Condition: <strong>${escapeHTML(copy.condition)}</strong></div>
          <div style="margin-top: 0.4rem;">
            <span class="badge ${isAvailable ? 'badge-success' : 'badge-danger'}">
              Copy Status: ${copy.status}
            </span>
          </div>
        </div>
      </div>
    `;

    this.checkIssueButton();
  },

  checkIssueButton() {
    const btn = document.getElementById('btn-confirm-issue');
    if (!btn) return;
    if (this.selectedStudent && this.selectedCopy && this.selectedStudent.status === 'active') {
      btn.disabled = false;
    } else {
      btn.disabled = true;
    }
  },

  showIssueSlip(loan) {
    openModal({
      title: 'Loan Confirmation & Receipt Slip',
      size: 'md',
      bodyHTML: `
        <div style="text-align: center; border-bottom: 2px dashed var(--border-color); padding-bottom: 1rem; margin-bottom: 1rem;">
          <div style="font-weight: 700; font-size: 1.1rem;">Central University Library</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Official Checkout Issue Receipt</div>
        </div>

        <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.5rem;">
          <div><strong>Student Name:</strong> ${escapeHTML(loan.studentId ? loan.studentId.name : '')} (${escapeHTML(loan.studentId ? loan.studentId.studentId : '')})</div>
          <div><strong>Book Title:</strong> ${escapeHTML(loan.bookId ? loan.bookId.title : '')}</div>
          <div><strong>Accession Number:</strong> <code>${escapeHTML(loan.copyId ? loan.copyId.accessionNumber : '')}</code></div>
          <div><strong>Issue Date:</strong> ${new Date(loan.issueDate).toLocaleDateString()}</div>
          <div style="color: var(--primary-600); font-size: 1rem; font-weight: 700; margin-top: 0.5rem;">
            Due Date: ${new Date(loan.dueDate).toLocaleDateString()}
          </div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="window.print()">Print Slip</button>
        <button class="btn btn-primary" id="slip-close">Done</button>
      `
    });
    document.getElementById('slip-close').onclick = closeModal;
  },

  renderReturnDesk() {
    const body = document.getElementById('circulation-body');
    body.innerHTML = `
      <div class="card" style="max-width: 680px; margin: 0 auto;">
        <div class="card-header">
          <h3 class="card-title">Book Return Desk</h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label" for="return-accession-input">Scan Accession Number</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="return-accession-input" class="form-control" placeholder="Scan or type accession (e.g. ACC-5088-01)" autofocus />
              <button class="btn btn-primary" id="btn-find-loan">Find Loan</button>
            </div>
          </div>

          <div id="return-loan-details" style="margin-top: 1.25rem;"></div>
        </div>
      </div>
    `;

    document.getElementById('btn-find-loan').onclick = async () => {
      const acc = document.getElementById('return-accession-input').value.trim();
      if (!acc) return showToast('Please enter an accession number', 'warning');

      try {
        const res = await api.get('/loans', { status: 'active' });
        const loan = res.data.loans.find((l) => l.copyId && l.copyId.accessionNumber.toLowerCase() === acc.toLowerCase());

        const detailsEl = document.getElementById('return-loan-details');
        if (!loan) {
          detailsEl.innerHTML = `
            <div class="empty-state">
              <p style="color: var(--color-danger);">No active loan record found for accession "${escapeHTML(acc)}".</p>
            </div>
          `;
          return;
        }

        const isOverdue = new Date() > new Date(loan.dueDate);
        const diffMs = Math.abs(new Date() - new Date(loan.dueDate));
        const daysOverdue = isOverdue ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0;
        const estimatedFine = daysOverdue * 5;

        detailsEl.innerHTML = `
          <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
            <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 0.25rem;">${escapeHTML(loan.bookId ? loan.bookId.title : 'Book')}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
              Borrowed by: <strong>${escapeHTML(loan.studentId ? loan.studentId.name : '')}</strong> (${escapeHTML(loan.studentId ? loan.studentId.studentId : '')})
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem; margin-bottom: 1rem;">
              <div><strong>Issue Date:</strong> ${new Date(loan.issueDate).toLocaleDateString()}</div>
              <div><strong>Due Date:</strong> ${new Date(loan.dueDate).toLocaleDateString()}</div>
            </div>

            ${isOverdue ? `
              <div style="background: rgba(239, 68, 68, 0.15); color: var(--color-danger); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem;">
                ⚠️ <strong>Overdue by ${daysOverdue} days!</strong> Calculated automatic fine: <strong>$${estimatedFine}</strong>.
              </div>
            ` : '<div style="color: var(--color-success); font-weight: 600; margin-bottom: 1rem; font-size: 0.85rem;">✅ Returned on time (No overdue fine)</div>'}

            <!-- Condition Selection (Section E2) -->
            <div class="form-group">
              <label class="form-label required">Book Condition on Return</label>
              <select id="return-condition-select" class="form-control">
                <option value="good" selected>Good Condition (Normal)</option>
                <option value="damaged">Damaged (Assess repair charge)</option>
                <option value="lost">Lost (Assess replacement price + $10 fee)</option>
              </select>
            </div>

            <div id="damage-charge-field" style="display: none; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label required">Damage Charge ($)</label>
                <input type="number" id="damage-charge-amount" class="form-control" value="10" min="1" />
              </div>
              <div class="form-group">
                <label class="form-label">Reason / Damage Description</label>
                <input type="text" id="damage-charge-reason" class="form-control" placeholder="Torn pages, water damage, broken binding..." />
              </div>
            </div>

            <button class="btn btn-primary" id="btn-submit-return" style="width: 100%; height: 42px; margin-top: 0.5rem;">
              Confirm Return & Update Inventory
            </button>
          </div>
        `;

        const condSelect = document.getElementById('return-condition-select');
        condSelect.onchange = (e) => {
          document.getElementById('damage-charge-field').style.display = e.target.value === 'damaged' ? 'block' : 'none';
        };

        document.getElementById('btn-submit-return').onclick = async () => {
          const condition = condSelect.value;
          const damageCharge = document.getElementById('damage-charge-amount') ? document.getElementById('damage-charge-amount').value : 0;
          const damageReason = document.getElementById('damage-charge-reason') ? document.getElementById('damage-charge-reason').value : '';

          try {
            const retRes = await api.post(`/loans/${loan._id}/return`, {
              condition,
              damageCharge,
              damageReason
            });
            showToast(retRes.message, 'success');
            circulationView.renderReturnDesk();
          } catch (err) {
            showToast(err.message, 'error');
          }
        };
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  },

  async renderLoansTable() {
    const body = document.getElementById('circulation-body');
    body.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">All System Loans</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Book Title</th>
                <th>Accession #</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="loans-table-body">
              <tr><td colspan="6" style="text-align: center;">Loading loans...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await api.get('/loans', { limit: 50 });
      const tb = document.getElementById('loans-table-body');
      if (res.data.loans.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No loans recorded yet.</td></tr>';
        return;
      }
      tb.innerHTML = res.data.loans.map((l) => `
        <tr>
          <td>
            <strong>${escapeHTML(l.studentId ? l.studentId.name : 'Unknown')}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(l.studentId ? l.studentId.studentId : '')}</div>
          </td>
          <td>${escapeHTML(l.bookId ? l.bookId.title : 'Book')}</td>
          <td><code>${escapeHTML(l.copyId ? l.copyId.accessionNumber : '')}</code></td>
          <td>${new Date(l.issueDate).toLocaleDateString()}</td>
          <td style="${l.status === 'overdue' ? 'color: var(--color-danger); font-weight: 600;' : ''}">
            ${new Date(l.dueDate).toLocaleDateString()}
          </td>
          <td>
            <span class="badge ${l.status === 'returned' ? 'badge-neutral' : l.status === 'overdue' ? 'badge-danger' : 'badge-success'}">
              ${l.status}
            </span>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  }
};
