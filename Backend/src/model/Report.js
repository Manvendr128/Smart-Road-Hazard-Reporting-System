
const mongoose = require("mongoose");

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

    // GeoJSON Point: coordinates are [longitude, latitude]
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (coordinates) {
            return (
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

// Supports future location-based queries.
// This does not implement a map interface.
reportSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Report", reportSchema);
