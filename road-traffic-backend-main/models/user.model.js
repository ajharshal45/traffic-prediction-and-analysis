import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // ✅ ADDED: Import bcryptjs

const { Schema } = mongoose;

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        // ... other fields like citizenScore, etc.
    },
    {
        timestamps: true,
    }
);

// 1. ✅ PRE-SAVE HOOK: Hash the password before saving
userSchema.pre('save', async function (next) {
    // Only run this function if password was actually modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        // Generate a salt (recommended complexity: 10-12)
        const salt = await bcrypt.genSalt(10);
        
        // Hash the password
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// 2. ✅ METHOD: Method to compare entered password with hashed password in database
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        // Compare the given password (candidatePassword) with the stored hash (this.password)
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error(error);
    }
};

export const User = mongoose.model("User", userSchema);