const Category = require('../models/Category');
const Book = require('../models/Book');
const { logAudit } = require('../utils/auditLogger');

// @desc Get all categories
// @route GET /api/v1/categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().populate('parentId', 'name').sort({ name: 1 });
    return res.status(200).json({
      success: true,
      data: categories,
      message: 'Categories retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create category
// @route POST /api/v1/categories
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Category name is required'
      });
    }

    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        data: null,
        message: 'A category with this name already exists'
      });
    }

    const category = await Category.create({
      name: name.trim(),
      description,
      parentId: parentId || null
    });

    await logAudit(req, 'CREATE_CATEGORY', 'Category', category._id, { name: category.name });

    return res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update category
// @route PUT /api/v1/categories/:id
exports.updateCategory = async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Category not found'
      });
    }

    if (name) category.name = name.trim();
    if (description !== undefined) category.description = description;
    if (parentId !== undefined) category.parentId = parentId || null;

    await category.save();
    await logAudit(req, 'UPDATE_CATEGORY', 'Category', category._id, { name: category.name });

    return res.status(200).json({
      success: true,
      data: category,
      message: 'Category updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Delete category
// @route DELETE /api/v1/categories/:id
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Category not found'
      });
    }

    // Check if any books are assigned to this category (Section C6)
    const booksCount = await Book.countDocuments({ categoryId: category._id, isDeleted: false });
    if (booksCount > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Cannot delete category: ${booksCount} book(s) are currently assigned to this category. Please reassign them first.`
      });
    }

    await Category.findByIdAndDelete(category._id);
    await logAudit(req, 'DELETE_CATEGORY', 'Category', category._id, { name: category.name });

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
