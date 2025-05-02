const express = require("express");
const { roomModel } = require("../models/Room");
const { AuthenticationHandler } = require("../middleware/authentication");
const { chatModel } = require("../models/Chat");
const { userModel } = require("../models/User");
const { updateRoomStatus } = require("../services/roomStatusService");
const { invitationModel } = require("../models/Invitation");

const roomRouter = express.Router();

// Create Room
roomRouter.post("/create", AuthenticationHandler, async (req, res) => {
  try {
    const {
      title,
      description,
      room_type,
      tag,
      start_time,
      end_time,
      max_participants,
      invited_users,
    } = req.body;
    const creator = req.body.userId;

    // Create the room
    const newRoom = new roomModel({
      title,
      description,
      room_type,
      tag,
      start_time,
      end_time,
      max_participants,
      creator,
      invited_users,
    });

    await newRoom.save();

    //deletelates

    const testUserId = invited_users[0]; // For example, emitting to the first invited user
    console.log("Emitting test roomInvitation to user:", testUserId);

    req.io.to(testUserId).emit("roomInvitation", {
      message: "Test invitation", // Custom message for testing
      roomId: newRoom._id.toString(), // Room ID
      roomTitle: newRoom.title, // Room title
      invitedBy: creator, // Creator's ID
      invitationId: "0",
    });

    //

    // If there are invited users, create invitations and send notifications
    if (invited_users && invited_users.length > 0) {
      // Loop through each invited user
      for (let invitedUserId of invited_users) {
        const invitation = new invitationModel({
          roomId: newRoom._id,
          roomTitle: newRoom.title,
          invitedBy: creator, // Creator of the room is the one inviting
          invitedTo: invitedUserId,
        });

        await invitation.save(); // Save invitation in the database

        // Send WebSocket notifications to the invited user
        req.io.to(invitedUserId).emit("roomInvitation", {
          message: `You have been invited to join the room: ${newRoom.title}`,
          roomId: newRoom._id,
          roomTitle: newRoom.title,
          invitedBy: creator,
          invitationId: invitation._id,
        });
      }
    }

    // Send the response back to the client
    res
      .status(201)
      .send({ message: "Room created successfully", room: newRoom });
  } catch (err) {
    console.error("Error creating room:", err);
    res
      .status(500)
      .send({ message: "Error creating room", error: err.message });
  }
});

// Get Room by ID
roomRouter.get("/userRoom/:id", async (req, res) => {
  try {
    await updateRoomStatus();
    const room = await roomModel
      .findById(req.params.id)
      .populate("creator", "full_name email")
      .populate("invited_users", "full_name email")
      .populate("participants", "full_name email");

    if (!room) {
      return res.status(404).send({ message: "Room not found" });
    }

    res.status(200).send({ room });
  } catch (err) {
    console.error("Error getting room:", err);
    res.status(500).send({ message: "Error getting room", error: err.message });
  }
});

// Update Room Status (for example, from 'scheduled' to 'live')
roomRouter.patch("/:id/status", AuthenticationHandler, async (req, res) => {
  try {
    const { status } = req.body;
    const room = await roomModel.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!room) {
      return res.status(404).send({ message: "Room not found" });
    }

    res.status(200).send({ message: "Room status updated", room });
  } catch (err) {
    console.error("Error updating room status:", err);
    res
      .status(500)
      .send({ message: "Error updating room status", error: err.message });
  }
});

// Delete Room
roomRouter.delete("/:id", AuthenticationHandler, async (req, res) => {
  try {
    const room = await roomModel.findByIdAndDelete(req.params.id);

    if (!room) {
      return res.status(404).send({ message: "Room not found" });
    }

    res.status(200).send({ message: "Room deleted successfully" });
  } catch (err) {
    console.error("Error deleting room:", err);
    res
      .status(500)
      .send({ message: "Error deleting room", error: err.message });
  }
});

roomRouter.post("/:roomId/invite/:userId", async (req, res) => {
  try {
    await updateRoomStatus();

    const room = await roomModel.findById(req.params.roomId);
    if (!room) return res.status(404).send({ message: "Room not found" });

    if (room.status === "closed")
      return res.status(400).send({ message: "Room is closed" });

    const invitedUserId = req.params.userId;
    const inviterId = req.userId;

    // Check if already invited
    const existingInvitation = await invitationModel.findOne({
      roomId: room._id,
      invitedTo: invitedUserId,
    });

    if (existingInvitation)
      return res.status(400).send({ message: "User already invited" });

    // Save invitation in DB
    const newInvitation = new invitationModel({
      roomId: room._id,
      roomTitle: room.title,
      invitedBy: inviterId,
      invitedTo: invitedUserId,
    });

    await newInvitation.save();

    // Update room invited_users array
    if (!room.invited_users.includes(invitedUserId)) {
      room.invited_users.push(invitedUserId);
      await room.save();
    }

    // Emit Socket.IO event
    req.io.to(invitedUserId).emit("roomInvitation", {
      roomId: room._id,
      title: room.title,
      invitedBy: inviterId,
      invitationId: newInvitation._id,
    });

    return res.status(200).send({ message: "User invited" });
  } catch (err) {
    console.error("Error inviting user:", err);
    res
      .status(500)
      .send({ message: "Error inviting user", error: err.message });
  }
});

// Accept invitation
roomRouter.post("/:roomId/accept", async (req, res) => {
  try {
    const userId = req.userId;
    await updateRoomStatus();

    const room = await roomModel.findById(req.params.roomId);
    if (!room) return res.status(404).send({ message: "Room not found" });
    if (room.status === "closed")
      return res.status(400).send({ message: "Room is closed" });

    const invitation = await invitationModel.findOne({
      roomId: room._id,
      invitedTo: userId,
    });

    if (!invitation)
      return res.status(403).send({ message: "You are not invited" });

    if (invitation.status !== "pending")
      return res
        .status(400)
        .send({ message: "Invitation already responded to" });

    // Update invitation status
    invitation.status = "accepted";
    await invitation.save();

    // Update room
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      room.invited_users.pull(userId);
      await room.save();
    }

    return res.status(200).send({ message: "Invitation accepted" });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error accepting invitation", error: err.message });
  }
});

// Reject invitation
roomRouter.post("/:roomId/reject", async (req, res) => {
  try {
    const userId = req.userId;
    await updateRoomStatus();

    const room = await roomModel.findById(req.params.roomId);
    if (!room) return res.status(404).send({ message: "Room not found" });

    const invitation = await invitationModel.findOne({
      roomId: room._id,
      invitedTo: userId,
    });

    if (!invitation)
      return res.status(403).send({ message: "You are not invited" });

    if (invitation.status !== "pending")
      return res
        .status(400)
        .send({ message: "Invitation already responded to" });

    invitation.status = "declined";
    await invitation.save();

    room.invited_users.pull(userId);
    await room.save();

    return res.status(200).send({ message: "Invitation rejected" });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Error rejecting invitation", error: err.message });
  }
});

// Get All Invitations for a User

roomRouter.get("/invitations", AuthenticationHandler, async (req, res) => {
  try {
    const userId = req.body.userId; // Make sure this correctly matches your authentication setup

    const invitations = await invitationModel
      .find({ invitedTo: userId }) // Find invitations where the user is the invited one
      .populate("roomId", "title start_time end_time") // Populate room details
      .populate("invitedBy", "full_name email") // Populate inviter's details
      .populate("invitedTo", "full_name email") // Populate invited user's details
      .exec();

    if (!invitations || invitations.length === 0) {
      return res.status(404).send({ message: "No invitations found" });
    }

    // Transform data to match the InvitationNotification interface
    const formattedInvitations = invitations.map((invitation) => ({
      message: `You are invited to the room "${invitation.roomId.title}" by ${invitation.invitedBy.full_name}.`,
      roomId: invitation.roomId._id.toString(), // Converting ObjectId to string
      roomTitle: invitation.roomId.title,
      invitedBy: invitation.invitedBy._id.toString(), // Converting ObjectId to string
      invitationId: invitation._id.toString(), // Converting ObjectId to string
      status: invitation.status,
    }));

    res.status(200).send(formattedInvitations);
  } catch (err) {
    console.error("Error retrieving invitations:", err);
    res
      .status(500)
      .send({ message: "Error retrieving invitations", error: err.message });
  }
});

// Get All Rooms
roomRouter.get("/allRooms", async (req, res) => {
  try {
    // Fetch all rooms with selected fields
    const rooms = await roomModel
      .find()
      .select(
        "title description room_type start_time end_time tag max_participants status participants creator"
      )
      .populate("creator", "full_name email") // Populate creator's details
      .exec();

    // Map the rooms to match the Room structure
    const roomsResponse = rooms.map((room) => ({
      id: room._id.toString(),
      title: room.title,
      description: room.description,
      type: room.room_type,
      startTime: room.start_time,
      endTime: room.end_time,
      tags: room.tag,
      maxParticipants: room.max_participants,
      status: room.status,
      participants: room.participants,
      creator: room.creator._id.toString(),
    }));

    // Return the rooms in the desired format as an array
    res.status(200).send(roomsResponse); // Return the array directly
  } catch (err) {
    console.error("Error getting rooms:", err);
    res
      .status(500)
      .send({ message: "Error retrieving rooms", error: err.message });
  }
});

module.exports = { roomRouter };
