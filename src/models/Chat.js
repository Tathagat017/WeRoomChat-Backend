const { mongoose } = require("../utility/dB.connection");

const chatSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "room",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ["text", "reaction"],
      default: "text",
    },
  },
  { timestamps: true }
);

const chatModel = mongoose.model("chat", chatSchema);

module.exports = { chatModel };
