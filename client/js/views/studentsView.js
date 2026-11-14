// ==========================================================
// USER MANAGEMENT VIEW (Students & Librarians)
// ==========================================================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, escapeHTML } from '../components/toast.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';

export const studentsView = {
  currentRoleTab: 'student', // 'student' or 'librarian'
  currentStatusFilter: '',
  currentSearch: '',

  async render(container) {
    const user = store.getState().user;
    const isAdmin = user && user.role === 'admin';

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">User Accounts</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Manage library members, verification status, and permissions</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" id="btn-create-user">+ Add User</button>
        </div>
      </div>

      <!-- Role Tabs (Admin can toggle between Students & Librarians) -->
      ${isAdmin ? `
        <div class="tabs-nav">
          <button class="tab-btn ${this.currentRoleTab === 'student' ? 'active' : ''}" id="tab-students">Students</button>
          <button class="tab-btn ${this.currentRoleTab === 'librarian' ? 'active' : ''}" id="tab-librarians">Librarians</button>
        </div>
      ` : ''}

      <!-- Search & Status Filter -->
      <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <div style="flex-grow: 1; min-width: 220px;">
            <input type="text" id="users-search-input" class="form-control" placeholder="Search by name, student ID, email..." value="${escapeHTML(this.currentSearch)}" />
          </div>
          <div style="width: 180px;">
            <select id="users-status-select" class="form-control">
              <option value="">All Statuses</option>
              <option value="active" ${this.currentStatusFilter === 'active' ? 'selected' : ''}>Active</option>
              <option value="pending" ${this.currentStatusFilter === 'pending' ? 'selected' : ''}>Pending Review</option>
              <option value="suspended" ${this.currentStatusFilter === 'suspended' ? 'selected' : ''}>Suspended</option>
              <option value="graduated" ${this.currentStatusFilter === 'graduated' ? 'selected' : ''}>Graduated</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Name & Email</th>
                ${this.currentRoleTab === 'student' ? '<th>Student ID</th><th>Department</th>' : '<th>Department</th>'}
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <tr><td colspan="6" style="text-align: center;">Loading user records...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (isAdmin) {
      document.getElementById('tab-students').onclick = () => {
        this.currentRoleTab = 'student';
        this.render(container);
      };
      document.getElementById('tab-librarians').onclick = () => {
        this.currentRoleTab = 'librarian';
        this.render(container);
      };
    }

    document.getElementById('btn-create-user').onclick = () => this.showCreateUserModal();

    let searchTimer;
    document.getElementById('users-search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.currentSearch = e.target.value.trim();
        this.loadUsers();
      }, 300);
    });

    document.getElementById('users-status-select').onchange = (e) => {
      this.currentStatusFilter = e.target.value;
      this.loadUsers();
    };

    await this.loadUsers();
  },

  async loadUsers() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    try {
      const res = await api.get('/users', {
        role: this.currentRoleTab,
        status: this.currentStatusFilter,
        search: this.currentSearch
      });

      const users = res.data.users;
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No user accounts found matching your filters.</td></tr>';
        return;
      }

      tbody.innerHTML = users.map((u) => {
        let badge = 'badge-success';
        if (u.status === 'pending') badge = 'badge-warning';
        else if (u.status === 'suspended') badge = 'badge-danger';
        else if (u.status === 'graduated') badge = 'badge-neutral';

        return `
          <tr>
            <td>
              <strong>${escapeHTML(u.name)}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(u.email)}</div>
            </td>
            ${this.currentRoleTab === 'student' ? `<td><code>${escapeHTML(u.studentId || '-')}</code></td>` : ''}
            <td>${escapeHTML(u.department || '-')} ${u.year ? `(${escapeHTML(u.year)})` : ''}</td>
            <td><span class="badge ${badge}">${u.status}</span></td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(u.createdAt).toLocaleDateString()}</td>
            <td>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-secondary btn-sm user-view-btn" data-id="${u._id}">Profile</button>
                ${u.status === 'pending' ? `
                  <button class="btn btn-primary btn-sm user-approve-btn" data-id="${u._id}">Activate</button>
                ` : ''}
                ${u.status === 'active' ? `
                  <button class="btn btn-ghost btn-sm user-suspend-btn" data-id="${u._id}" style="color: var(--color-danger);">Suspend</button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.user-view-btn').forEach((btn) => {
        btn.onclick = () => this.showUserProfileModal(btn.getAttribute('data-id'));
      });

      tbody.querySelectorAll('.user-approve-btn').forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          try {
            await api.patch(`/users/${id}/status`, { status: 'active' });
            showToast('Account activated successfully!', 'success');
            studentsView.loadUsers();
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });

      tbody.querySelectorAll('.user-suspend-btn').forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          confirmDialog({
            title: 'Suspend Account',
            message: 'Are you sure you want to suspend this user? They will not be able to borrow books or log in.',
            confirmText: 'Suspend',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
              try {
                await api.patch(`/users/${id}/status`, { status: 'suspended' });
                showToast('Account suspended.', 'info');
                studentsView.loadUsers();
              } catch (e) {
                showToast(e.message, 'error');
              }
            }
          });
        };
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color: var(--color-danger); text-align: center;">${escapeHTML(err.message)}</td></tr>`;
    }
  },

  async showUserProfileModal(userId) {
    try {
      const res = await api.get(`/users/${userId}`);
      const { user, loans, reservations, fines } = res.data;

      openModal({
        title: `${user.name} - Profile`,
        size: 'lg',
        bodyHTML: `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.85rem;">
            <div><strong>Role:</strong> ${user.role}</div>
            <div><strong>Status:</strong> <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-warning'}">${user.status}</span></div>
            <div><strong>Email:</strong> ${escapeHTML(user.email)}</div>
            <div><strong>Student ID:</strong> ${escapeHTML(user.studentId || 'N/A')}</div>
            <div><strong>Department:</strong> ${escapeHTML(user.department || '-')}</div>
            <div><strong>Phone:</strong> ${escapeHTML(user.phone || '-')}</div>
          </div>

          <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem;">Recent Loan History (${loans.length})</h4>
          <div style="max-height: 140px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
            <table class="table" style="font-size: 0.8rem;">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${loans.length > 0 ? loans.map((l) => `
                  <tr>
                    <td>${escapeHTML(l.bookId ? l.bookId.title : 'Book')}</td>
                    <td>${new Date(l.issueDate).toLocaleDateString()}</td>
                    <td>${new Date(l.dueDate).toLocaleDateString()}</td>
                    <td><span class="badge ${l.status === 'active' ? 'badge-info' : 'badge-neutral'}">${l.status}</span></td>
                  </tr>
                `).join('') : '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No loan records</td></tr>'}
              </tbody>
            </table>
          </div>

          <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem;">Fines Ledger (${fines.length})</h4>
          <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <table class="table" style="font-size: 0.8rem;">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${fines.length > 0 ? fines.map((f) => `
                  <tr>
                    <td>${escapeHTML(f.reason)} (${escapeHTML(f.description || '')})</td>
                    <td>$${f.amount}</td>
                    <td>$${f.amountPaid}</td>
                    <td><span class="badge ${f.status === 'paid' ? 'badge-success' : 'badge-danger'}">${f.status}</span></td>
                  </tr>
                `).join('') : '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No fines assessed</td></tr>'}
              </tbody>
            </table>
          </div>
        `,
        footerHTML: `<button class="btn btn-secondary" id="profile-close">Close</button>`
      });

      document.getElementById('profile-close').onclick = closeModal;
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  showCreateUserModal() {
    const isAdmin = store.getState().user.role === 'admin';
    openModal({
      title: 'Create New User Account',
      size: 'md',
      bodyHTML: `
        <form id="create-user-form">
          ${isAdmin ? `
            <div class="form-group">
              <label class="form-label required" for="new-role">Account Role</label>
              <select id="new-role" class="form-control">
                <option value="student" selected>Student</option>
                <option value="librarian">Librarian</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          ` : '<input type="hidden" id="new-role" value="student" />'}

          <div class="form-group">
            <label class="form-label required" for="new-name">Full Name</label>
            <input type="text" id="new-name" class="form-control" required />
          </div>

          <div class="form-group">
            <label class="form-label required" for="new-email">Email</label>
            <input type="email" id="new-email" class="form-control" required />
          </div>

          <div class="form-group" id="student-id-wrap">
            <label class="form-label required" for="new-student-id">Student ID</label>
            <input type="text" id="new-student-id" class="form-control" placeholder="STU-2026-..." />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="new-dept">Department</label>
              <input type="text" id="new-dept" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label" for="new-year">Year</label>
              <input type="text" id="new-year" class="form-control" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label required" for="new-password">Temporary Password</label>
            <input type="password" id="new-password" class="form-control" required placeholder="••••••••" />
          </div>
        </form>
      `,
      footerHTML: `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-submit">Create Account</button>
      `
    });

    document.getElementById('modal-cancel').onclick = closeModal;

    const roleSelect = document.getElementById('new-role');
    if (roleSelect) {
      roleSelect.onchange = (e) => {
        document.getElementById('student-id-wrap').style.display = e.target.value === 'student' ? 'block' : 'none';
      };
    }

    document.getElementById('modal-submit').onclick = async () => {
      const role = document.getElementById('new-role').value;
      const name = document.getElementById('new-name').value.trim();
      const email = document.getElementById('new-email').value.trim();
      const studentId = document.getElementById('new-student-id').value.trim();
      const department = document.getElementById('new-dept').value.trim();
      const year = document.getElementById('new-year').value.trim();
      const password = document.getElementById('new-password').value;

      if (!name || !email || !password) return showToast('Please fill out all required fields', 'warning');
      if (role === 'student' && !studentId) return showToast('Student ID is required', 'warning');

      try {
        const res = await api.post('/users', {
          role,
          name,
          email,
          studentId,
          department,
          year,
          password
        });
        showToast(res.message, 'success');
        closeModal();
        studentsView.loadUsers();
      } catch (e) {
        showToast(e.message, 'error');
      }
    };
  }
};
