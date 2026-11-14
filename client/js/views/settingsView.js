// ==========================================================
// SYSTEM SETTINGS VIEW (Admin Only)
// ==========================================================

import { api } from '../api.js';
import { showToast, escapeHTML } from '../components/toast.js';

export const settingsView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">System Settings & Circulation Rules</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Configure loan durations, daily fine penalties, limits, and registration flow</p>
        </div>
      </div>

      <div class="card" style="max-width: 800px;">
        <div class="card-body">
          <form id="settings-form">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--primary-600);">1. General Institution Information</h3>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label required" for="set-name">Library Name</label>
                <input type="text" id="set-name" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label required" for="set-currency">Currency Symbol</label>
                <input type="text" id="set-currency" class="form-control" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label" for="set-email">Contact Email</label>
                <input type="email" id="set-email" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label" for="set-phone">Contact Phone</label>
                <input type="text" id="set-phone" class="form-control" />
              </div>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;" />

            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--primary-600);">2. Circulation & Borrowing Rules</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label required" for="set-loan-period">Loan Period (Days)</label>
                <input type="number" id="set-loan-period" class="form-control" min="1" required />
              </div>
              <div class="form-group">
                <label class="form-label required" for="set-max-books">Max Books Per Student</label>
                <input type="number" id="set-max-books" class="form-control" min="1" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label required" for="set-renew-limit">Renewal Limit (Times)</label>
                <input type="number" id="set-renew-limit" class="form-control" min="0" required />
              </div>
              <div class="form-group">
                <label class="form-label required" for="set-hold-days">Reservation Hold Pickup Window (Days)</label>
                <input type="number" id="set-hold-days" class="form-control" min="1" required />
              </div>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;" />

            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--primary-600);">3. Fines & Registration Policy</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label required" for="set-fine-rate">Fine Per Day ($)</label>
                <input type="number" id="set-fine-rate" class="form-control" min="0" step="0.5" required />
              </div>
              <div class="form-group">
                <label class="form-label required" for="set-max-cap">Max Fine Cap ($)</label>
                <input type="number" id="set-max-cap" class="form-control" min="0" required />
              </div>
              <div class="form-group">
                <label class="form-label required" for="set-fine-block">Fine Block Threshold ($)</label>
                <input type="number" id="set-fine-block" class="form-control" min="0" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label required" for="set-waiver-thresh">Admin Waiver Threshold ($)</label>
                <input type="number" id="set-waiver-thresh" class="form-control" min="0" required />
              </div>
              <div class="form-group">
                <label class="form-label required" for="set-reg-mode">Student Registration Mode</label>
                <select id="set-reg-mode" class="form-control">
                  <option value="approval">Librarian Review & Approval Required (Default)</option>
                  <option value="auto">Auto-Activate Immediately</option>
                </select>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-save-settings" style="margin-top: 1.5rem; height: 42px; width: 200px;">
              Save System Settings
            </button>
          </form>
        </div>
      </div>
    `;

    try {
      const res = await api.get('/settings');
      const s = res.data;

      document.getElementById('set-name').value = s.libraryName || '';
      document.getElementById('set-currency').value = s.currency || '$';
      document.getElementById('set-email').value = s.contactEmail || '';
      document.getElementById('set-phone').value = s.contactPhone || '';
      document.getElementById('set-loan-period').value = s.loanPeriodDays || 14;
      document.getElementById('set-max-books').value = s.maxBooksPerStudent || 3;
      document.getElementById('set-renew-limit').value = s.renewalLimit || 2;
      document.getElementById('set-hold-days').value = s.reservationPickupDays || 3;
      document.getElementById('set-fine-rate').value = s.finePerDay || 5;
      document.getElementById('set-max-cap').value = s.maxFineCap || 50;
      document.getElementById('set-fine-block').value = s.fineBlockThreshold || 20;
      document.getElementById('set-waiver-thresh').value = s.waiverApprovalThreshold || 15;
      document.getElementById('set-reg-mode').value = s.registrationMode || 'approval';
    } catch (e) {
      showToast(e.message, 'error');
    }

    document.getElementById('settings-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-settings');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const payload = {
          libraryName: document.getElementById('set-name').value.trim(),
          currency: document.getElementById('set-currency').value.trim(),
          contactEmail: document.getElementById('set-email').value.trim(),
          contactPhone: document.getElementById('set-phone').value.trim(),
          loanPeriodDays: parseInt(document.getElementById('set-loan-period').value),
          maxBooksPerStudent: parseInt(document.getElementById('set-max-books').value),
          renewalLimit: parseInt(document.getElementById('set-renew-limit').value),
          reservationPickupDays: parseInt(document.getElementById('set-hold-days').value),
          finePerDay: parseFloat(document.getElementById('set-fine-rate').value),
          maxFineCap: parseFloat(document.getElementById('set-max-cap').value),
          fineBlockThreshold: parseFloat(document.getElementById('set-fine-block').value),
          waiverApprovalThreshold: parseFloat(document.getElementById('set-waiver-thresh').value),
          registrationMode: document.getElementById('set-reg-mode').value
        };

        const res = await api.put('/settings', payload);
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save System Settings';
      }
    };
  }
};
