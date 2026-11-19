
const Report = require("../model/Report");
const cloudinary = require("../config/cloudinary");
const crypto = require("crypto");
const mongoose = require("mongoose");

// Generate unique report ID
const generateReportId = () => {
  return "RPT-" + crypto.randomBytes(4).toString("hex").toUpperCase();
};

// Upload image to Cloudinary
const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "smart-road-hazards",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
};

// CREATE NEW REPORT
exports.createReport = async (req, res,next) => {
  try {
    const {
      category,
      description,
      severity,
      address,
      landmark,
    } = req.body;

    // Validate required fields
    if (!category || !description || !address) {
      return res.status(400).json({
        success: false,
        message: "Category, description and address are required",
      });
    }

    // Check image
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a hazard image",
      });
    }

    // Upload image to Cloudinary
    const uploadedImage = await uploadToCloudinary(req.file);

    // Save report in MongoDB
    const report = await Report.create({
      reportId: generateReportId(),
      userId: req.user.id,
      category,
      description,
      severity: severity || "Medium",
      imageUrl: uploadedImage.secure_url,
      address,
      landmark: landmark || "",
      status: "Pending",
      statusHistory: [
        {
          status: "Pending",
          remark: "Report submitted",
          updatedBy: req.user.id,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Road hazard reported successfully",
      report,
    });

  } catch (error) {
    next(error);
  }
};

// GET ALL REPORTS
exports.getAllReports = async (req, res,next) => {
  try {
    const reports = await Report.find()
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });

  } catch (error) {
    next(error);
  }
};

// GET LOGGED-IN USER'S REPORTS
exports.getMyReports = async (req, res,next) => {
  try {
    const reports = await Report.find({
      userId: req.user.id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });

  } catch (error) {
    next(error);
  }
};

// GET REPORT BY ID
exports.getReportById = async (req, res,next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID",
      });
    }

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const isOwner =
      report.userId.toString() === req.user.id;

    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this report",
      });
    }

    await report.populate("userId", "name email phone");

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    next(error);
  }
};


// ADMIN: UPDATE REPORT STATUS

exports.updateReportStatus = async (req, res,next) => {
  try {
    const { status, remark } = req.body || {};

    const allowedTransitions = {
      "Pending": ["Verified", "Rejected"],
      "Verified": ["In Progress", "Rejected"],
      "In Progress": ["Resolved"],
      "Resolved": [],
      "Rejected": [],
    };

    // Validate MongoDB report ID
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID",
      });
    }

    // Validate status
    if (
      typeof status !== "string" ||
      !Object.keys(allowedTransitions).includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid report status",
      });
    }

    // Validate remark
    if (
      remark !== undefined &&
      typeof remark !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Remark must be a string",
      });
    }

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Check allowed status transitions
    const validNextStatuses =
      allowedTransitions[report.status] || [];

    if (!validNextStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${report.status} to ${status}`,
      });
    }

    // Update report status
    report.status = status;
    report.adminRemarks = remark?.trim() || "";

    // Save status history
    report.statusHistory.push({
      status,
      remark: remark?.trim() || "",
      updatedBy: req.user.id,
      updatedAt: new Date(),
    });

    await report.save();

    return res.status(200).json({
      success: true,
      message: "Report status updated successfully",
      report,
    });

  } catch (error) {
    next(error);
  }
};
