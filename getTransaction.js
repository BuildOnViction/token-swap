'use strict'

const db = require('./models')
const BigNumber = require('bignumber.js')
const Web3 = require('web3')
const config = require('config')
const TomoABI = require('./files/tomocoin')

let web3 = new Web3(new Web3.providers.WebsocketProvider(config.get('ethProvider.ws')))

const TomoCoin = new web3.eth.Contract(TomoABI, config.get('tomoAddress'))

let startBlock = config.get('startBlock')
let endBlock = config.get('endBlock')

let sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })
async function run(start, end) {
    if (end > endBlock) {
        end = endBlock
    }
    await TomoCoin.getPastEvents('Transfer', { fromBlock: start, toBlock: end }, async function (error, events) {
        if (error) {
            console.error('Cannot get list events from block %s to %s', start, end)
            console.error(error)
        }
        if (!error){
            let data = []
            console.log('There are %s events from block %s to %s', events.length, start, end)
            let map = events.map(async function (event) {
                if (event.event === 'Transfer') {
                    let blockNumber = event.blockNumber
                    let transactionHash = event.transactionHash
                    let fromWallet = event.returnValues.from
                    let toWallet = event.returnValues.to
                    let tokenAmount = new BigNumber(event.returnValues.value)

                    data.push({
                        hash: transactionHash,
                        block: blockNumber,
                        fromAccount: fromWallet.toLowerCase(),
                        toAccount: toWallet.toLowerCase(),
                        amount: tokenAmount.toString(),
                        amountNumber: tokenAmount.dividedBy(10**18).toNumber(),
                        isProcess: false
                    })
                }
            })
            await Promise.all(map)
            if (data.length > 0) {
                await db.Transaction.insertMany(data)
            }
            return true
        }
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