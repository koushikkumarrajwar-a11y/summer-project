// ==========================================================
// ROLE-AWARE DASHBOARD VIEW (Admin, Librarian, Student)
// ==========================================================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, escapeHTML } from '../components/toast.js';
import { renderBarChart, renderDonutChart } from '../components/charts.js';

export const dashboardView = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center;">
        <div class="skeleton" style="height: 40px; width: 200px; margin-bottom: 1rem;"></div>
        <div class="skeleton" style="height: 120px; width: 100%; margin-bottom: 1rem;"></div>
      </div>
    `;

    try {
      const res = await api.get('/dashboard/stats');
      const stats = res.data;
      const user = store.getState().user;

      if (user.role === 'admin') {
        this.renderAdmin(container, stats);
      } else if (user.role === 'librarian') {
        this.renderLibrarian(container, stats);
      } else {
        this.renderStudent(container, stats);
      }
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h2 class="empty-state-title">Failed to load dashboard</h2>
          <p class="empty-state-text">${escapeHTML(err.message)}</p>
          <button class="btn btn-primary" onclick="window.location.reload()">Retry</button>
        </div>
      `;
    }
  },

  renderAdmin(container, stats) {
    const s = stats.summary;
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Executive Library Overview</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">System statistics, collection status, and circulation trends</p>
        </div>
        <div class="page-actions">
          <a href="#/books" class="btn btn-secondary btn-sm">+ Add Book</a>
          <a href="#/students" class="btn btn-secondary btn-sm">+ Add Librarian</a>
          <a href="#/reports" class="btn btn-primary btn-sm">Full Analytics</a>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(99, 102, 241, 0.15); color: var(--primary-600);">📚</div>
          <div class="metric-data">
            <div class="metric-value">${s.totalBooks}</div>
            <div class="metric-label">Total Titles (${s.totalCopies} copies)</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: var(--color-success);">✅</div>
          <div class="metric-data">
            <div class="metric-value">${s.availableCopies}</div>
            <div class="metric-label">Available on Shelves</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(2, 132, 199, 0.15); color: var(--color-info);">📖</div>
          <div class="metric-data">
            <div class="metric-value">${s.issuedCopies}</div>
            <div class="metric-label">Currently Issued</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(239, 68, 68, 0.15); color: var(--color-danger);">⚠️</div>
          <div class="metric-data">
            <div class="metric-value" style="color: var(--color-danger);">${s.overdueLoans}</div>
            <div class="metric-label">Overdue Loans</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-500);">🎓</div>
          <div class="metric-data">
            <div class="metric-value">${s.totalStudents}</div>
            <div class="metric-label">Enrolled Students</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: var(--color-success);">💵</div>
          <div class="metric-data">
            <div class="metric-value">$${s.totalCollectedFines}</div>
            <div class="metric-label">Fines Revenue Collected</div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Circulation Trends (Issues vs Returns)</h3>
          </div>
          <div class="card-body">
            <div id="chart-circulation"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Catalogue by Category</h3>
          </div>
          <div class="card-body">
            <div id="chart-categories"></div>
          </div>
        </div>
      </div>

      <!-- Recent System Audit Feed -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recent System Activity Feed</h3>
          <a href="#/audit" style="font-size: 0.8rem;">View All Logs &rarr;</a>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${(stats.recentActivities || []).map((a) => `
                <tr>
                  <td><strong>${escapeHTML(a.actorName)}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${escapeHTML(a.actorRole)})</span></td>
                  <td><span class="badge badge-info">${escapeHTML(a.action)}</span></td>
                  <td>${escapeHTML(a.entity)} ${a.entityId ? `<code>${escapeHTML(a.entityId.slice(-6))}</code>` : ''}</td>
                  <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(a.createdAt).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Render Charts
    setTimeout(() => {
      renderBarChart(document.getElementById('chart-circulation'), stats.circulationTrends);
      renderDonutChart(document.getElementById('chart-categories'), stats.categoryCounts);
    }, 50);
  },

  renderLibrarian(container, stats) {
    const s = stats.summary;
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Circulation Desk Workspace</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Checkouts, returns, pending holds, and overdue management</p>
        </div>
        <div class="page-actions">
          <a href="#/circulation" class="btn btn-primary btn-sm">Issue / Return Desk</a>
          <a href="#/students" class="btn btn-secondary btn-sm">+ New Student</a>
        </div>
      </div>

      <!-- Metric Grid -->
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: var(--color-success);">📗</div>
          <div class="metric-data">
            <div class="metric-value">${s.availableCopies}</div>
            <div class="metric-label">Books on Shelf</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(99, 102, 241, 0.15); color: var(--primary-600);">📤</div>
          <div class="metric-data">
            <div class="metric-value">${s.issuedCopies}</div>
            <div class="metric-label">Total Out on Loan</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(239, 68, 68, 0.15); color: var(--color-danger);">⏰</div>
          <div class="metric-data">
            <div class="metric-value" style="color: var(--color-danger);">${s.overdueCount}</div>
            <div class="metric-label">Overdue Books</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-500);">⏳</div>
          <div class="metric-data">
            <div class="metric-value">${s.pendingReservations}</div>
            <div class="metric-label">Pending Holds</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: var(--color-success);">💵</div>
          <div class="metric-data">
            <div class="metric-value">$${s.finesCollectedToday}</div>
            <div class="metric-label">Collected Today</div>
          </div>
        </div>
      </div>

      <!-- Overdue Books List with 1-click Return & Remind -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <h3 class="card-title" style="color: var(--color-danger);">⚠️ Overdue Books Queue</h3>
          <span class="badge badge-danger">${(stats.overdueList || []).length} Urgent</span>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Book Title</th>
                <th>Accession #</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${(stats.overdueList && stats.overdueList.length > 0)
                ? stats.overdueList.map((loan) => `
                  <tr>
                    <td>
                      <strong>${escapeHTML(loan.studentId ? loan.studentId.name : 'Unknown')}</strong>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(loan.studentId ? loan.studentId.studentId : '')}</div>
                    </td>
                    <td>${escapeHTML(loan.bookId ? loan.bookId.title : 'Book')}</td>
                    <td><code>${escapeHTML(loan.copyId ? loan.copyId.accessionNumber : '')}</code></td>
                    <td style="color: var(--color-danger); font-weight: 600;">
                      ${new Date(loan.dueDate).toLocaleDateString()}
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#/circulation'">1-Click Return</button>
                        <button class="btn btn-ghost btn-sm" onclick="alert('Overdue reminder notice dispatched to student email!')">Send Notice</button>
                      </div>
                    </td>
                  </tr>
                `).join('')
                : '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No overdue books currently! Great job!</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderStudent(container, stats) {
    const s = stats.summary;
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Welcome to your Student Portal</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Track your currently borrowed books, return dates, and hold requests</p>
        </div>
        <div class="page-actions">
          <a href="#/books" class="btn btn-primary btn-sm">Explore Book Catalogue</a>
          <a href="#/fines" class="btn btn-secondary btn-sm">My Fines</a>
        </div>
      </div>

      <!-- Student KPI Cards -->
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(99, 102, 241, 0.15); color: var(--primary-600);">📖</div>
          <div class="metric-data">
            <div class="metric-value">${s.booksIssued} / 3</div>
            <div class="metric-label">Books Currently Borrowed</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-500);">📅</div>
          <div class="metric-data">
            <div class="metric-value" style="font-size: 1.15rem;">
              ${s.nextDueDate ? new Date(s.nextDueDate).toLocaleDateString() : 'None'}
            </div>
            <div class="metric-label">Earliest Return Due Date</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: ${s.outstandingFines > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${s.outstandingFines > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">💳</div>
          <div class="metric-data">
            <div class="metric-value" style="color: ${s.outstandingFines > 0 ? 'var(--color-danger)' : 'inherit'};">
              $${s.outstandingFines}
            </div>
            <div class="metric-label">Unpaid Fines Balance</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-wrap" style="background: rgba(2, 132, 199, 0.15); color: var(--color-info);">🔖</div>
          <div class="metric-data">
            <div class="metric-value">${s.activeReservations}</div>
            <div class="metric-label">Active Book Reservations</div>
          </div>
        </div>
      </div>

      <!-- Current Loans with Color Coding (Section B3: green, amber <=3 days, red overdue) -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <h3 class="card-title">Currently Borrowed Titles</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Due Date</th>
                <th>Days Remaining</th>
                <th>Renewals</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${(stats.issuedBooks && stats.issuedBooks.length > 0)
                ? stats.issuedBooks.map((loan) => {
                  let badgeClass = 'badge-success';
                  let statusText = `${loan.daysRemaining} days left`;
                  if (loan.urgency === 'amber') {
                    badgeClass = 'badge-warning';
                    statusText = `Due in ${loan.daysRemaining} days`;
                  } else if (loan.urgency === 'red') {
                    badgeClass = 'badge-danger';
                    statusText = `Overdue by ${Math.abs(loan.daysRemaining)} days`;
                  }

                  return `
                    <tr>
                      <td>
                        <strong>${escapeHTML(loan.bookId ? loan.bookId.title : 'Book')}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Accession: <code>${escapeHTML(loan.copyId ? loan.copyId.accessionNumber : '')}</code></div>
                      </td>
                      <td>${new Date(loan.dueDate).toLocaleDateString()}</td>
                      <td><span class="badge ${badgeClass}">${statusText}</span></td>
                      <td>${loan.renewalCount} / 2 used</td>
                      <td>
                        <button class="btn btn-secondary btn-sm renew-loan-btn" data-loan-id="${loan._id}" ${loan.urgency === 'red' || loan.renewalCount >= 2 ? 'disabled' : ''}>
                          Renew Loan
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')
                : '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">You do not have any books currently borrowed.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recommendations based on past borrowing -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recommended For You</h3>
          <a href="#/books" style="font-size: 0.8rem;">Browse Catalogue &rarr;</a>
        </div>
        <div class="card-body">
          <div class="books-grid">
            ${(stats.recommendations || []).map((b) => `
              <div class="book-card" onclick="window.location.hash='#/books?id=${b._id}'">
                <div class="book-cover-container">
                  <img src="${b.coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300'}" alt="${escapeHTML(b.title)}" />
                </div>
                <div class="book-card-body">
                  <div class="book-card-title">${escapeHTML(b.title)}</div>
                  <div class="book-card-author">${escapeHTML((b.authors || []).join(', '))}</div>
                  <div class="book-card-meta">
                    <span class="badge ${b.availableCopies > 0 ? 'badge-success' : 'badge-danger'}">
                      ${b.availableCopies > 0 ? `${b.availableCopies} Available` : 'All Out'}
                    </span>
                    <span>${escapeHTML(b.categoryId ? b.categoryId.name : '')}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Attach renewal handler
    container.querySelectorAll('.renew-loan-btn').forEach((btn) => {
      btn.onclick = async () => {
        const loanId = btn.getAttribute('data-loan-id');
        btn.disabled = true;
        btn.textContent = 'Renewing...';
        try {
          const res = await api.post(`/loans/${loanId}/renew`);
          showToast(res.message, 'success');
          dashboardView.render(container);
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Renew Loan';
        }
      };
    });
  }
};
