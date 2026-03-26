import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Award, 
  Star, 
  Crown, 
  Zap,
  Gift,
  Sparkles,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { toast } from "sonner";
import { base44 } from '@/api/base44Client';

const NFT_TIERS = [
  {
    id: 'bronze',
    name: 'Bronze Member',
    icon: Award,
    color: 'from-amber-700 to-amber-900',
    bgColor: 'bg-amber-900/20',
    borderColor: 'border-amber-700/50',
    textColor: 'text-amber-400',
    pointsRequired: 1000,
    description: 'Regular customer - basic benefits',
    benefits: ['5% discount', 'Event access'],
    image: '🥉'
  },
  {
    id: 'silver',
    name: 'Silver VIP',
    icon: Star,
    color: 'from-slate-400 to-slate-600',
    bgColor: 'bg-slate-700/20',
    borderColor: 'border-slate-500/50',
    textColor: 'text-slate-300',
    pointsRequired: 5000,
    description: 'VIP customer - special benefits',
    benefits: ['10% discount', 'Priority service', 'Birthday gift'],
    image: '🥈'
  },
  {
    id: 'gold',
    name: 'Gold Elite',
    icon: Crown,
    color: 'from-yellow-400 to-yellow-600',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/50',
    textColor: 'text-yellow-400',
    pointsRequired: 10000,
    description: 'Elite customer - all benefits',
    benefits: ['20% discount', 'VIP service', 'Club access', 'Free parking'],
    image: '🥇'
  },
  {
    id: 'diamond',
    name: 'Diamond Legend',
    icon: Sparkles,
    color: 'from-cyan-400 to-blue-600',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/50',
    textColor: 'text-cyan-400',
    pointsRequired: 50000,
    description: 'Legendary customer - exclusive',
    benefits: ['30% discount', 'All benefits', 'Personal advisor', 'Exclusive events'],
    image: '💎'
  }
];

export default function NFTRewards({ client, company }) {
  const [minting, setMinting] = useState(null);
  const [mintedNFTs, setMintedNFTs] = useState([]);

  const clientTier = NFT_TIERS.find(tier => 
    client.total_earned >= tier.pointsRequired
  ) || NFT_TIERS[0];

  const nextTier = NFT_TIERS.find(tier => 
    tier.pointsRequired > client.total_earned
  );

  const mintNFT = async (tier) => {
    if (client.total_earned < tier.pointsRequired) {
      toast.error(`Need ${tier.pointsRequired.toLocaleString()} points to mint this NFT`);
      return;
    }

    setMinting(tier.id);
    
    try {
      // In production, this would:
      // 1. Call smart contract mint function
      // 2. Pay gas fees
      // 3. Receive NFT token ID
      // 4. Store NFT data in database
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const nftData = {
        tier: tier.id,
        name: tier.name,
        tokenId: Math.floor(Math.random() * 10000),
        mintedAt: new Date().toISOString(),
        txHash: '0x' + Math.random().toString(36).substring(2, 15)
      };
      
      // Store in client metadata
      await base44.entities.Client.update(client.id, {
        nft_tier: tier.id,
        nft_token_id: nftData.tokenId
      });
      
      setMintedNFTs([...mintedNFTs, nftData]);
      toast.success(`NFT ${tier.name} created successfully! 🎉`);
    } catch (error) {
      toast.error('NFT minting error');
    } finally {
      setMinting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Tier Card */}
      <Card className={`border-2 ${clientTier.borderColor} ${clientTier.bgColor}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${clientTier.color} flex items-center justify-center text-2xl`}>
              {clientTier.image}
            </div>
            <div>
              <h3 className={`text-xl font-bold ${clientTier.textColor}`}>
                {clientTier.name}
              </h3>
              <p className="text-sm text-slate-400">Your current level</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-300">{clientTier.description}</p>
          
          <div>
            <p className="text-sm text-slate-400 mb-2">Benefits:</p>
            <div className="space-y-1">
              {clientTier.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-300">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {client.nft_token_id ? (
            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Gift className="w-4 h-4" />
                <span className="text-sm font-medium">You have an NFT!</span>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-xs text-emerald-300">Token #{client.nft_token_id}</code>
                <Button size="sm" variant="outline" className="border-emerald-700">
                  <ExternalLink className="w-3 h-3 ml-1" />
                  View
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => mintNFT(clientTier)}
              disabled={minting === clientTier.id}
              className={`w-full bg-gradient-to-r ${clientTier.color}`}
            >
              {minting === clientTier.id ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  Minting NFT...
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4 ml-2" />
                  Mint NFT at this level
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Progress to Next Tier */}
      {nextTier && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Next Level</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${nextTier.color} flex items-center justify-center text-xl`}>
                {nextTier.image}
              </div>
              <div>
                <h4 className="font-medium text-white">{nextTier.name}</h4>
                <p className="text-sm text-slate-400">{nextTier.description}</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Progress</span>
                <span>
                  {client.total_earned.toLocaleString()} / {nextTier.pointsRequired.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${nextTier.color} transition-all`}
                  style={{ width: `${Math.min((client.total_earned / nextTier.pointsRequired) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {(nextTier.pointsRequired - client.total_earned).toLocaleString()} points remaining
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {NFT_TIERS.map(tier => {
          const isUnlocked = client.total_earned >= tier.pointsRequired;
          const isCurrent = tier.id === clientTier.id;
          
          return (
            <Card 
              key={tier.id}
              className={`border ${
                isCurrent ? `border-2 ${tier.borderColor} ${tier.bgColor}` : 
                isUnlocked ? 'border-slate-700 bg-slate-900' : 
                'border-slate-800 bg-slate-950 opacity-50'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center text-xl`}>
                    {tier.image}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-medium ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>
                      {tier.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {tier.pointsRequired.toLocaleString()} points
                    </p>
                  </div>
                  {isCurrent && (
                    <Badge className={`${tier.bgColor} ${tier.textColor} border-0`}>
                      Current
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-1">
                  {tier.benefits.slice(0, 2).map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Zap className={`w-3 h-3 ${isUnlocked ? 'text-yellow-400' : 'text-slate-600'}`} />
                      <span className={`text-xs ${isUnlocked ? 'text-slate-300' : 'text-slate-600'}`}>
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info */}
      <div className="bg-indigo-900/20 border border-indigo-700/50 rounded-lg p-4">
        <h4 className="text-indigo-300 font-medium mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          What are NFT Rewards?
        </h4>
        <p className="text-sm text-indigo-200">
          An NFT (Non-Fungible Token) is a unique digital asset on the blockchain. 
          Each loyalty tier is represented by a special NFT granting access to exclusive benefits.
          Your NFT is stored in your digital wallet and cannot be duplicated!
        </p>
      </div>
    </div>
  );
}