// ==========================================================
// CATALOG VIEW (Grid/List, Filters, Detail, Add/Edit Book)
// ==========================================================

import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, escapeHTML } from '../components/toast.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { CoverCropper } from '../components/cropper.js';

export const catalogView = {
  viewMode: 'grid', // 'grid' or 'list'
  currentPage: 1,
  currentSearch: '',
  currentCategory: '',
  currentAvailability: '',
  currentSort: 'newest',

  async render(container) {
    const user = store.getState().user;
    const canManage = user && (user.role === 'admin' || user.role === 'librarian');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Book Catalogue</h1>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Discover, search, borrow, and reserve collection titles</p>
        </div>
        <div class="page-actions">
          ${canManage ? `
            <button class="btn btn-primary btn-sm" id="btn-add-book">+ Add New Book</button>
            <button class="btn btn-secondary btn-sm" id="btn-import-books">CSV Import</button>
            <button class="btn btn-secondary btn-sm" id="btn-export-books">CSV Export</button>
          ` : ''}
          <div style="display: flex; border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
            <button class="btn btn-ghost btn-sm" id="btn-view-grid" style="padding: 0.35rem 0.6rem; ${this.viewMode === 'grid' ? 'background: var(--bg-hover);' : ''}">🗂️ Grid</button>
            <button class="btn btn-ghost btn-sm" id="btn-view-list" style="padding: 0.35rem 0.6rem; ${this.viewMode === 'list' ? 'background: var(--bg-hover);' : ''}">📄 List</button>
          </div>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
          <div style="flex-grow: 1; min-width: 220px;">
            <input type="text" id="catalog-search" class="form-control" placeholder="Search by title, author, or ISBN..." value="${escapeHTML(this.currentSearch)}" />
          </div>

          <div style="width: 180px;">
            <select id="catalog-category-filter" class="form-control">
              <option value="">All Categories</option>
            </select>
          </div>

          <div style="width: 160px;">
            <select id="catalog-avail-filter" class="form-control">
              <option value="">All Availability</option>
              <option value="true" ${this.currentAvailability === 'true' ? 'selected' : ''}>Available Now</option>
            </select>
          </div>

          <div style="width: 150px;">
            <select id="catalog-sort" class="form-control">
              <option value="newest" ${this.currentSort === 'newest' ? 'selected' : ''}>Newest First</option>
              <option value="title" ${this.currentSort === 'title' ? 'selected' : ''}>Title A-Z</option>
              <option value="author" ${this.currentSort === 'author' ? 'selected' : ''}>Author A-Z</option>
              <option value="year" ${this.currentSort === 'year' ? 'selected' : ''}>Publication Year</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Books Listing Container -->
      <div id="books-results-container">
        <div style="padding: 3rem; text-align: center;">
          <div class="skeleton" style="height: 200px; width: 100%;"></div>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div id="catalog-pagination"></div>
    `;

    // Load Categories for dropdown
    try {
      const catRes = await api.get('/categories');
      const catSelect = document.getElementById('catalog-category-filter');
      catRes.data.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat._id;
        opt.textContent = cat.name;
        if (this.currentCategory === cat._id) opt.selected = true;
        catSelect.appendChild(opt);
      });
    } catch (e) {
      console.error(e);
    }

    // Event Bindings
    if (canManage) {
      document.getElementById('btn-add-book').onclick = () => this.showAddEditBookModal();
      document.getElementById('btn-import-books').onclick = () => this.showImportModal();
      document.getElementById('btn-export-books').onclick = () => {
        window.open('/api/v1/books/export', '_blank');
      };
    }

    document.getElementById('btn-view-grid').onclick = () => {
      this.viewMode = 'grid';
      this.loadBooks();
      document.getElementById('btn-view-grid').style.background = 'var(--bg-hover)';
      document.getElementById('btn-view-list').style.background = 'none';
    };

    document.getElementById('btn-view-list').onclick = () => {
      this.viewMode = 'list';
      this.loadBooks();
      document.getElementById('btn-view-list').style.background = 'var(--bg-hover)';
      document.getElementById('btn-view-grid').style.background = 'none';
    };

    // Debounced Search Input (Section C5)
    let debounceTimer;
    document.getElementById('catalog-search').addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.currentSearch = e.target.value.trim();
        this.currentPage = 1;
        this.loadBooks();
      }, 350);
    });

    document.getElementById('catalog-category-filter').onchange = (e) => {
      this.currentCategory = e.target.value;
      this.currentPage = 1;
      this.loadBooks();
    };

    document.getElementById('catalog-avail-filter').onchange = (e) => {
      this.currentAvailability = e.target.value;
      this.currentPage = 1;
      this.loadBooks();
    };

    document.getElementById('catalog-sort').onchange = (e) => {
      this.currentSort = e.target.value;
      this.currentPage = 1;
      this.loadBooks();
    };

    await this.loadBooks();
  },

  async loadBooks() {
    const container = document.getElementById('books-results-container');
    const pagination = document.getElementById('catalog-pagination');
    if (!container) return;

    try {
      const res = await api.get('/books', {
        search: this.currentSearch,
        category: this.currentCategory,
        available: this.currentAvailability,
        sort: this.currentSort,
        page: this.currentPage,
        limit: 12
      });

      const { books, total, page, pages } = res.data;

      if (books.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📖</div>
            <h3 class="empty-state-title">No books found</h3>
            <p class="empty-state-text">Try adjusting your keyword search or category filters.</p>
          </div>
        `;
        pagination.innerHTML = '';
        return;
      }

      if (this.viewMode === 'grid') {
        container.innerHTML = `
          <div class="books-grid">
            ${books.map((b) => `
              <div class="book-card" data-book-id="${b._id}">
                <div class="book-cover-container">
                  <img src="${b.coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300'}" alt="${escapeHTML(b.title)}" loading="lazy" />
                </div>
                <div class="book-card-body">
                  <div class="book-card-title">${escapeHTML(b.title)}</div>
                  <div class="book-card-author">by ${(b.authors || []).join(', ')}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">ISBN: ${escapeHTML(b.isbn)}</div>
                  <div class="book-card-meta">
                    <span class="badge ${b.availableCopies > 0 ? 'badge-success' : 'badge-danger'}">
                      ${b.availableCopies > 0 ? `${b.availableCopies} of ${b.totalCopies} Available` : 'All Copies Out'}
                    </span>
                    <span>${escapeHTML(b.categoryId ? b.categoryId.name : 'General')}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="card">
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Title & Author</th>
                    <th>ISBN</th>
                    <th>Category</th>
                    <th>Shelf</th>
                    <th>Availability</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${books.map((b) => `
                    <tr>
                      <td>
                        <strong>${escapeHTML(b.title)}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML((b.authors || []).join(', '))}</div>
                      </td>
                      <td><code>${escapeHTML(b.isbn)}</code></td>
                      <td>${escapeHTML(b.categoryId ? b.categoryId.name : '')}</td>
                      <td>${escapeHTML(b.shelfLocation || '-')}</td>
                      <td>
                        <span class="badge ${b.availableCopies > 0 ? 'badge-success' : 'badge-danger'}">
                          ${b.availableCopies} / ${b.totalCopies} Available
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="catalogView.showBookDetail('${b._id}')">View</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      // Attach card click
      container.querySelectorAll('.book-card').forEach((card) => {
        card.onclick = () => {
          const id = card.getAttribute('data-book-id');
          this.showBookDetail(id);
        };
      });

      // Render Pagination
      if (pages > 1) {
        pagination.innerHTML = `
          <div class="pagination-bar">
            <div>Showing page ${page} of ${pages} (${total} total books)</div>
            <div class="pagination-controls">
              <button class="btn btn-secondary btn-sm" id="pg-prev" ${page <= 1 ? 'disabled' : ''}>&larr; Previous</button>
              <button class="btn btn-secondary btn-sm" id="pg-next" ${page >= pages ? 'disabled' : ''}>Next &rarr;</button>
            </div>
          </div>
        `;
        document.getElementById('pg-prev').onclick = () => {
          if (this.currentPage > 1) {
            this.currentPage--;
            this.loadBooks();
          }
        };
        document.getElementById('pg-next').onclick = () => {
          if (this.currentPage < pages) {
            this.currentPage++;
            this.loadBooks();
          }
        };
      } else {
        pagination.innerHTML = '';
      }
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color: var(--color-danger);">${escapeHTML(err.message)}</p></div>`;
    }
  },

  async showBookDetail(bookId) {
    try {
      const res = await api.get(`/books/${bookId}`);
      const { book, copies, earliestReturnDate, activeReservationsCount, userReservation } = res.data;
      const user = store.getState().user;
      const isStudent = user && user.role === 'student';
      const canManage = user && (user.role === 'admin' || user.role === 'librarian');

      openModal({
        title: book.title,
        size: 'lg',
        bodyHTML: `
          <div style="display: grid; grid-template-columns: 200px 1fr; gap: 1.5rem;">
            <div>
              <div style="width: 100%; height: 290px; border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-subtle);">
                <img src="${book.coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400'}" alt="${escapeHTML(book.title)}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="margin-top: 1rem; text-align: center;">
                <span class="badge ${book.availableCopies > 0 ? 'badge-success' : 'badge-danger'}" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;">
                  ${book.availableCopies > 0 ? `${book.availableCopies} Copies Available` : 'No Copies Available'}
                </span>
              </div>
            </div>

            <div>
              <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem;">${escapeHTML(book.title)}</div>
              <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">by ${escapeHTML((book.authors || []).join(', '))}</div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem; background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
                <div><strong>ISBN:</strong> ${escapeHTML(book.isbn)}</div>
                <div><strong>Category:</strong> ${escapeHTML(book.categoryId ? book.categoryId.name : '')}</div>
                <div><strong>Publisher:</strong> ${escapeHTML(book.publisher || '-')}</div>
                <div><strong>Year:</strong> ${book.year || '-'} (${escapeHTML(book.edition || '1st')} ed.)</div>
                <div><strong>Shelf Location:</strong> ${escapeHTML(book.shelfLocation || '-')}</div>
                <div><strong>Replacement Price:</strong> $${book.price}</div>
              </div>

              <p style="font-size: 0.875rem; line-height: 1.6; margin-bottom: 1.25rem; color: var(--text-main);">
                ${escapeHTML(book.description || 'No description provided for this collection entry.')}
              </p>

              <!-- Reservation / Return status notice -->
              ${book.availableCopies === 0 ? `
                <div style="background: rgba(245, 158, 11, 0.12); border-left: 4px solid var(--accent-500); padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.825rem;">
                  <strong>Currently Checked Out:</strong> Earliest expected return date is 
                  <strong>${earliestReturnDate ? new Date(earliestReturnDate).toLocaleDateString() : 'shortly'}</strong>.
                  There are currently <strong>${activeReservationsCount}</strong> active reservation hold(s).
                </div>
              ` : ''}

              <!-- Physical Accession Copies Breakdown -->
              <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 0.5rem;">Tracked Physical Copies (${copies.length})</h4>
              <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                <table class="table" style="font-size: 0.8rem;">
                  <thead>
                    <tr>
                      <th>Accession Number</th>
                      <th>Condition</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${copies.map((c) => `
                      <tr>
                        <td><code>${escapeHTML(c.accessionNumber)}</code></td>
                        <td>${escapeHTML(c.condition)}</td>
                        <td>
                          <span class="badge ${c.status === 'available' ? 'badge-success' : c.status === 'issued' ? 'badge-info' : 'badge-warning'}">
                            ${c.status}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `,
        footerHTML: `
          <button class="btn btn-secondary" id="detail-modal-close">Close</button>
          ${isStudent && book.availableCopies === 0 ? `
            <button class="btn btn-primary" id="btn-reserve-book" ${userReservation ? 'disabled' : ''}>
              ${userReservation ? `Reserved (Queue #${userReservation.queuePosition})` : 'Place Reservation Hold'}
            </button>
          ` : ''}
          ${canManage ? `
            <button class="btn btn-secondary" id="btn-edit-book">Edit Book</button>
            <button class="btn btn-outline-danger" id="btn-delete-book">Delete</button>
          ` : ''}
        `
      });

      document.getElementById('detail-modal-close').onclick = closeModal;

      if (isStudent && book.availableCopies === 0) {
        const resBtn = document.getElementById('btn-reserve-book');
        if (resBtn && !userReservation) {
          resBtn.onclick = async () => {
            resBtn.disabled = true;
            resBtn.textContent = 'Placing hold...';
            try {
              const r = await api.post('/reservations', { bookId: book._id });
              showToast(r.message, 'success');
              closeModal();
            } catch (err) {
              showToast(err.message, 'error');
              resBtn.disabled = false;
              resBtn.textContent = 'Place Reservation Hold';
            }
          };
        }
      }

      if (canManage) {
        document.getElementById('btn-edit-book').onclick = () => {
          closeModal();
          this.showAddEditBookModal(book);
        };

        document.getElementById('btn-delete-book').onclick = () => {
          confirmDialog({
            title: 'Delete Book',
            message: `Are you sure you want to delete "${book.title}"? Records with transaction history will be soft-deleted.`,
            confirmText: 'Delete',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
              try {
                const delRes = await api.delete(`/books/${book._id}`);
                showToast(delRes.message, 'success');
                closeModal();
                catalogView.loadBooks();
              } catch (e) {
                showToast(e.message, 'error');
              }
            }
          });
        };
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async showAddEditBookModal(book = null) {
    const isEdit = !!book;
    let categories = [];
    try {
      const catRes = await api.get('/categories');
      categories = catRes.data;
    } catch (e) {
      console.error(e);
    }

    openModal({
      title: isEdit ? `Edit "${book.title}"` : 'Add New Book to Collection',
      size: 'lg',
      bodyHTML: `
        <form id="book-form">
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
            <div>
              <div class="form-group">
                <label class="form-label required" for="book-title">Title</label>
                <input type="text" id="book-title" class="form-control" value="${escapeHTML(book ? book.title : '')}" required />
              </div>

              <div class="form-group">
                <label class="form-label required" for="book-authors">Author(s) (comma separated)</label>
                <input type="text" id="book-authors" class="form-control" value="${escapeHTML(book ? book.authors.join(', ') : '')}" required placeholder="Robert C. Martin" />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                  <label class="form-label required" for="book-isbn">ISBN (10 or 13 digits)</label>
                  <input type="text" id="book-isbn" class="form-control" value="${escapeHTML(book ? book.isbn : '')}" required />
                </div>
                <div class="form-group">
                  <label class="form-label required" for="book-cat">Category</label>
                  <select id="book-cat" class="form-control" required>
                    ${categories.map((c) => `<option value="${c._id}" ${book && book.categoryId && book.categoryId._id === c._id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                  <label class="form-label" for="book-publisher">Publisher</label>
                  <input type="text" id="book-publisher" class="form-control" value="${escapeHTML(book ? book.publisher : '')}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="book-year">Year</label>
                  <input type="number" id="book-year" class="form-control" value="${book ? book.year || '' : ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="book-edition">Edition</label>
                  <input type="text" id="book-edition" class="form-control" value="${escapeHTML(book ? book.edition : '')}" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                  <label class="form-label" for="book-shelf">Shelf Location</label>
                  <input type="text" id="book-shelf" class="form-control" value="${escapeHTML(book ? book.shelfLocation : 'Shelf CS-101')}" />
                </div>
                <div class="form-group">
                  <label class="form-label required" for="book-copies">Total Copies</label>
                  <input type="number" id="book-copies" class="form-control" value="${book ? book.totalCopies : 2}" min="1" required />
                </div>
                <div class="form-group">
                  <label class="form-label required" for="book-price">Price ($)</label>
                  <input type="number" id="book-price" class="form-control" value="${book ? book.price : 35}" min="1" step="0.5" required />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="book-desc">Description</label>
                <textarea id="book-desc" class="form-control" rows="3">${escapeHTML(book ? book.description : '')}</textarea>
              </div>
            </div>

            <!-- Cover Image & Canvas Cropper Preview (Section C4) -->
            <div>
              <div class="form-label">Cover Image (2:3 Crop)</div>
              <div class="crop-preview-box">
                <canvas id="cover-canvas"></canvas>
              </div>
              <input type="file" id="cover-file-input" accept="image/jpeg,image/png,image/webp" style="margin-top: 0.75rem; font-size: 0.8rem; width: 100%;" />
              <p style="font-size: 0.7rem; color: var(--text-subtle); margin-top: 0.25rem;">
                JPG, PNG, or WebP up to 2MB. Automatically cropped to fixed 2:3 ratio via Canvas API.
              </p>
            </div>
          </div>
        </form>
      `,
      footerHTML: `
        <button class="btn btn-secondary" id="book-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="book-modal-submit">${isEdit ? 'Save Changes' : 'Create Book'}</button>
      `
    });

    document.getElementById('book-modal-cancel').onclick = closeModal;

    const canvas = document.getElementById('cover-canvas');
    const cropper = new CoverCropper(canvas);

    // If edit and book has coverUrl, draw it
    if (book && book.coverUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => cropper.cropAndRender(img);
      img.src = book.coverUrl;
    }

    document.getElementById('cover-file-input').onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          await cropper.loadImage(file);
          showToast('Image loaded and cropped to 2:3 ratio', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    };

    document.getElementById('book-modal-submit').onclick = async () => {
      const title = document.getElementById('book-title').value.trim();
      const authors = document.getElementById('book-authors').value.trim();
      const isbn = document.getElementById('book-isbn').value.trim();
      const categoryId = document.getElementById('book-cat').value;
      const publisher = document.getElementById('book-publisher').value.trim();
      const year = document.getElementById('book-year').value;
      const edition = document.getElementById('book-edition').value.trim();
      const shelfLocation = document.getElementById('book-shelf').value.trim();
      const totalCopies = document.getElementById('book-copies').value;
      const price = document.getElementById('book-price').value;
      const description = document.getElementById('book-desc').value.trim();

      if (!title || !authors || !isbn || !categoryId) {
        showToast('Please fill out all required fields.', 'warning');
        return;
      }

      const submitBtn = document.getElementById('book-modal-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      try {
        let uploadedCoverUrl = book ? book.coverUrl : '';
        const croppedBlob = await cropper.getBlob();

        if (croppedBlob && document.getElementById('cover-file-input').files[0]) {
          const formData = new FormData();
          formData.append('cover', croppedBlob, 'cover.jpg');
          const upRes = await api.post('/books/temp/cover', formData);
          if (upRes.data && upRes.data.coverUrl) {
            uploadedCoverUrl = upRes.data.coverUrl;
          }
        }

        const payload = {
          title,
          authors: authors.split(',').map((a) => a.trim()),
          isbn,
          categoryId,
          publisher,
          year,
          edition,
          shelfLocation,
          totalCopies: parseInt(totalCopies),
          price: parseFloat(price),
          description,
          coverUrl: uploadedCoverUrl
        };

        if (isEdit) {
          const res = await api.put(`/books/${book._id}`, payload);
          showToast(res.message, 'success');
        } else {
          const res = await api.post('/books', payload);
          showToast(res.message, 'success');
        }

        closeModal();
        catalogView.loadBooks();
      } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Book';
      }
    };
  },

  showImportModal() {
    openModal({
      title: 'Bulk Import Books (CSV)',
      size: 'md',
      bodyHTML: `
        <div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
            Upload or paste CSV rows in format: <code>Title,Author,ISBN,Copies,Price</code>
          </p>
          <textarea id="import-csv-text" class="form-control" rows="6" placeholder="Clean Architecture,Robert C. Martin,9780134494166,3,40&#10;Refactoring,Martin Fowler,9780201485677,2,45"></textarea>
          <div id="import-preview-area" style="margin-top: 1rem;"></div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" id="import-cancel">Cancel</button>
        <button class="btn btn-secondary" id="import-validate">Dry Run (Preview)</button>
        <button class="btn btn-primary" id="import-exec">Import Now</button>
      `
    });

    document.getElementById('import-cancel').onclick = closeModal;

    const parseRows = () => {
      const text = document.getElementById('import-csv-text').value.trim();
      if (!text) return [];
      const lines = text.split('\n');
      return lines.map((l) => {
        const parts = l.split(',');
        return {
          title: parts[0] ? parts[0].trim() : '',
          author: parts[1] ? parts[1].trim() : '',
          isbn: parts[2] ? parts[2].trim() : '',
          copies: parts[3] ? parseInt(parts[3]) : 1,
          price: parts[4] ? parseFloat(parts[4]) : 25
        };
      }).filter((r) => r.title);
    };

    document.getElementById('import-validate').onclick = async () => {
      const books = parseRows();
      if (books.length === 0) return showToast('Please enter CSV data', 'warning');
      try {
        const res = await api.post('/books/import', { books, dryRun: true });
        const p = document.getElementById('import-preview-area');
        p.innerHTML = `
          <div style="background: var(--bg-subtle); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem;">
            ✅ Valid records: <strong>${res.data.validCount}</strong> | ❌ Errors: <strong>${res.data.errorCount}</strong>
          </div>
        `;
        showToast('Validation preview ready', 'info');
      } catch (e) {
        showToast(e.message, 'error');
      }
    };

    document.getElementById('import-exec').onclick = async () => {
      const books = parseRows();
      if (books.length === 0) return showToast('Please enter CSV data', 'warning');
      try {
        const res = await api.post('/books/import', { books, dryRun: false });
        showToast(res.message, 'success');
        closeModal();
        catalogView.loadBooks();
      } catch (e) {
        showToast(e.message, 'error');
      }
    };
  }
};
