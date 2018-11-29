const { web3Eth, web3Tomo } = require('./web3')
const config = require('config')
const PrivateKeyProvider = require('truffle-privatekey-provider')
const db = require('./models')
const TomoABI = require('./files/tomocoin')
const BigNumber = require('bignumber.js')

let sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))
BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })

async function main() {
    const tomoContract = await new web3Eth.eth.Contract(TomoABI, config.get('tomoAddress'))


    let accounts = await db.Account.find({
        balanceNumber: {$gt: 0},
        accountType: 'normal',
        isSend: false,
        hasBalance: false
    }).sort({balanceNumber: 1})

    let tAccounts = []
    let map = accounts.map(async function (account, index) {
        // let balanceOnChain = new BigNumber(0.001 * 10 ** 18)
        console.log('process', index, account.hash)
        let balanceOnChain = '0'
        try {
            balanceOnChain = await tomoContract.methods.balanceOf(account.hash).call()
        } catch (e) {
            console.error('cannot get balance on Tomo contract (Ethereum network)')
        }

        if (balanceOnChain !== '0') {
            balanceOnChain = new BigNumber(balanceOnChain)
            if (balanceOnChain.toString() !== account.balance) {
                console.log('balance is not equal, update', balanceOnChain.toString(), account.balance)
                account.balance = balanceOnChain.toString()
                account.balanceNumber = balanceOnChain.dividedBy(10**18).toNumber()
            }

            let tx = await db.TomoTransaction.findOne({toAccount: account.hash})
            if (!tx){
                let currentBalance = null
                try {
                    currentBalance = await web3Tomo.eth.getBalance(account.hash)
                } catch (e) {
                    console.error('cannot get balance account %s. Will send Tomo in the next time', account.hash, e)
                }
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

    await sendTomo(tAccounts)

}

const send = function(obj) {
    let p = new Promise(resolve, reject => {
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
                return reject()
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
                    console.log('Done', obj.to)
                } catch (e) {
                    console.error('Save db error', obj.to)
                }
                return resolve()
            }
        })
    })
    return p
}


async function sendTomo(accounts) {
    let coinbase = await web3Tomo.eth.getCoinbase()
    let nonce = await web3Tomo.eth.getTransactionCount(coinbase)
    let obj = accounts.map(a => {
        nonce = parseInt(nonce) + 1
        return {
            nonce: nonce,
            from: coinbase,
            to: a.hash,
            value: a.balance,
            gasLimit: 21000,
            gasPrice: 5000,
            account: a.account
        }
    })
    let objBulk = []
    let objChunk = []
    for (let i in obj) {
        if (objChunk.length === 100) {
            objBulk.push(objChunk)
            objChunk = []
        }
        objChunk.push(obj[i])
    }

    for (let i in objBulk) {
        let chunk = objBulk[i]
        for (let j in chunk) {
            let obj = chunk[j]
            console.log('Start send %s tomo to %s', obj.value, obj.to)
            await send(obj)
        }
        await sleep(10000)
    }
}

main()
