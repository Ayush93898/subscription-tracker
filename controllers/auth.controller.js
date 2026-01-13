import mongoose from "mongoose";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { JWT_EXPIRES, JWT_SECRET } from "../config/env.js";
// what is req body -> it is an object containing data from the client (POST (as in that req u pass some data))

export const signUp = async (req, res, next) => {
  const session = await mongoose.startSession(); // Creates a temporary context where MongoDB tracks changes.
  
  try {
    const { name, email, password } = req.body;
    // check if user already exist or not
    const existingUser = await User.findOne({email})
    if(existingUser){
      const error = new Error('User already exist')
      error.statusCode = 409
      throw error;
    }
    
    // Start transaction only when needed
    session.startTransaction(); // Tells MongoDB:Treat all upcoming writes as ONE unit.

    // hash the password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password,salt);
    
    // create a user
    const newUsers = await User.create([{name, email, password:hashedPassword}],{session}) // session islia agr backchodi hui toh cancel karde at moment par

    // create a token
    const token =  jwt.sign({userId: newUsers[0]._id}, JWT_SECRET, {expiresIn: JWT_EXPIRES}) // newUsers[0] = user
    await session.commitTransaction(); // Save all changes permanently
    
    res.status(201).json({
        success:true,
        message: 'User created successfully',
        data:{
            token,
            user : newUsers[0]
        }
    })
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally{
    session.endSession();
  }
};

export const signIn = async (req, res, next) => {};

export const signOut = async (req, res, next) => {};
