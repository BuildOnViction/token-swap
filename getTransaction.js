'use strict'

const db = require('./models')
const BigNumber = require('bignumber.js')
const { web3Eth } = require('./web3')
const config = require('config')
const TomoABI = require('./files/tomocoin')

let startBlock = config.get('startBlock')
let endBlock = config.get('endBlock')

let sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })
async function run(start, end) {
    if (end > endBlock) {
        end = endBlock
    }
    let TomoCoin = new web3Eth.eth.Contract(TomoABI, config.get('tomoAddress'))

    return TomoCoin.getPastEvents('Transfer', { fromBlock: start, toBlock: end }).then(async (events) => {
        console.log('There are %s events from block %s to %s', events.length, start, end)
        let map = events.map(async function (event) {
            if (event.event === 'Transfer') {
                let blockNumber = event.blockNumber
                let transactionHash = event.transactionHash
                let fromWallet = event.returnValues.from
                let toWallet = event.returnValues.to
                let tokenAmount = new BigNumber(event.returnValues.value)

                return {
                    hash: transactionHash,
                    block: blockNumber,
                    fromAccount: fromWallet.toLowerCase(),
                    toAccount: toWallet.toLowerCase(),
                    amount: tokenAmount.toString(),
                    amountNumber: tokenAmount.dividedBy(10**18).toNumber(),
                    isProcess: false
                }
            }
        })
        return Promise.all(map)
    }).then(data => {
        if (data.length > 0) {
            return db.Transaction.insertMany(data)
        }
    }).catch(async (e) => {
        await sleep(2000)
        console.log('Error when crawl', start, end)
        console.log('Sleep 2 seconds, Re-crawl', start, end)
        web3Eth.reconnect()
        return await run(start, end)
    })

}

async function main() {
    let i
    for (i = startBlock; i < endBlock; i+=5000) {
        let end = i + 5000 - 1
        if (end > endBlock) {
            end = endBlock
        }
        await run(i, end)
    }
    if (i >= endBlock) {
        console.log('Get all transactions is done. Waiting 5 seconds to finish')
        await sleep(5000)
        process.exit(1)
    }
}

main()
