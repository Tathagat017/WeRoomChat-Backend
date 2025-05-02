// src/services/roomStatusService.js

const { roomModel } = require("../models/Room");
const moment = require("moment");

const updateRoomStatus = async () => {
  const currentTime = moment().toDate(); // Get current time

  // Find rooms that are scheduled and start_time has passed
  const roomsToStart = await roomModel.find({
    status: "scheduled",
    start_time: { $lte: currentTime }, // Start time has passed
  });

  // Update rooms to 'live' if the start time has passed
  for (const room of roomsToStart) {
    room.status = "live";
    await room.save();
    console.log(`Room ${room._id} is now live.`);
  }

  // Find rooms that are live and end_time has passed
  const roomsToClose = await roomModel.find({
    status: "live",
    end_time: { $lte: currentTime }, // End time has passed
  });

  // Update rooms to 'closed' if the end time has passed
  for (const room of roomsToClose) {
    room.status = "closed";
    await room.save();
    console.log(`Room ${room._id} is now closed.`);
  }
};

// Export the function so we can call it periodically
module.exports = { updateRoomStatus };
