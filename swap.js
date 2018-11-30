const { web3Eth, web3Tomo } = require('./web3')
const config = require('config')
const db = require('./models')
const TomoABI = require('./files/tomocoin')
const BigNumber = require('bignumber.js')
const events = require('events')

// fix warning max listener
events.EventEmitter.defaultMaxListeners = 1000
process.setMaxListeners(1000)

let sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))
var nonce = 0
BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })

async function getAccounts() {
    return db.Account.find({
        balanceNumber: {$gt: 0},
        accountType: 'normal',
        isSend: false,
        hasBalance: false
    }).sort({balanceNumber: 1}).limit(100)
}

async function getErc20Balance(address) {
    try {
        return tomoContract.methods.balanceOf(address).call()
    } catch (e) {
        console.error('cannot get balance on Tomo contract (Ethereum network)', address)
        console.error(String(e))
        console.log('Sleep 1 second and re-getErc20Balance until done')
        await sleep(1000)
        return getErc20Balance(address)
    }
}

async function getTomoBalance(address) {
    try {
        return web3Tomo.eth.getBalance(address)
    } catch (e) {
        console.error('cannot get balance account %s. Will send Tomo in the next time', account.hash)
        console.error(String(e))
        console.log('Sleep 1 second and re-getTomoBalance until done')
        await sleep(1000)
        return getTomoBalance(address)
    }
}

async function main() {
    let coinbase = await web3Tomo.eth.getCoinbase()
    nonce = await web3Tomo.eth.getTransactionCount(coinbase)
    const tomoContract = await new web3Eth.eth.Contract(TomoABI, config.get('tomoAddress'))

    let accounts = await getAccounts()
    while (accounts.length > 0) {
        let tAccounts = []
        let map = accounts.map(async function (account, index) {
            // let balanceOnChain = new BigNumber(0.001 * 10 ** 18)
            // must be done before move to next step
            let balanceOnChain = await getErc20Balance(account.hash)

            if (balanceOnChain !== '0') {
                balanceOnChain = new BigNumber(balanceOnChain)
                if (balanceOnChain.toString() !== account.balance) {
                    console.log('Update account %s with new balance', account.hash, balanceOnChain.toString())
                    account.balance = balanceOnChain.toString()
                    account.balanceNumber = balanceOnChain.dividedBy(10**18).toNumber()
                }

                let tx = await db.TomoTransaction.findOne({toAccount: account.hash})
                if (!tx){
                    // must be done before move to next step
                    let currentBalance = await getTomoBalance(account.hash)
                    if (currentBalance === '0') {
                        tAccounts.push({
                            hash: account.hash,
                            balance: balanceOnChain.toString(),
                            account: account
                        })
                    }
                    if (currentBalance !== '0' && currentBalance !== null) {
                        account.hasBalance = true
                        try {
                            account.save()
                        } catch (e) {
                            console.error('Cannot save account')
                            console.error(e)
                        }
                    }
                }

            }
        })

        await Promise.all(map)

        await sendTomo(coinbase, tAccounts)
        console.log('Send tomo to %s account, Sleep 10 seconds', tAccounts.length)
        await sleep(5000)

        accounts = await getAccounts()
    }

}

const send = function(obj) {
    let p = new Promise((resolve, reject) => {
        web3Tomo.eth.sendTransaction({
            nonce: obj.nonce,
            from: obj.from,
            to: obj.to,
            value: obj.value,
            gasLimit: obj.gashLimit,
            gasPrice: obj.gasPrice
        }, function (err, hash) {
            if (err) {
                console.error('Send error', obj.to)
                console.error('Nonce', obj.nonce)
                console.error(String(err))
                console.error('Sleep 1 second and resend until done')
                sleep(1000).then(() => {
                    return resolve(send(obj))
                })
            } else {
                try {
                    let balance = new BigNumber(obj.value)
                    let ttx = new db.TomoTransaction({
                        hash: hash,
                        fromAccount: obj.from,
                        toAccount: obj.to,
                        value: obj.value,
                        valueNumber: balance.dividedBy(10 ** 18).toNumber(),
                        createdAt: new Date()
                    })
                    ttx.save()
                    obj.account.isSend = true
                    obj.account.save()
                    console.log('Done', obj.to, obj.value, hash, 'nonce', obj.nonce)
                } catch (e) {
                    console.error('Save db error', obj.to)
                }
                return resolve()
            }
        })
    })
    return p
}


async function sendTomo(coinbase, accounts) {
    for (let i in accounts) {
        let a = accounts[i]
        let item = {
            nonce: parseInt(nonce),
            from: coinbase,
            to: a.hash,
            value: a.balance,
            gasLimit: 21000,
            gasPrice: 5000,
            account: a.account
        }

        console.log('Start send %s tomo to %s', item.value, item.to)
        // must be done before move to next step
        await send(item)
        nonce = parseInt(nonce) + 1

    }
}

main()
