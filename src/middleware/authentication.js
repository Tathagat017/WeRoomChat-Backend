const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const AuthenticationHandler = (req, res, next) => {
  const token = req.headers.authorization;
  console.log(token);
  if (token) {
    jwt.verify(
      token.split(" ")[1],
      process.env.JWT_SECRET_KEY,
      (err, decoded) => {
        if (decoded) {
          req.body["userId"] = decoded.userId;
          req.body["full_name"] = decoded.full_name;
          next();
        } else {
          res.status(404).send({
            message:
              "Authorization failure.You are not authorized to perform this action",
          });
        }
      }
    );
  } else {
    res.status(400).send({ message: "Please Login first" });
  }
};

module.exports = { AuthenticationHandler };
