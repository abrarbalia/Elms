const jwt = require("jsonwebtoken");

// Attach decoded token payload to req.user on success
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET || "your_super_secret_key_change_this";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

// Restrict to specific roles — use after verifyToken
function requireRole(...roles) {
  return (req, res, next) => {
    console.log(req.user?.role?.toLowerCase())
    console.log(roles)
    if (!roles.includes(req.user?.role?.toLowerCase())) {
      return res.status(403).json({ message: "Forbidden. Insufficient permissions." });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };