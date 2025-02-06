#!/usr/bin/env node

import Web3 from 'web3';
import { promises as fs } from 'fs';
// Provided RPC endpoint for the EVM chain
const RPC_URL = "https://newyork-inap-72-251-230-233.ankr.com:443/tac_tacd_testnet_full_rpc_1";

// Create a Web3 instance
const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));

// Function to check if we are connected to the node
async function checkConnection() {
  try {
    await web3.eth.net.isListening();
    console.log("Connected to the RPC endpoint.");
  } catch (error) {
    console.error("Error: Unable to connect to the RPC endpoint.", error);
    process.exit(1);
  }
}

// Main async function
async function main() {
  await checkConnection();

  // Read addresses from done.txt (assumes one address per line)

  let addresses;
  try {
    const data = await fs.readFile("done.txt", "utf8");
    
    addresses = data.split(/\r?\n/).filter(line => line.trim() !== "");
  } catch (error) {
    console.error("Error reading done.txt:", error);
    process.exit(1);
  }

  const zeroBalanceAddresses = [];

  // Loop through each address and check its balance
  for (const address of addresses) {
    // Validate the address
    if (!web3.utils.isAddress(address)) {
      console.warn(`Warning: ${address} is not a valid EVM address. Skipping.`);
      continue;
    }

    try {
      // Get the balance in wei (as a bigint)
      const balance = await web3.eth.getBalance(address);
      console.log(`Address ${address} has a balance of ${balance} wei.`);
      if (balance === 0n) {
        console.log(`Address ${address} has a zero balance.`);
        zeroBalanceAddresses.push(address);
      }
    } catch (error) {
      console.error(`Error checking balance for ${address}:`, error);
    }
  }

  // Write zero balance addresses to zero-balance.txt
  if (zeroBalanceAddresses.length > 0) {
    fs.writeFile( "zero-balance.txt", zeroBalanceAddresses.join("\n"), "utf8");
    console.log("Zero balance addresses have been written to zero-balance.txt");
  } else {
    console.log("No addresses with a zero balance were found.");
  }
}

main();
