# token-swap
Calculate token holder from Ethereum ERC20 and Swap to mainnet 

### Require
- Nodejs
- npm
- mongodb

### Setup
Install some package
```
npm install
```
Copy and modify config (update `endBlock`, update `privateKey` & `db.uri` )
```
cp config/default.json config/local.json
```

### Run
Get all transfer transaction 
```
node getTransaction.js
```
Update account balance
```
node updateAccountBalance.js
```
Update account type
```
node updateAccountType.js
```
Swap token
```
node swap.js
```