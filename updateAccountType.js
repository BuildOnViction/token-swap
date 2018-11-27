'use strict'

const db = require('./models')
const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const config = require('config')

BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })
async function getAccounts() {
    // Only make sure account with balance greate than 0
    return db.Account.find({balanceNumber: {$gt: 0}})
}
async function main() {
    let web3 = await new Web3(await new Web3.providers.WebsocketProvider(config.get('ethProvider.ws')))
    let accounts = await getAccounts()

    while (accounts.length > 0) {
        console.log('Updating type of %s accounts...', accounts.length)
        let map = accounts.map(async function (account) {
            try {
                let code = await web3.eth.getCode(account.hash)
                account.accountType = code === '0x' ? 'normal' : 'contract'
                account.isSend = false
                account.hasBalance = false
                account.save()
                console.log('update acc %s is %s', account.hash, account.accountType)
            } catch (e) {
                console.log(e)
            }

        })
        await Promise.all(map)
        accounts = await getAccounts()
    }

    console.log('Update account type is done')
    process.exit(1)
}

main()
