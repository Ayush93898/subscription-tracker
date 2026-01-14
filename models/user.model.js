import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "User name is required"],
      trim: true, // remove extra trailing space
      minLength: 3,
      maxLength: 50,
    },
    email: {
      type: String,
      required: [true, "User Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please fill a valid email address"], // abc@something.com
    },
    password: {
      type: String,
      required: [true, "User password is required"],
      minLength: 6,
    },
  },
  { timestamps: true }
); // set createdAt and UpdatedAt automatically

const User = mongoose.model("User", userSchema);
export default User;