# OkzooV2 Contract

## Usage

### Pre Requisites

Before being able to run any command, you need to create a `.env` file and set a BIP-39 compatible mnemonic as an
environment variable. You can follow the example in `.env.example`. If you don't already have a mnemonic, you can use
this [website](https://iancoleman.io/bip39/) to generate one.

Then, proceed with installing dependencies:

```sh
$ yarn install
```

### TypeChain

Compile the smart contracts and generate TypeChain bindings:

```sh
$ yarn typechain
```

### Test

Run the tests with Hardhat:

```sh
$ yarn test
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Report Gas

See the gas usage per unit test and average gas per method call:

```sh
$ REPORT_GAS=true yarn test
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Hardhat cache:

```sh
$ yarn clean
```

### Deploy Proxy

Deploy the contracts to Hardhat Network:
require: PRIVATE_KEY must me set, either in environment or in vars file
for production, strong recommend for using vars file to store private key to reduce risk of leaking private key

```sh
$ yarn hardhat deployProxy --contract <contract name> --network <network>
# sample
$ yarn hardhat deployProxy --contract OkzooV2 --network bsctestnet
```

contract name will be looked up in `contracts` folder
for each contract, can create a Config object in ./scripts/configs/

````typescript
```sh
$ yarn hardhat run scripts/deploy_all.ts --network sepolia
````

### Upgrade a new version of contract

```sh
yarn hardhat upgradeProxy --network <network> --contract <contract name> --address <address of the proxy>
#sample
yarn hardhat upgradeProxy --network bscTestnet --contract OkzooV2 --address 0x2FaDc94C6F134e97955c78f5b85F0a92F921851B
```

### verify contract on etherscan

requires API_KEY to be set in environment or in vars file
or api key for each network is set directly in hardhat.config.ts

```sh
yarn hardhat verifyProxy --network <network> --address <address of the proxy>
yarn hardhat verifyProxy --network bscTestnet --address 0x2FaDc94C6F134e97955c78f5b85F0a92F921851B
```

### Fix husky not executable

```sh
chmod ug+x .husky/*
chmod ug+x .git/hooks/*
```
