
const mongoose = require("mongoose");

// Status history schema
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "Pending",
        "Verified",
        "In Progress",
        "Resolved",
        "Rejected",
      ],
      required: true,
    },

    remark: {
      type: String,
      trim: true,
      default: "",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Optional GeoJSON location schema
const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },

    coordinates: {
      type: [Number],
      required: true,

      validate: {
        validator: function (coordinates) {
          return (
            Array.isArray(coordinates) &&
            coordinates.length === 2 &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90
          );
        },

        message:
          "Coordinates must be [longitude, latitude].",
      },
    },
  },
  { _id: false }
);

// Main Report Schema
const reportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: [
        "Pothole",
        "Damaged Road",
        "Road Blockage",
        "Open Manhole",
        "Waterlogging",
        "Fallen Object",
        "Other",
      ],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    severity: {
      type: String,
      enum: ["Low", "Medium", "High"],
      required: true,
      default: "Medium",
    },

    imageUrl: {
      type: String,
      required: true,
    },

    // Optional location coordinates for future map integration
    location: {
      type: locationSchema,
      default: undefined,
    },

    // Manual location details
    address: {
      type: String,
      trim: true,
      default: "",
    },

    landmark: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Verified",
        "In Progress",
        "Resolved",
        "Rejected",
      ],
      default: "Pending",
      index: true,
    },

    adminRemarks: {
      type: String,
      trim: true,
      default: "",
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },

  { timestamps: true }
);

// Geospatial index for future location-based queries
reportSchema.index({ location: "2dsphere" });

// Export Report model
module.exports = mongoose.model("Report", reportSchema);
