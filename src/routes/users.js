const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

const { userModel } = require("../models/User");
dotenv.config();
const userRouter = express.Router();

userRouter.post("/signup", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    // Add input validation
    if (!email || !password || !full_name) {
      return res.status(400).send({ message: "All fields are required" });
    }
    const exitingUser = await userModel.findOne({ email: email });

    if (exitingUser) {
      return res.status(409).send({
        message: "Email already exists, please login instead.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new userModel({
      full_name: full_name,
      email: email,
      password: hashedPassword,
    });

    await user.save();
    return res
      .status(201)
      .send({ message: "User registered successfully", full_name, email });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).send({
      msg: "Something went wrong, please try again",
      error: err.message,
    });
  }
});

userRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);
    const expiresIn = "2h";
    const user = await userModel.findOne({ email: email });
    if (user) {
      bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
          const token = jwt.sign(
            { userId: user._id, full_name: user.full_name },
            process.env.JWT_SECRET_KEY,
            { expiresIn }
          );
          res.status(200).send({
            message: "Login successful",
            token: token,
            userId: user._id,
            full_name: user.full_name,
          });
        } else {
          res.status(401).send({
            message:
              "Authentication Failed.Credentials dont match in record with ones provided.Please check your login credentials",
          });
        }
      });
    } else {
      res.status(404).send({ message: "Please register yourself first" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
});

module.exports = { userRouter };
