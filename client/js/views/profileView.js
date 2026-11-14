// ==========================================================
// MY PROFILE VIEW (Profile Update & Password Change)
// ==========================================================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, escapeHTML } from '../components/toast.js';

export const profileView = {
  async render(container) {
    const user = store.getState().user;
    if (!user) return;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Account Profile</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Manage your credentials and personal contact details</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; max-width: 900px;">
        <!-- Personal Information Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Personal Details</h3>
          </div>
          <div class="card-body">
            <form id="profile-form">
              <div class="form-group">
                <label class="form-label" for="prof-role">Role</label>
                <input type="text" id="prof-role" class="form-control" value="${user.role.toUpperCase()}" disabled />
              </div>

              <div class="form-group">
                <label class="form-label" for="prof-email">Email Address</label>
                <input type="email" id="prof-email" class="form-control" value="${escapeHTML(user.email)}" disabled />
              </div>

              ${user.studentId ? `
                <div class="form-group">
                  <label class="form-label" for="prof-sid">Student ID</label>
                  <input type="text" id="prof-sid" class="form-control" value="${escapeHTML(user.studentId)}" disabled />
                </div>
              ` : ''}

              <div class="form-group">
                <label class="form-label required" for="prof-name">Full Name</label>
                <input type="text" id="prof-name" class="form-control" value="${escapeHTML(user.name)}" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="prof-phone">Phone Number</label>
                <input type="text" id="prof-phone" class="form-control" value="${escapeHTML(user.phone || '')}" />
              </div>

              <div class="form-group">
                <label class="form-label" for="prof-dept">Department</label>
                <input type="text" id="prof-dept" class="form-control" value="${escapeHTML(user.department || '')}" />
              </div>

              <button type="submit" class="btn btn-primary" id="btn-save-profile" style="margin-top: 0.5rem; width: 100%;">
                Save Profile
              </button>
            </form>
          </div>
        </div>

        <!-- Change Password Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Change Password</h3>
          </div>
          <div class="card-body">
            <form id="password-form">
              <div class="form-group">
                <label class="form-label required" for="pw-current">Current Password</label>
                <input type="password" id="pw-current" class="form-control" placeholder="••••••••" required />
              </div>

              <div class="form-group">
                <label class="form-label required" for="pw-new">New Password (min 8 chars)</label>
                <input type="password" id="pw-new" class="form-control" placeholder="••••••••" required />
              </div>

              <div class="form-group">
                <label class="form-label required" for="pw-confirm">Confirm New Password</label>
                <input type="password" id="pw-confirm" class="form-control" placeholder="••••••••" required />
              </div>

              <button type="submit" class="btn btn-primary" id="btn-save-pw" style="margin-top: 0.5rem; width: 100%;">
                Update Password
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.getElementById('profile-form').onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('prof-name').value.trim();
      const phone = document.getElementById('prof-phone').value.trim();
      const department = document.getElementById('prof-dept').value.trim();

      try {
        const res = await api.put('/users/me', { name, phone, department });
        store.setState({ user: res.data });
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    document.getElementById('password-form').onsubmit = async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('pw-current').value;
      const newPassword = document.getElementById('pw-new').value;
      const confirmPassword = document.getElementById('pw-confirm').value;

      if (newPassword !== confirmPassword) {
        return showToast('New passwords do not match!', 'warning');
      }
      if (newPassword.length < 8) {
        return showToast('New password must be at least 8 characters long.', 'warning');
      }

      try {
        const res = await api.put('/users/me/password', { currentPassword, newPassword });
        showToast(res.message, 'success');
        document.getElementById('password-form').reset();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
};
