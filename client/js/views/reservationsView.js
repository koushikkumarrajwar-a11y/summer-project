// ==========================================================
// RESERVATIONS VIEW (FIFO Queue, Hold Status, Fulfillment)
// ==========================================================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, escapeHTML } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';

export const reservationsView = {
  async render(container) {
    const user = store.getState().user;
    const isStudent = user && user.role === 'student';

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${isStudent ? 'My Book Reservations' : 'Title Reservations Queue'}</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">First-in-first-out hold requests for currently unavailable titles</p>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Title</th>
                ${!isStudent ? '<th>Student</th>' : ''}
                <th>Queue Position</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Hold Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="res-table-body">
              <tr><td colspan="7" style="text-align: center;">Loading reservations...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const endpoint = isStudent ? '/reservations/me' : '/reservations';
      const res = await api.get(endpoint);
      const list = isStudent ? res.data : res.data.reservations;
      const tbody = document.getElementById('res-table-body');

      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No active reservations found.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map((r) => {
        let badge = 'badge-warning';
        if (r.status === 'ready_for_pickup') badge = 'badge-success';
        else if (r.status === 'fulfilled') badge = 'badge-neutral';
        else if (r.status === 'cancelled' || r.status === 'expired') badge = 'badge-danger';

        const canCancel = r.status === 'pending' || r.status === 'ready_for_pickup';

        return `
          <tr>
            <td>
              <strong>${escapeHTML(r.bookId ? r.bookId.title : 'Book')}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">ISBN: ${escapeHTML(r.bookId ? r.bookId.isbn : '')}</div>
            </td>
            ${!isStudent ? `
              <td>
                <strong>${escapeHTML(r.studentId ? r.studentId.name : 'Unknown')}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(r.studentId ? r.studentId.studentId : '')}</div>
              </td>
            ` : ''}
            <td><span class="badge badge-info">Queue #${r.queuePosition}</span></td>
            <td><span class="badge ${badge}">${r.status.replace(/_/g, ' ')}</span></td>
            <td>${new Date(r.createdAt).toLocaleDateString()}</td>
            <td>${r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : '-'}</td>
            <td>
              <div style="display: flex; gap: 0.35rem;">
                ${canCancel ? `
                  <button class="btn btn-outline-danger btn-sm res-cancel-btn" data-id="${r._id}">Cancel</button>
                ` : ''}
                ${!isStudent && r.status === 'ready_for_pickup' ? `
                  <button class="btn btn-secondary btn-sm res-extend-btn" data-id="${r._id}">Extend +2 Days</button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.res-cancel-btn').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          confirmDialog({
            title: 'Cancel Reservation',
            message: 'Are you sure you want to cancel this reservation hold?',
            confirmText: 'Cancel Hold',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
              try {
                await api.patch(`/reservations/${id}`, { action: 'cancel' });
                showToast('Reservation cancelled', 'info');
                reservationsView.render(container);
              } catch (e) {
                showToast(e.message, 'error');
              }
            }
          });
        };
      });

      tbody.querySelectorAll('.res-extend-btn').forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          try {
            const extRes = await api.patch(`/reservations/${id}`, { action: 'extend', extendDays: 2 });
            showToast(extRes.message, 'success');
            reservationsView.render(container);
          } catch (e) {
            showToast(e.message, 'error');
          }
        };
      });
    } catch (err) {
      document.getElementById('res-table-body').innerHTML = `<tr><td colspan="7" style="color: var(--color-danger); text-align: center;">${escapeHTML(err.message)}</td></tr>`;
    }
  }
};
