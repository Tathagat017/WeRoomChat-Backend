// src/models/Room.js
const { mongoose } = require("../utility/dB.connection");

const roomSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    room_type: {
      type: String,
      enum: ["private", "public"],
      default: "private",
    },
    tag: { type: String },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "live", "closed"],
      default: "scheduled",
    },
    max_participants: { type: Number },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    invited_users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    join_code: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

const roomModel = mongoose.model("room", roomSchema);

module.exports = { roomModel };
