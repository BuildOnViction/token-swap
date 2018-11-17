'use strict'

const db = require('./models')
const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const config = require('config')

BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })
async function main() {
    let web3 = await new Web3(await new Web3.providers.WebsocketProvider(config.get('ethProvider.ws')))
    // Only make sure account with balance greate than 0
    let accounts = await db.Account.find({balanceNumber: {$gt: 0}})

    console.log('There are %s account need to update account type', accounts.length)
    let map = accounts.map(async function (account) {
        let code = await web3.eth.getCode(account.hash)
        account.accountType = code === '0x' ? 'normal' : 'contract'
        account.isSend = false
        account.hasBalance = false
        account.save()
        console.log('update acc %s is %s', account.hash, account.accountType)
    })
    await Promise.all(map)
    console.log('Update account type is done')
    process.exit(1)
}

main()
