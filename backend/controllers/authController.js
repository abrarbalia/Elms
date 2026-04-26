const jwt  = require("jsonwebtoken");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ Email: email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    let isMatch = false;
    if (typeof user.Password === 'string' && user.Password.startsWith('$2')) {
      isMatch = await bcrypt.compare(password.toString(), user.Password);
    } else {
      isMatch = (Number(password) === user.Password);
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    
    console.log(user.role)
    const secret = process.env.JWT_SECRET || "your_super_secret_key_change_this";
    const token = jwt.sign(
      {
        id:       user._id,
        empCode:  user["Employee Code"],
        role:     user.role,
        deptCode: user.dept_code
      },
      secret,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id:         user._id,
        name:       user.Name,
        empCode:    user["Employee Code"],
        email:      user.Email,
        role:       user.role,
        department: user.department,
        dept_code:  user.dept_code,
        staffType:  user.staffType
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    
    // Specific feedback for database timeouts/connectivity issues
    if (error.message.includes("buffering timed out") || error.message.includes("selection timeout")) {
      return res.status(503).json({ 
        message: "Database connection failed. Please ensure your IP is whitelisted in MongoDB Atlas and check your internet connection." 
      });
    }
    
    res.status(500).json({ message: "Server error." });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ message: "Email, old password, and new password are required." });
    }

    const user = await User.findOne({ Email: email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    let isMatch = false;
    if (typeof user.Password === 'string' && user.Password.startsWith('$2')) {
      isMatch = await bcrypt.compare(oldPassword.toString(), user.Password);
    } else {
      isMatch = (Number(oldPassword) === user.Password);
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect old password." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword.toString(), salt);

    user.Password = hashedPassword;
    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error.message);
    res.status(500).json({ message: "Server error." });
  }
};

/**
 * Register a new user (Admin Only)
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, empCode, dept_code, staffType } = req.body;

    // 1. Validation
    if (!name || !email || !password || !empCode) {
      return res.status(400).json({ message: "Name, Email, Password, and Employee Code are required." });
    }

    // 2. Duplicate Check
    const existing = await User.findOne({ 
      $or: [{ Email: email }, { "Employee Code": Number(empCode) }] 
    });
    
    if (existing) {
      return res.status(400).json({ message: "User with this Email or Employee Code already exists." });
    }

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.toString(), salt);

    // 4. Create User (Default role: staff)
    const newUser = await User.create({
      Name: name,
      Email: email,
      Password: hashedPassword,
      "Employee Code": Number(empCode),
      dept_code: dept_code ? Number(dept_code) : null,
      staffType: staffType || "Teaching",
      role: "staff" // Enforcing default role as requested
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully by admin.",
      user: {
        id: newUser._id,
        name: newUser.Name,
        email: newUser.Email,
        empCode: newUser["Employee Code"],
        role: newUser.role
      }
    });

  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({ message: "Server error during registration." });
  }
};