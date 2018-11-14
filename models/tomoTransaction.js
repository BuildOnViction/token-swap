'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema

const TomoTransaction = new Schema({
    hash: { type: String, index: true },
    fromAccount: { type: String, index: true },
    toAccount: { type: String, index: true },
    value: String,
    valueNumber: Number,
    createdAt: Date
}, { timestamps: false })

module.exports = mongoose.model('TomoTransaction', TomoTransaction)
