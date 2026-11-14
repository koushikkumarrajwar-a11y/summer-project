require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Category = require('../models/Category');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const Setting = require('../models/Setting');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const seedDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }

    console.log('[Seed] Clearing existing LMS data...');
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Book.deleteMany({}),
      BookCopy.deleteMany({}),
      Loan.deleteMany({}),
      Reservation.deleteMany({}),
      Fine.deleteMany({}),
      Setting.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    console.log('[Seed] Creating default system settings...');
    const settings = await Setting.create({
      libraryName: 'Athenaeum Central University Library',
      libraryLogo: '',
      contactEmail: 'library@university.edu',
      contactPhone: '+1 (555) 789-0123',
      address: '742 Library Boulevard, Campus Quad',
      currency: '$',
      loanPeriodDays: 14,
      maxBooksPerStudent: 3,
      renewalLimit: 2,
      reservationPickupDays: 3,
      finePerDay: 5,
      maxFineCap: 50,
      fineBlockThreshold: 20,
      waiverApprovalThreshold: 15,
      registrationMode: 'approval',
      sessionTimeoutMinutes: 30
    });

    console.log('[Seed] Creating user accounts with bcrypt cost factor 12...');
    const salt = await bcrypt.genSalt(12);

    const admin = await User.create({
      role: 'admin',
      name: 'Dr. Eleanor Vance',
      email: 'admin@library.com',
      passwordHash: await bcrypt.hash('Admin@12345', salt),
      phone: '+1 555-0100',
      department: 'Library Administration',
      status: 'active'
    });

    const librarian = await User.create({
      role: 'librarian',
      name: 'Marcus Holloway',
      email: 'librarian@library.com',
      passwordHash: await bcrypt.hash('Librarian@12345', salt),
      phone: '+1 555-0101',
      department: 'Circulation Desk',
      status: 'active'
    });

    const student1 = await User.create({
      role: 'student',
      name: 'Alex Mercer',
      email: 'student@library.com',
      studentId: 'STU-2026-001',
      passwordHash: await bcrypt.hash('Student@12345', salt),
      phone: '+1 555-0102',
      department: 'Computer Science',
      year: '3rd Year',
      status: 'active'
    });

    const student2 = await User.create({
      role: 'student',
      name: 'Maya Lin',
      email: 'maya@library.com',
      studentId: 'STU-2026-002',
      passwordHash: await bcrypt.hash('Student@12345', salt),
      phone: '+1 555-0103',
      department: 'Physics',
      year: '2nd Year',
      status: 'active'
    });

    const student3 = await User.create({
      role: 'student',
      name: 'David Kim',
      email: 'david@library.com',
      studentId: 'STU-2026-003',
      passwordHash: await bcrypt.hash('Student@12345', salt),
      phone: '+1 555-0104',
      department: 'Literature',
      year: '1st Year',
      status: 'pending' // pending approval
    });

    console.log('[Seed] Creating categories...');
    const catCS = await Category.create({
      name: 'Computer Science & AI',
      description: 'Software engineering, algorithms, architectures, and machine learning.'
    });

    const catLit = await Category.create({
      name: 'Literature & Classics',
      description: 'Timeless literary works, novels, and historical fiction.'
    });

    const catSci = await Category.create({
      name: 'Science & Mathematics',
      description: 'Physics, cosmology, calculus, and natural sciences.'
    });

    const catHist = await Category.create({
      name: 'History & Philosophy',
      description: 'World history, civilizations, and philosophical treatises.'
    });

    console.log('[Seed] Creating books and physical copy accessions...');
    const booksData = [
      {
        title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        authors: ['Robert C. Martin'],
        isbn: '9780132350884',
        publisher: 'Prentice Hall',
        year: 2008,
        edition: '1st',
        language: 'English',
        categoryId: catCS._id,
        shelfLocation: 'Shelf CS-101',
        pages: 464,
        description: 'Even bad code can function. But if code isn’t clean, it can bring a development organization to its knees.',
        price: 45,
        totalCopies: 4,
        coverUrl: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400&q=80'
      },
      {
        title: 'Introduction to Algorithms',
        authors: ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'],
        isbn: '9780262033848',
        publisher: 'MIT Press',
        year: 2009,
        edition: '3rd',
        language: 'English',
        categoryId: catCS._id,
        shelfLocation: 'Shelf CS-102',
        pages: 1292,
        description: 'A comprehensive textbook covering a broad range of algorithms in depth, yet making their design and analysis accessible.',
        price: 90,
        totalCopies: 2,
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80'
      },
      {
        title: 'Designing Data-Intensive Applications',
        authors: ['Martin Kleppmann'],
        isbn: '9781449373320',
        publisher: "O'Reilly Media",
        year: 2017,
        edition: '1st',
        language: 'English',
        categoryId: catCS._id,
        shelfLocation: 'Shelf CS-103',
        pages: 616,
        description: 'The definitive guide to the architecture of data systems, scalability, consistency, and reliability.',
        price: 50,
        totalCopies: 3,
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80'
      },
      {
        title: 'The Pragmatic Programmer: Your Journey To Mastery',
        authors: ['David Thomas', 'Andrew Hunt'],
        isbn: '9780135957059',
        publisher: 'Addison-Wesley',
        year: 2019,
        edition: '20th Anniversary',
        language: 'English',
        categoryId: catCS._id,
        shelfLocation: 'Shelf CS-104',
        pages: 352,
        description: 'Illustrates the best practices and major pitfalls of modern software development for career programmers.',
        price: 48,
        totalCopies: 3,
        coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80'
      },
      {
        title: 'To Kill a Mockingbird',
        authors: ['Harper Lee'],
        isbn: '9780060935467',
        publisher: 'Harper Perennial Modern Classics',
        year: 2002,
        edition: 'Classic',
        language: 'English',
        categoryId: catLit._id,
        shelfLocation: 'Shelf LIT-201',
        pages: 336,
        description: 'The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it.',
        price: 18,
        totalCopies: 3,
        coverUrl: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&q=80'
      },
      {
        title: '1984',
        authors: ['George Orwell'],
        isbn: '9780451524935',
        publisher: 'Signet Classic',
        year: 1950,
        edition: 'Reissue',
        language: 'English',
        categoryId: catLit._id,
        shelfLocation: 'Shelf LIT-202',
        pages: 328,
        description: 'The terrifying dystopian masterpiece about the omnipresence of totalitarian surveillance and truth manipulation.',
        price: 16,
        totalCopies: 3,
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80'
      },
      {
        title: 'A Brief History of Time',
        authors: ['Stephen Hawking'],
        isbn: '9780553380163',
        publisher: 'Bantam Books',
        year: 1998,
        edition: 'Updated',
        language: 'English',
        categoryId: catSci._id,
        shelfLocation: 'Shelf SCI-301',
        pages: 256,
        description: 'A landmark volume in science writing by one of the greatest minds of modern history exploring black holes and time.',
        price: 22,
        totalCopies: 2,
        coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80'
      }
    ];

    const createdBooks = [];
    const createdCopies = [];

    for (const bData of booksData) {
      const book = await Book.create({
        ...bData,
        availableCopies: bData.totalCopies,
        createdBy: admin._id
      });
      createdBooks.push(book);

      for (let i = 1; i <= bData.totalCopies; i++) {
        const accession = `ACC-${book.isbn.slice(-4)}-${i.toString().padStart(2, '0')}`;
        const copy = await BookCopy.create({
          bookId: book._id,
          accessionNumber: accession,
          status: 'available',
          condition: 'good'
        });
        createdCopies.push(copy);
      }
    }

    console.log('[Seed] Setting up sample circulation loans and reservations...');
    // 1. Alex Mercer has Clean Code issued (Due in 10 days) -> Green
    const cleanCode = createdBooks[0];
    const cleanCodeCopy = createdCopies.find((c) => c.bookId.toString() === cleanCode._id.toString());
    cleanCodeCopy.status = 'issued';
    await cleanCodeCopy.save();
    cleanCode.availableCopies -= 1;
    await cleanCode.save();

    const dueIn10Days = new Date();
    dueIn10Days.setDate(dueIn10Days.getDate() + 10);
    await Loan.create({
      bookId: cleanCode._id,
      copyId: cleanCodeCopy._id,
      studentId: student1._id,
      issuedBy: librarian._id,
      issueDate: new Date(),
      dueDate: dueIn10Days,
      status: 'active'
    });

    // 2. Alex Mercer has DDIA issued (Due in 2 days) -> Amber
    const ddia = createdBooks[2];
    const ddiaCopy = createdCopies.find((c) => c.bookId.toString() === ddia._id.toString());
    ddiaCopy.status = 'issued';
    await ddiaCopy.save();
    ddia.availableCopies -= 1;
    await ddia.save();

    const dueIn2Days = new Date();
    dueIn2Days.setDate(dueIn2Days.getDate() + 2);
    await Loan.create({
      bookId: ddia._id,
      copyId: ddiaCopy._id,
      studentId: student1._id,
      issuedBy: librarian._id,
      issueDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      dueDate: dueIn2Days,
      status: 'active'
    });

    // 3. Maya Lin has an overdue loan (Pragmatic Programmer, due 4 days ago) -> Red
    const pragmatic = createdBooks[3];
    const pragmaticCopy = createdCopies.find((c) => c.bookId.toString() === pragmatic._id.toString());
    pragmaticCopy.status = 'issued';
    await pragmaticCopy.save();
    pragmatic.availableCopies -= 1;
    await pragmatic.save();

    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 4);
    const overdueLoan = await Loan.create({
      bookId: pragmatic._id,
      copyId: pragmaticCopy._id,
      studentId: student2._id,
      issuedBy: librarian._id,
      issueDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      dueDate: overdueDate,
      status: 'overdue'
    });

    // Overdue fine for Maya Lin: 4 days * $5 = $20
    const fineMaya = await Fine.create({
      loanId: overdueLoan._id,
      studentId: student2._id,
      reason: 'overdue',
      description: '4 days overdue for "The Pragmatic Programmer"',
      amount: 20,
      amountPaid: 0,
      status: 'unpaid'
    });

    // 4. Sample active reservation: Check out both copies of CLRS, then reserve for Alex Mercer
    const clrs = createdBooks[1];
    const clrsCopies = createdCopies.filter((c) => c.bookId.toString() === clrs._id.toString());
    for (const c of clrsCopies) {
      c.status = 'issued';
      await c.save();
    }
    clrs.availableCopies = 0;
    await clrs.save();

    const resCLRS = await Reservation.create({
      bookId: clrs._id,
      studentId: student1._id,
      status: 'pending',
      queuePosition: 1
    });

    console.log('[Seed] Generating sample notifications & audit logs...');
    await Notification.create([
      {
        userId: student1._id,
        type: 'reminder',
        message: 'Friendly reminder: "Designing Data-Intensive Applications" is due in 2 days.'
      },
      {
        userId: student2._id,
        type: 'overdue',
        message: 'OVERDUE ALERT: "The Pragmatic Programmer" is 4 days overdue. A fine of $20 has accrued.'
      },
      {
        userId: student1._id,
        type: 'reservation_ready',
        message: 'Your reservation for "Introduction to Algorithms" is currently #1 in the queue.'
      }
    ]);

    await AuditLog.create([
      {
        actorId: admin._id,
        actorName: admin.name,
        actorRole: admin.role,
        action: 'SYSTEM_INITIALIZATION',
        entity: 'System',
        details: { version: '1.0', initialBooks: booksData.length }
      },
      {
        actorId: librarian._id,
        actorName: librarian.name,
        actorRole: librarian.role,
        action: 'ISSUE_BOOK',
        entity: 'Loan',
        details: { book: cleanCode.title, student: student1.name }
      }
    ]);

    console.log('----------------------------------------------------');
    console.log('✅ LMS Database Seeded Successfully!');
    console.log('Default Credentials:');
    console.log('  Admin:     admin@library.com     / Admin@12345');
    console.log('  Librarian: librarian@library.com / Librarian@12345');
    console.log('  Student:   student@library.com   / Student@12345  (or ID: STU-2026-001)');
    console.log('  Student 2: maya@library.com      / Student@12345  (or ID: STU-2026-002)');
    console.log('  Pending:   david@library.com     / Student@12345  (or ID: STU-2026-003)');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('[Seed Error] Failed to seed database:', err);
    throw err;
  }
};

if (require.main === module) {
  seedDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
