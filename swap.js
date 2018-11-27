const Web3 = require('web3')
const config = require('config')
const PrivateKeyProvider = require('truffle-privatekey-provider')
const db = require('./models')
const TomoABI = require('./files/tomocoin')
const BigNumber = require('bignumber.js')

BigNumber.config({ EXPONENTIAL_AT: [-100, 100] })

const web3 = new Web3(config.get('tomoProvider.http'))
const provider = new PrivateKeyProvider(config.get('privateKey'), config.get('tomoProvider.http'))

web3.eth.setProvider(provider)
async function main() {
    const ethWeb3 = await new Web3(new Web3.providers.HttpProvider(config.get('ethProvider.http')))
    const tomoContract = await new ethWeb3.eth.Contract(TomoABI, config.get('tomoAddress'))

    let coinbase = await web3.eth.getCoinbase()

    let accounts = await db.Account.find({
        balanceNumber: {$gt: 0},
        accountType: 'normal',
        isSend: false,
        hasBalance: false
    }).sort({balanceNumber: 1})
    accounts.forEach(async function (account) {
        // let balanceOnChain = new BigNumber(0.001 * 10 ** 18)
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
                    currentBalance = await web3.eth.getBalance(account.hash)
                } catch (e) {
                    console.error('cannot get balance account %s. Will send Tomo in the next time', account.hash, e)
                }
                if (currentBalance === '0') {
                    sendTomo(account, coinbase, balanceOnChain.toString())
                }
                if (currentBalance !== '0' && currentBalance !== null) {
                    account.hasBalance = true
                    try {
                        account.save()
                    } catch (e) {
                        console.error('Cannot save account')
                        console.error(e)
                        process.exit(1)
                    }
                }
            }

        }

    })
}

function sendTomo(account, coinbase, value) {
    let balance = new BigNumber(value)
    try {
        web3.eth.sendTransaction({
            from: coinbase,
            to: account.hash,
            value: balance.toString(),
            gasLimit: 21000,
            gasPrice: 5000
        }, function (err, hash) {
            if (err) {
                console.error(err)
                process.exit(1)
            } else {
                try {
                    let ttx = new db.TomoTransaction({
                        hash: hash,
                        fromAccount: coinbase,
                        toAccount: account.hash,
                        value: balance.toString(),
                        valueNumber: balance.dividedBy(10 ** 18).toNumber(),
                        createdAt: new Date()
                    })
                    ttx.save()
                    account.isSend = true
                    account.save()
                    console.log('send %s tomo to %s', balance.dividedBy(10 ** 18).toNumber(), account.hash)
                } catch (e) {
                    console.error(e)
                    process.exit(1)
                }
            }
        })
    } catch (e) {
        console.error(e)
        process.exit(1)
    }

}

main()