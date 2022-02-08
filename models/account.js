const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accountSchema = new Schema({
    _id: mongoose.Schema.Types.ObjectId,
    firstName: String,
    lastName: String,
    email: String,
    mobile: String,
    isConfirm: Boolean,
    isLocked: Boolean,
    createdAt: { type:Date, default: Date.now },
    updatedAt: { type:Date, default: Date.now },
    customer: String
})

module.exports = mongoose.model('Account', accountSchema);
