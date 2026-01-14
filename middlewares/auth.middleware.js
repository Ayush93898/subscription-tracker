// protecting the routes
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import User from "../models/user.model.js";

// only logged-in user can : get profile, create subsciption, delete data
// so we need before controller runs-- verify user identity
// Authorization: Bearer <token>
// If authorize fails → controller NEVER runs.

const authorize = async (req, res, next) => {
  try {
    let token;

    // get token from the header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // if no token -- then reject
    if (!token) {
      return res.status(401).json({ message: "unauthorized" });
    }

    // verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    //get  user from the db
    const user = await User.findById(decoded.userId);

    // if user not found -- reject
    if (!user) {
      return res.status(401).json({ message: "unauthorized" });
    }

    // attach user to req
    req.user = user; // Now every next controller can access:, easily access email , id..wihtout db calls

    // continue to controller
    next();

  } catch (error) {
    next(error);
  }
};

export default authorize;