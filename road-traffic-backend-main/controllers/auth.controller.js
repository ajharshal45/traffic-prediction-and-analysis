import { User } from "../models/user.model.js"; // Adjust the import path as needed
import jwt from "jsonwebtoken";

// Function to handle user registration (Logic remains mostly the same, password hashing handled by pre-save hook)
export const registerUser = async (req, res) => {
  try {
  const { username, email, password, mobile_number } = req.body;

// Check if the user already exists (checking by mobile_number is fine)
    const existingUser = await User.findOne({ mobile_number });
    if (existingUser) {
    return res
    .status(400)
    .json({ message: "User with this phone number already exists" });
    }

    // When newUser.save() is called, the pre-save hook in user.model.js will automatically hash the password.
const newUser = new User({ username, email, password, mobile_number });
const savedUser = await newUser.save();
console.log("new user has been saved !");
// console.log(savedUser);

 res.status(201).json(savedUser);
 } catch (error) {
 console.error(error);
res.status(500).json({ message: "Error creating user" });
}
};

// Function to handle user login (SECURELY UPDATED)
export const loginUser = async (req, res) => {
 const { username, password } = req.body;
 try {
    // 1. Find user only by username
 const info = await User.findOne({ username });
    
 if (!info) {
 return res.status(401).json({ message: "Invalid credentials" }); // Use 401 for security
}

    // 2. Use the comparePassword method to check the hashed password
    const isPasswordMatch = await info.comparePassword(password);
    
    if (!isPasswordMatch) {
        return res.status(401).json({ message: "Invalid credentials" }); // Use 401 for security
    }

 const user = info._doc;
 const age = 1000 * 60 * 60 * 24 * 7; // 7 days in milliseconds

 // Set isAdmin flag based on user's role from the database (assuming 'role' field exists)
    // NOTE: Based on user.model.js, you may want to use 'isAdmin' field instead of 'role' if 'role' is missing.
 const token = jwt.sign(
 {
 id: user._id,
 isAdmin: user.isAdmin, // ✅ ADJUSTED: Using 'isAdmin' flag from the model
},
 process.env.JWT_SECRET_KEY,
 { expiresIn: age / 1000 } // JWT expects age in seconds
);

    // Destructure the password out of the user object before sending response
 const { password: userPassword, ...userInfo } = user;

 res
 .cookie("token", token, {
 httpOnly: true,
 maxAge: age,
secure: process.env.NODE_ENV === 'production', // Add secure flag in production
 sameSite: 'lax', // Prevents CSRF issues
})
.status(200)
.json(userInfo);
} catch (err) {
console.error(err);
res.status(500).json({ message: "Failed to login!" });
}
};


export const logout = (req, res) => {
  res.clearCookie("token").status(200).json({ message: "Logout Successful" });
};