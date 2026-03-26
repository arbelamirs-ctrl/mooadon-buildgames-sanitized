import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function DeploymentGuide() {
  const [copied, setCopied] = useState('');

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(''), 2000);
  };

  const solidityContract = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoyaltyToken is ERC20, Ownable {
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 tokenDecimals
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = tokenDecimals;
        _mint(msg.sender, initialSupply * 10**tokenDecimals);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount * 10**_decimals);
    }
    
    function burn(uint256 amount) public {
        _burn(msg.sender, amount * 10**_decimals);
    }
}`;

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Code className="w-5 h-5" />
          Token Deployment Guide on Avalanche Fuji
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="setup" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="contract">Contract</TabsTrigger>
            <TabsTrigger value="deploy">Deploy</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="bg-yellow-400 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Adding Avalanche Fuji to MetaMask
              </h3>
              <div className="bg-slate-900 rounded p-3 text-sm text-slate-300 space-y-1 font-mono" dir="ltr">
                <div>Network Name: Avalanche Fuji C-Chain</div>
                <div>RPC URL: https://api.avax-test.network/ext/bc/C/rpc</div>
                <div>Chain ID: 43113</div>
                <div>Symbol: AVAX</div>
                <div>Explorer: https://testnet.snowtrace.io</div>
              </div>
              <Button
                onClick={() => copyToClipboard('https://api.avax-test.network/ext/bc/C/rpc', 'rpc')}
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300"
              >
                {copied === 'rpc' ? <CheckCircle className="w-4 h-4 ml-2" /> : <Copy className="w-4 h-4 ml-2" />}
                Copy RPC URL
              </Button>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="bg-yellow-400 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Get AVAX for Testing
              </h3>
              <p className="text-slate-300 text-sm">
                AVAX is needed to pay Gas fees. Use the Faucet:
              </p>
              <a
                href="https://faucet.avax.network/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <ExternalLink className="w-4 h-4 ml-2" />
                  Open Avalanche Faucet
                </Button>
              </a>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="bg-yellow-400 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Open Remix IDE
              </h3>
              <a
                href="https://remix.ethereum.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <ExternalLink className="w-4 h-4 ml-2" />
                  Open Remix IDE
                </Button>
              </a>
            </div>
          </TabsContent>

          <TabsContent value="contract" className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-semibold">Contract Code - LoyaltyToken.sol</h3>
                <Button
                  onClick={() => copyToClipboard(solidityContract, 'contract')}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-300"
                >
                  {copied === 'contract' ? <CheckCircle className="w-4 h-4 ml-2" /> : <Copy className="w-4 h-4 ml-2" />}
                  Copy Code
                </Button>
              </div>
              <pre className="bg-slate-900 rounded p-4 text-xs text-slate-300 overflow-x-auto max-h-96" dir="ltr">
                {solidityContract}
              </pre>
            </div>

            <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3">
              <p className="text-blue-200 text-sm">
                The contract uses OpenZeppelin - a secure and tested library for smart contracts
              </p>
            </div>
          </TabsContent>

          <TabsContent value="deploy" className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <h3 className="text-white font-semibold">Deployment Steps in Remix</h3>
              <ol className="text-slate-300 text-sm space-y-2 list-decimal list-inside">
                <li>Create a new file named LoyaltyToken.sol</li>
                <li>Copy the contract code from the "Contract" tab</li>
                <li>Click "Solidity Compiler" and select version 0.8.20</li>
                <li>Click "Compile"</li>
                <li>Go to "Deploy & Run Transactions"</li>
                <li>Select Environment: "Injected Provider - MetaMask"</li>
                <li>Make sure MetaMask is on the Fuji network</li>
                <li>Enter parameters:
                  <div className="bg-slate-900 rounded p-2 mt-1 font-mono text-xs" dir="ltr">
                    name: "MyCompany Loyalty Points"<br/>
                    symbol: "MCLP"<br/>
                    initialSupply: 1000000<br/>
                    tokenDecimals: 18
                  </div>
                </li>
                <li>Click "Deploy" and confirm in MetaMask</li>
                <li><strong>Copy the deployed contract address!</strong></li>
              </ol>
            </div>

            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-lg p-4 space-y-2">
              <h4 className="text-emerald-300 font-semibold">After Deployment:</h4>
              <ol className="text-emerald-200 text-sm space-y-1 list-decimal list-inside">
                <li>Copy the contract address</li>
                <li>Go to Company Settings in the app</li>
                <li>Select network: "Avalanche Fuji"</li>
                <li>Paste the contract address in the "Token Contract" field</li>
                <li>Save</li>
              </ol>
            </div>

            <div className="bg-amber-500/20 border border-amber-400/30 rounded-lg p-3">
              <p className="text-amber-200 text-sm">
                <strong>Important:</strong> This is a testnet. When ready for production, deploy on Avalanche Mainnet (Chain ID: 43114)
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2">
          <a
            href="https://docs.avax.network/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="outline" className="w-full border-slate-700 text-slate-300">
              <ExternalLink className="w-4 h-4 ml-2" />
              Avalanche Docs
            </Button>
          </a>
          <a
            href="https://testnet.snowtrace.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="outline" className="w-full border-slate-700 text-slate-300">
              <ExternalLink className="w-4 h-4 ml-2" />
              Snowtrace Explorer
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}