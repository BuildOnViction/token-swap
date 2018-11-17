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

    let accounts = await db.Account.find({balanceNumber: {$gt: 0}, accountType: 'normal'}).sort({balanceNumber: 1})
    accounts.forEach(async function (account) {
        // let balanceOnChain = new BigNumber(0.001 * 10 ** 18)
        let balanceOnChain = await tomoContract.methods.balanceOf(account.hash).call()
        balanceOnChain = new BigNumber(balanceOnChain)
        if (balanceOnChain.toString() !== account.balance) {
            console.log('balance is not equal, update', balanceOnChain.toString(), account.balance)
            account.balance = balanceOnChain.toString()
            account.balanceNumber = balanceOnChain.dividedBy(10**18).toNumber()
            account.save()
        }

        let tx = await db.TomoTransaction.findOne({toAccount: account.hash})
        if (!tx){
            let currentBalance = null
            try {
                currentBalance = await web3.eth.getBalance(account.hash)
            } catch (e) {
                console.log('cannot get balance account %s. Will send Tomo in the next time', account.hash)
            }
            if (currentBalance === '0') {
                sendTomo(account.hash, coinbase, balanceOnChain.toString())
            }
        }
    })
}

function sendTomo(toAccount, coinbase, value) {
    let balance = new BigNumber(value)
    try {
        web3.eth.sendTransaction({
            from: coinbase,
            to: toAccount,
            value: balance.toString(),
            gasLimit: 21000,
            gasPrice: 1
        }, function (err, hash) {
            if (err) {
                console.error(err)
            } else {
                try {
                    let ttx = new db.TomoTransaction({
                        hash: hash,
                        fromAccount: coinbase,
                        toAccount: toAccount,
                        value: balance.toString(),
                        valueNumber: balance.dividedBy(10 ** 18).toNumber(),
                        createdAt: new Date()
                    })
                    ttx.save()
                    console.log('send %s tomo to %s', balance.dividedBy(10 ** 18).toNumber(), toAccount)
                } catch (e) {
                    console.error(e)
                }
            }
        })
    } catch (e) {
        console.error(e)
    }

}

main()