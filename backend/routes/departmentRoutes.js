const express = require("express");
const router = express.Router();

const deptController = require("../controllers/departmentController");


router.post("/", deptController.createDepartment);
router.get("/", deptController.getDepartments);
router.get("/:id", deptController.getDepartmentById);
router.put("/:id", deptController.updateDepartment);
router.delete("/:id", deptController.deleteDepartment);

module.exports = router;