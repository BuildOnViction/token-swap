'use strict'

const Web3 = require('web3')
const PrivateKeyProvider = require('truffle-privatekey-provider')
const config = require('config')

const providerEth = new Web3.providers.WebsocketProvider(config.get('ethProvider.ws'))
const web3Eth = new Web3(providerEth)

web3Eth.reconnect = function () {
    console.log('Eth - WS closed/errored')
    console.log('Attempting to reconnect...')
    let provider = new Web3.providers.WebsocketProvider(config.get('ethProvider.ws'))
    web3Eth.setProvider(provider)

    provider.on('connect', function () {
        console.log('Eth - WSS Reonnected')
    })
}

const providerTomo = new PrivateKeyProvider(config.get('privateKey'), config.get('tomoProvider.http'))
const web3Tomo = new Web3(providerTomo)

const providerEthRpc = new Web3.providers.HttpProvider(config.get('ethProvider.http'))
const web3EthRpc = new Web3(providerEthRpc)

module.exports = { web3Eth, web3Tomo, web3EthRpc }
