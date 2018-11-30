'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Transaction = new Schema({
    hash: { type: String, index: true },
    block: { type: Number, index: true },
    fromAccount: { type: String, index: true },
    toAccount: { type: String, index: true },
    amount: String,
    isProcess: { type: Boolean, index: true },
    amountNumber: Number
}, { timestamps: false })

module.exports = mongoose.model('Transaction', Transaction)
