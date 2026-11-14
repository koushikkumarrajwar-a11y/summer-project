const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const { logAudit } = require('../utils/auditLogger');

// Helper to generate accession number
const generateAccessionNumber = async () => {
  const count = await BookCopy.countDocuments();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `ACC-${(count + 1).toString().padStart(4, '0')}-${randomSuffix}`;
};

// @desc Get books (search, filter, sort, pagination)
// @route GET /api/v1/books
exports.getBooks = async (req, res, next) => {
  try {
    const {
      search,
      category,
      language,
      available,
      year,
      sort = 'newest',
      page = 1,
      limit = 12
    } = req.query;

    const query = { isDeleted: false };

    if (category) query.categoryId = category;
    if (language) query.language = language;
    if (year) query.year = parseInt(year);
    if (available === 'true') {
      query.availableCopies = { $gt: 0 };
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { title: regex },
        { authors: regex },
        { isbn: regex },
        { publisher: regex }
      ];
    }

    // Sort mapping
    let sortQuery = { createdAt: -1 };
    if (sort === 'title') sortQuery = { title: 1 };
    else if (sort === 'author') sortQuery = { authors: 1 };
    else if (sort === 'oldest') sortQuery = { createdAt: 1 };
    else if (sort === 'year') sortQuery = { year: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Book.countDocuments(query);
    const books = await Book.find(query)
      .populate('categoryId', 'name')
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        books,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      message: 'Books fetched successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single book with copies & earliest due date
// @route GET /api/v1/books/:id
exports.getBookById = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id).populate('categoryId', 'name');
    if (!book || book.isDeleted) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Book not found'
      });
    }

    const copies = await BookCopy.find({ bookId: book._id }).sort({ accessionNumber: 1 });

    // Earliest return date if no copies are available
    let earliestReturnDate = null;
    if (book.availableCopies === 0) {
      const earliestLoan = await Loan.findOne({ bookId: book._id, status: { $in: ['active', 'overdue'] } })
        .sort({ dueDate: 1 });
      if (earliestLoan) {
        earliestReturnDate = earliestLoan.dueDate;
      }
    }

    // Active reservations count & queue position if student
    const activeReservationsCount = await Reservation.countDocuments({
      bookId: book._id,
      status: { $in: ['pending', 'ready_for_pickup'] }
    });

    let userReservation = null;
    if (req.user && req.user.role === 'student') {
      userReservation = await Reservation.findOne({
        bookId: book._id,
        studentId: req.user._id,
        status: { $in: ['pending', 'ready_for_pickup'] }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        book,
        copies,
        earliestReturnDate,
        activeReservationsCount,
        userReservation
      },
      message: 'Book details retrieved'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Add new book
// @route POST /api/v1/books
exports.createBook = async (req, res, next) => {
  try {
    const {
      title,
      authors,
      isbn,
      publisher,
      year,
      edition,
      language,
      categoryId,
      shelfLocation,
      pages,
      description,
      totalCopies = 1,
      price = 20,
      coverUrl,
      addCopiesToExisting = false
    } = req.body;

    if (!title || !authors || !isbn || !categoryId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Title, Author(s), ISBN, and Category are required.'
      });
    }

    const cleanIsbn = isbn.replace(/[-\s]/g, '').trim();

    // Check for duplicate ISBN (Section C1)
    const existing = await Book.findOne({ isbn: cleanIsbn, isDeleted: false });
    if (existing) {
      if (!addCopiesToExisting) {
        return res.status(409).json({
          success: false,
          data: { existingBookId: existing._id, title: existing.title },
          message: `A book with ISBN ${cleanIsbn} already exists ("${existing.title}"). Do you want to add copies to the existing record instead?`
        });
      }

      // Add copies to existing book
      const count = parseInt(totalCopies) || 1;
      const createdCopies = [];
      for (let i = 0; i < count; i++) {
        const accNum = await generateAccessionNumber();
        const copy = await BookCopy.create({
          bookId: existing._id,
          accessionNumber: accNum,
          status: 'available',
          condition: 'good'
        });
        createdCopies.push(copy);
      }

      existing.totalCopies += count;
      existing.availableCopies += count;
      await existing.save();

      await logAudit(req, 'ADD_COPIES_TO_EXISTING_BOOK', 'Book', existing._id, { copiesAdded: count });

      return res.status(200).json({
        success: true,
        data: { book: existing, addedCopies: createdCopies },
        message: `Successfully added ${count} new copy/copies to "${existing.title}".`
      });
    }

    const authorsArray = Array.isArray(authors)
      ? authors
      : authors.split(',').map((a) => a.trim()).filter(Boolean);

    const copiesCount = Math.max(1, parseInt(totalCopies) || 1);

    const book = await Book.create({
      title: title.trim(),
      authors: authorsArray,
      isbn: cleanIsbn,
      publisher: publisher ? publisher.trim() : '',
      year: year ? parseInt(year) : undefined,
      edition: edition ? edition.trim() : '',
      language: language || 'English',
      categoryId,
      shelfLocation: shelfLocation ? shelfLocation.trim() : 'General',
      pages: pages ? parseInt(pages) : 0,
      description: description || '',
      price: price ? parseFloat(price) : 20,
      coverUrl: coverUrl || '',
      totalCopies: copiesCount,
      availableCopies: copiesCount,
      createdBy: req.user._id
    });

    // Create physical copies with unique accession numbers
    const copies = [];
    for (let i = 0; i < copiesCount; i++) {
      const accNum = await generateAccessionNumber();
      const copy = await BookCopy.create({
        bookId: book._id,
        accessionNumber: accNum,
        status: 'available',
        condition: 'good'
      });
      copies.push(copy);
    }

    await logAudit(req, 'CREATE_BOOK', 'Book', book._id, { title: book.title, isbn: book.isbn, copies: copiesCount });

    return res.status(201).json({
      success: true,
      data: { book, copies },
      message: 'Book created successfully with physical accession copies.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Edit book
// @route PUT /api/v1/books/:id
exports.updateBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book || book.isDeleted) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Book not found'
      });
    }

    const {
      title,
      authors,
      isbn,
      publisher,
      year,
      edition,
      language,
      categoryId,
      shelfLocation,
      pages,
      description,
      price,
      coverUrl,
      totalCopies
    } = req.body;

    // Check total copies reduction constraint (Section C2)
    if (totalCopies !== undefined) {
      const issuedCopiesCount = await BookCopy.countDocuments({
        bookId: book._id,
        status: { $in: ['issued', 'on_hold'] }
      });
      if (parseInt(totalCopies) < issuedCopiesCount) {
        return res.status(400).json({
          success: false,
          data: null,
          message: `Total copies cannot be reduced below ${issuedCopiesCount} (the number of copies currently issued or on hold).`
        });
      }

      // If increasing total copies, create extra copies
      const diff = parseInt(totalCopies) - book.totalCopies;
      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          const accNum = await generateAccessionNumber();
          await BookCopy.create({
            bookId: book._id,
            accessionNumber: accNum,
            status: 'available',
            condition: 'good'
          });
        }
        book.availableCopies += diff;
      }
      book.totalCopies = parseInt(totalCopies);
    }

    if (title) book.title = title.trim();
    if (authors) {
      book.authors = Array.isArray(authors)
        ? authors
        : authors.split(',').map((a) => a.trim()).filter(Boolean);
    }
    if (isbn) book.isbn = isbn.replace(/[-\s]/g, '').trim();
    if (publisher !== undefined) book.publisher = publisher;
    if (year !== undefined) book.year = parseInt(year);
    if (edition !== undefined) book.edition = edition;
    if (language !== undefined) book.language = language;
    if (categoryId) book.categoryId = categoryId;
    if (shelfLocation !== undefined) book.shelfLocation = shelfLocation;
    if (pages !== undefined) book.pages = parseInt(pages);
    if (description !== undefined) book.description = description;
    if (price !== undefined) book.price = parseFloat(price);
    if (coverUrl !== undefined) book.coverUrl = coverUrl;

    await book.save();
    await logAudit(req, 'UPDATE_BOOK', 'Book', book._id, { title: book.title });

    return res.status(200).json({
      success: true,
      data: book,
      message: 'Book updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete book (Soft delete; permanent delete Admin only; blocked if active loans/reservations)
// @route DELETE /api/v1/books/:id
exports.deleteBook = async (req, res, next) => {
  try {
    const { permanent = false } = req.query;
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Book not found'
      });
    }

    // Blocked if any copy is currently issued or reserved (Section C3)
    const activeLoans = await Loan.countDocuments({
      bookId: book._id,
      status: { $in: ['active', 'overdue'] }
    });
    if (activeLoans > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Cannot delete book: ${activeLoans} copy/copies are currently on loan.`
      });
    }

    const activeReservations = await Reservation.countDocuments({
      bookId: book._id,
      status: { $in: ['pending', 'ready_for_pickup'] }
    });
    if (activeReservations > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Cannot delete book: ${activeReservations} active reservation(s) exist.`
      });
    }

    if (permanent === 'true') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          data: null,
          message: 'Permanent deletion is restricted to Administrators only.'
        });
      }
      await BookCopy.deleteMany({ bookId: book._id });
      await Book.findByIdAndDelete(book._id);
      await logAudit(req, 'PERMANENT_DELETE_BOOK', 'Book', book._id, { title: book.title });

      return res.status(200).json({
        success: true,
        data: null,
        message: 'Book and its copies permanently deleted.'
      });
    }

    // Soft delete
    book.isDeleted = true;
    await book.save();
    await logAudit(req, 'SOFT_DELETE_BOOK', 'Book', book._id, { title: book.title });

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Book soft-deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Upload Book Cover Image
// @route POST /api/v1/books/:id/cover
exports.uploadCover = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Please upload an image file (JPG, PNG, WebP up to 2MB).'
      });
    }

    const coverUrl = `/uploads/${req.file.filename}`;

    if (req.params.id && req.params.id !== 'temp') {
      const book = await Book.findById(req.params.id);
      if (book) {
        book.coverUrl = coverUrl;
        await book.save();
      }
    }

    return res.status(200).json({
      success: true,
      data: { coverUrl },
      message: 'Cover image uploaded successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Bulk import books from CSV data (Section C8)
// @route POST /api/v1/books/import
exports.importBooks = async (req, res, next) => {
  try {
    const { books = [], dryRun = false } = req.body;

    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Please provide a non-empty array of book records.'
      });
    }

    const validBooks = [];
    const errors = [];

    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      if (!b.title || !b.isbn) {
        errors.push({ row: i + 1, error: 'Missing title or ISBN' });
        continue;
      }
      validBooks.push(b);
    }

    if (dryRun) {
      return res.status(200).json({
        success: true,
        data: {
          totalRows: books.length,
          validCount: validBooks.length,
          errorCount: errors.length,
          errors
        },
        message: 'Validation preview complete.'
      });
    }

    // Execute import
    let importedCount = 0;
    for (const b of validBooks) {
      const cleanIsbn = b.isbn.replace(/[-\s]/g, '').trim();
      let book = await Book.findOne({ isbn: cleanIsbn });
      if (!book) {
        book = await Book.create({
          title: b.title.trim(),
          authors: Array.isArray(b.authors) ? b.authors : [b.author || 'Unknown'],
          isbn: cleanIsbn,
          publisher: b.publisher || '',
          year: b.year ? parseInt(b.year) : undefined,
          categoryId: b.categoryId || (await Category.findOne())._id,
          totalCopies: parseInt(b.copies) || 1,
          availableCopies: parseInt(b.copies) || 1,
          price: b.price ? parseFloat(b.price) : 20,
          createdBy: req.user._id
        });

        for (let j = 0; j < (parseInt(b.copies) || 1); j++) {
          const accNum = await generateAccessionNumber();
          await BookCopy.create({
            bookId: book._id,
            accessionNumber: accNum,
            status: 'available'
          });
        }
        importedCount++;
      }
    }

    await logAudit(req, 'BULK_IMPORT_BOOKS', 'Book', '', { importedCount });

    return res.status(200).json({
      success: true,
      data: { importedCount, errors },
      message: `Successfully imported ${importedCount} book(s).`
    });
  } catch (error) {
    next(error);
  }
};

// @desc Export books catalogue to CSV
// @route GET /api/v1/books/export
exports.exportBooks = async (req, res, next) => {
  try {
    const books = await Book.find({ isDeleted: false }).populate('categoryId', 'name');

    const headers = ['Title', 'Authors', 'ISBN', 'Category', 'Publisher', 'Year', 'Shelf', 'Total Copies', 'Available Copies', 'Price'];
    const rows = books.map((b) => [
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.authors.join('; ').replace(/"/g, '""')}"`,
      `"${b.isbn}"`,
      `"${b.categoryId ? b.categoryId.name : ''}"`,
      `"${(b.publisher || '').replace(/"/g, '""')}"`,
      b.year || '',
      `"${b.shelfLocation || ''}"`,
      b.totalCopies,
      b.availableCopies,
      b.price
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="books_catalogue.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
