'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Account = new Schema({
    hash: { type: String, unique: true },
    balance: String,
    balanceNumber: Number,
    accountType: { type: String, index: true }
}, { timestamps: false })

module.exports = mongoose.model('Account', Account)
