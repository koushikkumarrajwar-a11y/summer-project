// ==========================================================
// REPORTS & ANALYTICS VIEW (Circulation, Inventory, Fines)
// ==========================================================

import { api } from '../api.js';
import { showToast, escapeHTML } from '../components/toast.js';

export const reportsView = {
  activeTab: 'circulation',

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Reports & Collection Analytics</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Collection usage, top borrowed titles, inventory health, and revenue</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">Print Report View</button>
        </div>
      </div>

      <div class="tabs-nav">
        <button class="tab-btn ${this.activeTab === 'circulation' ? 'active' : ''}" id="rep-tab-circ">Circulation & Activity</button>
        <button class="tab-btn ${this.activeTab === 'inventory' ? 'active' : ''}" id="rep-tab-inv">Inventory Status</button>
        <button class="tab-btn ${this.activeTab === 'fines' ? 'active' : ''}" id="rep-tab-fines">Fines & Revenue</button>
      </div>

      <div id="report-content-body">
        <div style="padding: 2rem; text-align: center;"><div class="skeleton" style="height: 200px;"></div></div>
      </div>
    `;

    document.getElementById('rep-tab-circ').onclick = () => {
      this.activeTab = 'circulation';
      this.updateTabs();
      this.loadCirculationReport();
    };

    document.getElementById('rep-tab-inv').onclick = () => {
      this.activeTab = 'inventory';
      this.updateTabs();
      this.loadInventoryReport();
    };

    document.getElementById('rep-tab-fines').onclick = () => {
      this.activeTab = 'fines';
      this.updateTabs();
      this.loadFinesReport();
    };

    if (this.activeTab === 'circulation') this.loadCirculationReport();
    else if (this.activeTab === 'inventory') this.loadInventoryReport();
    else this.loadFinesReport();
  },

  updateTabs() {
    document.querySelectorAll('.tabs-nav .tab-btn').forEach((b) => b.classList.remove('active'));
    if (this.activeTab === 'circulation') document.getElementById('rep-tab-circ').classList.add('active');
    else if (this.activeTab === 'inventory') document.getElementById('rep-tab-inv').classList.add('active');
    else document.getElementById('rep-tab-fines').classList.add('active');
  },

  async loadCirculationReport() {
    const el = document.getElementById('report-content-body');
    try {
      const res = await api.get('/reports/circulation');
      const { mostBorrowed, mostActiveStudents } = res.data;

      el.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Top 10 Most Borrowed Books</h3>
            </div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Borrow Count</th>
                  </tr>
                </thead>
                <tbody>
                  ${mostBorrowed.map((b) => `
                    <tr>
                      <td><strong>${escapeHTML(b.title)}</strong></td>
                      <td><span class="badge badge-info">${b.borrowCount} checkouts</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Top 10 Most Active Borrowers</h3>
            </div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Total Loans</th>
                  </tr>
                </thead>
                <tbody>
                  ${mostActiveStudents.map((s) => `
                    <tr>
                      <td><strong>${escapeHTML(s.name)}</strong> (${escapeHTML(s.studentId)})</td>
                      <td><span class="badge badge-success">${s.totalLoans} loans</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = `<p style="color: var(--color-danger);">${escapeHTML(e.message)}</p>`;
    }
  },

  async loadInventoryReport() {
    const el = document.getElementById('report-content-body');
    try {
      const res = await api.get('/reports/inventory');
      const { copyStatusBreakdown, categoryDistribution } = res.data;

      el.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Physical Copy Statuses</h3>
            </div>
            <div class="card-body">
              ${copyStatusBreakdown.map((cs) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0; border-bottom: 1px solid var(--border-color);">
                  <span style="text-transform: capitalize; font-weight: 500;">${cs._id.replace(/_/g, ' ')}</span>
                  <span class="badge badge-neutral">${cs.count} copies</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Category Holdings Breakdown</h3>
            </div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Titles</th>
                    <th>Total Physical Copies</th>
                  </tr>
                </thead>
                <tbody>
                  ${categoryDistribution.map((cat) => `
                    <tr>
                      <td><strong>${escapeHTML(cat.categoryName)}</strong></td>
                      <td>${cat.totalTitles}</td>
                      <td>${cat.totalCopies}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = `<p style="color: var(--color-danger);">${escapeHTML(e.message)}</p>`;
    }
  },

  async loadFinesReport() {
    const el = document.getElementById('report-content-body');
    try {
      const res = await api.get('/reports/fines');
      const d = res.data;

      el.innerHTML = `
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-icon-wrap" style="background: rgba(99, 102, 241, 0.15); color: var(--primary-600);">📊</div>
            <div class="metric-data">
              <div class="metric-value">$${d.totalAccrued}</div>
              <div class="metric-label">Total Fines Accrued</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: var(--color-success);">💵</div>
            <div class="metric-data">
              <div class="metric-value">$${d.totalCollected}</div>
              <div class="metric-label">Total Revenue Collected</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-wrap" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-500);">🏷️</div>
            <div class="metric-data">
              <div class="metric-value">$${d.totalWaived}</div>
              <div class="metric-label">Total Waived</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon-wrap" style="background: rgba(239, 68, 68, 0.15); color: var(--color-danger);">⚠️</div>
            <div class="metric-data">
              <div class="metric-value" style="color: var(--color-danger);">$${d.totalOutstanding}</div>
              <div class="metric-label">Total Still Outstanding</div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = `<p style="color: var(--color-danger);">${escapeHTML(e.message)}</p>`;
    }
  }
};
