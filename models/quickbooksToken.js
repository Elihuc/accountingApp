const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const quickbooksToken = new Schema({
    _id: mongoose.Schema.Types.ObjectId,
    realmId: String,
    access_token: String,
    refresh_token: String,
    client_id: String,
    client_secret: String,
    associateId: String,
    tokenStringifyJsonObject: String
})

module.exports = mongoose.model('QuickbooksToken', quickbooksToken);