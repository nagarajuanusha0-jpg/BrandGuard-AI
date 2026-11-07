
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const validRoles = ["Admin", "Manager", "Creator", "Reviewer"];
const validStatuses = ["Active", "Inactive"];

const safeUser = (user) => {
  const data = user.toObject ? user.toObject() : user;
  const { passwordHash, ...safeData } = data;
  return safeData;
};

// Create a user
const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password and role are required."
      });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role."
      });
    }

    if (typeof password !== "string" || password.length < 12) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 12 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      status: "Active"
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: safeUser(user)
    });
  } catch (error) {
    console.error("Create user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create user."
    });
  }
};

// Get all users with search, filters and pagination
const getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    const filter = {};

    if (req.query.role) {
      if (!validRoles.includes(req.query.role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role filter."
        });
      }
      filter.role = req.query.role;
    }

    if (req.query.status) {
      if (!validStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter."
        });
      }
      filter.status = req.query.status;
    }

    if (req.query.search) {
      const search = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: users.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: users
    });
  } catch (error) {
    console.error("Get users error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users."
    });
  }
};

// Get one user
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const user = await User.findById(id).select("-passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("Get user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user."
    });
  }
};

// Update user details
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty."
        });
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid email address."
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address."
        });
      }

      const duplicate = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id }
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Another user already uses this email."
        });
      }

      updates.email = normalizedEmail;
    }

    if (role !== undefined) {
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role."
        });
      }
      updates.role = role;
    }

    if (status !== undefined) {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user status."
        });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update."
      });
    }

    const isChangingOwnAccount =
      user._id.toString() === req.user._id.toString();

    if (
      isChangingOwnAccount &&
      (updates.role !== undefined || updates.status === "Inactive")
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role or deactivate your own account."
      });
    }

    const removesActiveAdmin =
      user.role === "Admin" &&
      user.status === "Active" &&
      (updates.role !== undefined && updates.role !== "Admin" ||
       updates.status === "Inactive");

    if (removesActiveAdmin) {
      const activeAdminCount = await User.countDocuments({
        role: "Admin",
        status: "Active"
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "The last active Admin account cannot be demoted or deactivated."
        });
      }
    }

    Object.assign(user, updates);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User updated successfully.",
      data: safeUser(user)
    });
  } catch (error) {
    console.error("Update user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update user."
    });
  }
};

// Deactivate a user instead of permanently deleting the account
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account."
      });
    }

    if (user.status === "Inactive") {
      return res.status(200).json({
        success: true,
        message: "User is already inactive.",
        data: safeUser(user)
      });
    }

    if (user.role === "Admin") {
      const activeAdminCount = await User.countDocuments({
        role: "Admin",
        status: "Active"
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "The last active Admin account cannot be deactivated."
        });
      }
    }

    user.status = "Inactive";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User deactivated successfully.",
      data: safeUser(user)
    });
  } catch (error) {
    console.error("Deactivate user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate user."
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
};
