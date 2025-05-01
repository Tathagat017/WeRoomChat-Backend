const dotenv = require("dotenv");
dotenv.config();

// Third-party modules
const express = require("express");
const cors = require("cors");

// Local modules
const { connection } = require("./src/utility/dB.connection");

// Router modules
const { userRouter } = require("./src/routes/users");
// const { oemRouter } = require("./Routes/OEM_specs.routes");
// const { inventoryRouter } = require("./Routes/Dealer_inventory.routes");

// Middleware modules
const { AuthenticationHandler } = require("./src/middleware/authentication");
//const { QueryHandler } = require("./Middleware/QueryHandler.middleware");

// Initialize app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: "*" }));

// Root route
app.get("/", (req, res) => {
  res.status(200).send("Welcome");
});

// Routes
app.use("/users", userRouter); // login and signup

app.use(AuthenticationHandler); // Adds userId to each request if authorized
//app.use(QueryHandler); // Handles query, sort, pagination

// app.use("/oem_specs", oemRouter);
// app.use("/inventory", inventoryRouter);

// Start server
const PORT = process.env.SERVER_PORT || 5000;
app.listen(process.env.SERVER_PORT, async () => {
  try {
    console.log("listening on port " + process.env.SERVER_PORT);
    await connection;
    console.log("succefully connnected to mongoDb atlas");
  } catch (error) {
    console.log(error);
  }
});
