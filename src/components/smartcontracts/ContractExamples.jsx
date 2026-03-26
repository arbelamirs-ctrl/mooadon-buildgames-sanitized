import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle, Code } from 'lucide-react';
import { toast } from "sonner";

const CONTRACTS = {
  loyaltyToken: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoyaltyToken is ERC20, Ownable {
    mapping(address => bool) public merchants;
    mapping(address => uint256) public earnedPoints;
    mapping(address => uint256) public redeemedPoints;
    
    event PointsEarned(address indexed customer, uint256 amount, address indexed merchant);
    event PointsRedeemed(address indexed customer, uint256 amount, address indexed merchant);
    
    constructor() ERC20("LoyaltyPoints", "LOYAL") {
        // Mint initial supply to contract owner (company)
        _mint(msg.sender, 1000000 * 10**decimals());
    }
    
    modifier onlyMerchant() {
        require(merchants[msg.sender], "Not authorized merchant");
        _;
    }
    
    function addMerchant(address merchant) external onlyOwner {
        merchants[merchant] = true;
    }
    
    function removeMerchant(address merchant) external onlyOwner {
        merchants[merchant] = false;
    }
    
    function earnPoints(address customer, uint256 amount) external onlyMerchant {
        require(amount > 0, "Amount must be greater than 0");
        _transfer(owner(), customer, amount);
        earnedPoints[customer] += amount;
        emit PointsEarned(customer, amount, msg.sender);
    }
    
    function redeemPoints(address customer, uint256 amount) external onlyMerchant {
        require(balanceOf(customer) >= amount, "Insufficient points");
        _transfer(customer, owner(), amount);
        redeemedPoints[customer] += amount;
        emit PointsRedeemed(customer, amount, msg.sender);
    }
    
    function getCustomerStats(address customer) external view returns (
        uint256 balance,
        uint256 earned,
        uint256 redeemed
    ) {
        return (balanceOf(customer), earnedPoints[customer], redeemedPoints[customer]);
    }
}`,

  nftRewards: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoyaltyNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    enum Tier { Bronze, Silver, Gold, Diamond }
    
    struct NFTMetadata {
        Tier tier;
        uint256 pointsRequired;
        uint256 mintedAt;
        string benefits;
    }
    
    mapping(uint256 => NFTMetadata) public nftData;
    mapping(address => uint256[]) public customerNFTs;
    mapping(Tier => string) public tierURIs;
    
    event NFTMinted(address indexed customer, uint256 tokenId, Tier tier);
    event TierUpgraded(uint256 tokenId, Tier oldTier, Tier newTier);
    
    constructor() ERC721("LoyaltyMembership", "LMEMBER") {
        // Set tier URIs (IPFS or metadata)
        tierURIs[Tier.Bronze] = "ipfs://QmBronze...";
        tierURIs[Tier.Silver] = "ipfs://QmSilver...";
        tierURIs[Tier.Gold] = "ipfs://QmGold...";
        tierURIs[Tier.Diamond] = "ipfs://QmDiamond...";
    }
    
    function mintNFT(
        address customer,
        Tier tier,
        uint256 pointsRequired,
        string memory benefits
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(customer, tokenId);
        _setTokenURI(tokenId, tierURIs[tier]);
        
        nftData[tokenId] = NFTMetadata({
            tier: tier,
            pointsRequired: pointsRequired,
            mintedAt: block.timestamp,
            benefits: benefits
        });
        
        customerNFTs[customer].push(tokenId);
        
        emit NFTMinted(customer, tokenId, tier);
        return tokenId;
    }
    
    function upgradeTier(uint256 tokenId, Tier newTier) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        Tier oldTier = nftData[tokenId].tier;
        require(newTier > oldTier, "Can only upgrade to higher tier");
        
        nftData[tokenId].tier = newTier;
        _setTokenURI(tokenId, tierURIs[newTier]);
        
        emit TierUpgraded(tokenId, oldTier, newTier);
    }
    
    function getCustomerNFTs(address customer) external view returns (uint256[] memory) {
        return customerNFTs[customer];
    }
    
    function getNFTMetadata(uint256 tokenId) external view returns (NFTMetadata memory) {
        require(_exists(tokenId), "Token does not exist");
        return nftData[tokenId];
    }
    
    // Prevent transfers (soulbound token)
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        require(from == address(0) || to == address(0), "Soulbound: Transfer not allowed");
        super._beforeTokenTransfer(from, to, tokenId);
    }
}`,

  cryptoPayment: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CryptoPayment is Ownable {
    IERC20 public paymentToken; // USDC, USDT, etc.
    address public merchantWallet;
    
    struct Payment {
        address customer;
        uint256 amount;
        uint256 pointsEarned;
        uint256 timestamp;
        string orderId;
    }
    
    Payment[] public payments;
    mapping(address => uint256[]) public customerPayments;
    
    event PaymentReceived(
        address indexed customer,
        uint256 amount,
        uint256 pointsEarned,
        string orderId
    );
    
    constructor(address _paymentToken, address _merchantWallet) {
        paymentToken = IERC20(_paymentToken);
        merchantWallet = _merchantWallet;
    }
    
    function processPayment(
        uint256 amount,
        uint256 pointsEarned,
        string memory orderId
    ) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from customer to merchant
        require(
            paymentToken.transferFrom(msg.sender, merchantWallet, amount),
            "Payment failed"
        );
        
        // Record payment
        Payment memory newPayment = Payment({
            customer: msg.sender,
            amount: amount,
            pointsEarned: pointsEarned,
            timestamp: block.timestamp,
            orderId: orderId
        });
        
        payments.push(newPayment);
        customerPayments[msg.sender].push(payments.length - 1);
        
        emit PaymentReceived(msg.sender, amount, pointsEarned, orderId);
    }
    
    function getCustomerPayments(address customer) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return customerPayments[customer];
    }
    
    function getPayment(uint256 paymentId) 
        external 
        view 
        returns (Payment memory) 
    {
        require(paymentId < payments.length, "Invalid payment ID");
        return payments[paymentId];
    }
    
    function setMerchantWallet(address _merchantWallet) external onlyOwner {
        merchantWallet = _merchantWallet;
    }
}`,

  deployment: `// Hardhat deployment script
const { ethers } = require("hardhat");

async function main() {
  // Deploy LoyaltyToken
  console.log("Deploying LoyaltyToken...");
  const LoyaltyToken = await ethers.getContractFactory("LoyaltyToken");
  const loyaltyToken = await LoyaltyToken.deploy();
  await loyaltyToken.deployed();
  console.log("LoyaltyToken deployed to:", loyaltyToken.address);
  
  // Deploy LoyaltyNFT
  console.log("Deploying LoyaltyNFT...");
  const LoyaltyNFT = await ethers.getContractFactory("LoyaltyNFT");
  const loyaltyNFT = await LoyaltyNFT.deploy();
  await loyaltyNFT.deployed();
  console.log("LoyaltyNFT deployed to:", loyaltyNFT.address);
  
  // Deploy CryptoPayment (example with USDC on Polygon)
  const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
  const MERCHANT_WALLET = "YOUR_COMPANY_WALLET_ADDRESS";
  
  console.log("Deploying CryptoPayment...");
  const CryptoPayment = await ethers.getContractFactory("CryptoPayment");
  const cryptoPayment = await CryptoPayment.deploy(USDC_POLYGON, MERCHANT_WALLET);
  await cryptoPayment.deployed();
  console.log("CryptoPayment deployed to:", cryptoPayment.address);
  
  // Add merchant to LoyaltyToken
  console.log("Adding merchants...");
  await loyaltyToken.addMerchant(cryptoPayment.address);
  
  console.log("\\n=== Deployment Complete ===");
  console.log("LoyaltyToken:", loyaltyToken.address);
  console.log("LoyaltyNFT:", loyaltyNFT.address);
  console.log("CryptoPayment:", cryptoPayment.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });`
};

export default function ContractExamples() {
  const [copied, setCopied] = useState('');

  const copyCode = (code, key) => {
    navigator.clipboard.writeText(code);
    setCopied(key);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Code className="w-5 h-5" />
          Smart Contracts - Solidity Code Examples
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="token" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800">
            <TabsTrigger value="token">Loyalty Token</TabsTrigger>
            <TabsTrigger value="nft">NFT Rewards</TabsTrigger>
            <TabsTrigger value="payment">Crypto Payment</TabsTrigger>
            <TabsTrigger value="deploy">Deployment</TabsTrigger>
          </TabsList>

          {Object.entries(CONTRACTS).map(([key, code]) => (
            <TabsContent key={key} value={key === 'loyaltyToken' ? 'token' : key === 'nftRewards' ? 'nft' : key === 'cryptoPayment' ? 'payment' : 'deploy'}>
              <div className="relative">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyCode(code, key)}
                  className="absolute top-2 left-2 z-10 text-slate-400"
                >
                  {copied === key ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <pre className="bg-slate-950 rounded-lg p-4 overflow-x-auto text-xs text-slate-300 border border-slate-800 max-h-[500px]" dir="ltr">
                  {code}
                </pre>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-6 space-y-4">
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
            <h4 className="text-amber-300 font-medium mb-2">🔧 How to Deploy?</h4>
            <ol className="text-sm text-amber-200 space-y-1 list-decimal list-inside">
              <li>Install Hardhat: <code>npm install --save-dev hardhat</code></li>
              <li>Init project: <code>npx hardhat</code></li>
              <li>Copy code to <code>contracts/</code> folder</li>
              <li>Run deployment: <code>npx hardhat run scripts/deploy.js --network polygon</code></li>
              <li>Verify contracts: <code>npx hardhat verify --network polygon [CONTRACT_ADDRESS]</code></li>
            </ol>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <h4 className="text-blue-300 font-medium mb-2">📚 Required Dependencies</h4>
            <pre className="bg-slate-950 rounded-lg p-3 text-xs text-blue-200" dir="ltr">
npm install @openzeppelin/contracts{'\n'}
npm install --save-dev @nomiclabs/hardhat-ethers ethers
            </pre>
          </div>

          <div className="bg-indigo-900/20 border border-indigo-700/50 rounded-lg p-4">
            <h4 className="text-indigo-300 font-medium mb-2">🌐 Supported Networks</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-indigo-200">
              <div>• Polygon (MATIC)</div>
              <div>• Binance Smart Chain</div>
              <div>• Ethereum</div>
              <div>• Avalanche</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}