import mongoose from 'mongoose'; 
const { Schema } = mongoose;

const complaintSchema=new Schema(
    {
        // ✅ FIX: Changed type from String to Number
        longitude:{
            type:Number,
            required:true
        },
        // ✅ FIX: Changed type from String to Number
        latitude:{
            type:Number,
            required:true
        },
        src:{
            type:String,
        },
        category:{
            type:String,
            required:true
        },
        description: {
            type:String,
            required:true
        },
        isresolved:{
            type:Boolean,
            default:false
        },
    },
    {
        timestamps:true
    }
)

export const Complaint=mongoose.model("Complaint",complaintSchema);