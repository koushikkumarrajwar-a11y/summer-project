// ==========================================================
// AUDIT LOG VIEW (Admin Only - Immutable Security Log)
// ==========================================================

import { api } from '../api.js';
import { escapeHTML } from '../components/toast.js';

export const auditView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Security & Operations Audit Trail</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Immutable ledger of administrative actions, authorizations, deletions, and overrides</p>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity Target</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="audit-table-body">
              <tr><td colspan="7" style="text-align: center;">Loading audit logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const res = await api.get('/audit-logs');
      const logs = res.data.logs;
      const tbody = document.getElementById('audit-table-body');

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No audit records found.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map((l) => `
        <tr>
          <td style="font-size: 0.8rem; white-space: nowrap; color: var(--text-muted);">
            ${new Date(l.createdAt).toLocaleString()}
          </td>
          <td><strong>${escapeHTML(l.actorName)}</strong></td>
          <td><span class="badge badge-neutral">${escapeHTML(l.actorRole)}</span></td>
          <td><span class="badge badge-info">${escapeHTML(l.action)}</span></td>
          <td>${escapeHTML(l.entity)} ${l.entityId ? `<code>${escapeHTML(l.entityId.slice(-6))}</code>` : ''}</td>
          <td><code>${escapeHTML(l.ip || '127.0.0.1')}</code></td>
          <td style="font-size: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHTML(JSON.stringify(l.details || {}))}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      document.getElementById('audit-table-body').innerHTML = `<tr><td colspan="7" style="color: var(--color-danger); text-align: center;">${escapeHTML(err.message)}</td></tr>`;
    }
  }
};
