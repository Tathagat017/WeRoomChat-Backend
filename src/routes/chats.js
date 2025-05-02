const express = require("express");
const { chatModel } = require("../models/Chat");
const { roomModel } = require("../models/Room");
const { AuthenticationHandler } = require("../middleware/authentication");

const chatRouter = express.Router();

// Send Message in a Room (Group Chat)
chatRouter.post("/send", AuthenticationHandler, async (req, res) => {
  try {
    const { roomId, message, type } = req.body;
    const sender = req.body.userId;

    const room = await roomModel.findById(roomId);
    if (!room) {
      return res.status(404).send({ message: "Room not found" });
    }

    const newChat = new chatModel({
      roomId,
      sender,
      message,
      type,
    });

    await newChat.save();
    res
      .status(201)
      .send({ message: "Message sent successfully", chat: newChat });
  } catch (err) {
    console.error("Error sending message:", err);
    res
      .status(500)
      .send({ message: "Error sending message", error: err.message });
  }
});

// Get Messages in a Room
chatRouter.get("/:roomId", async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const chats = await chatModel
      .find({ roomId })
      .populate("sender", "full_name email");

    res.status(200).send({ chats });
  } catch (err) {
    console.error("Error getting messages:", err);
    res
      .status(500)
      .send({ message: "Error fetching messages", error: err.message });
  }
});

module.exports = { chatRouter };
