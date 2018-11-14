'use strict'

const db = require('./models/mongodb')
const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const config = require('config')

BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })
async function main() {
    let web3 = await new Web3(await new Web3.providers.WebsocketProvider(config.get('ethProvider.ws')))
    let accounts = await db.Account.find({balanceNumber: {$gt: 0}})

    console.log('There are %s account need to update account type', accounts.length)
    for (let i = 0; i < accounts.length; i++) {
        if (i % 100 === 0) {
            console.log('process items ', i)
        }
        let account = accounts[i]

        let code = await web3.eth.getCode(account.hash)
        if (code === '0x') {
            account.accountType = 'normal'
        } else {
            account.accountType = 'contract'
        }
        account.save()
    }
    console.log('Update account type is done')
    process.exit(1)
}

main()
