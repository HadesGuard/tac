const fs = require('fs');
const bip39 = require('bip39');
const hdkey = require('hdkey');
const Wallet = require('ethereumjs-wallet').default;

// Example 12-word recovery phrase (mnemonic)
const mnemonic = '';

// Convert the mnemonic to a seed
bip39.mnemonicToSeed(mnemonic).then((seed) => {
  // Create an HD Wallet from the seed
  const root = hdkey.fromMasterSeed(seed);

  // Open write streams to privkey.txt and address.txt
  const privkeyWriteStream = fs.createWriteStream('privkey.txt');
  const addressWriteStream = fs.createWriteStream('addresses.txt');

  // Generate 100 wallets
  for (let i = 0; i < 10000; i++) {
    // Derive the account using the standard Ethereum path (m/44'/60'/0'/0/i)
    const addrNode = root.derive(`m/44'/60'/0'/0/${i}`);

    // Get the private key from the derived node
    const privateKey = addrNode._privateKey.toString('hex');

    // Create an Ethereum wallet from the private key
    const wallet = Wallet.fromPrivateKey(addrNode._privateKey);
    const address = wallet.getChecksumAddressString();

    // Write the private key to privkey.txt
    privkeyWriteStream.write(`${privateKey}\n`);

    // Write the address to address.txt
    addressWriteStream.write(`${address}\n`);

    console.log(`Wallet ${i + 1}:`);
    console.log('Private Key:', privateKey);
    console.log('Address:', address);
  }

  // Close the write streams
  privkeyWriteStream.end();
  addressWriteStream.end();
}).catch((err) => {
  console.error('Error:', err);
});
