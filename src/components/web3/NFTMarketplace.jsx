import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ShoppingBag, 
  Tag,
  TrendingUp,
  Package,
  Wallet,
  Search,
  Filter,
  Loader2,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { toast } from "sonner";

// Mock NFT listings
const MOCK_LISTINGS = [
  {
    id: 1,
    tokenId: 42,
    name: 'Gold Loyalty #42',
    tier: 'gold',
    image: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400',
    seller: '0x1234...5678',
    price: 500,
    listed: true,
    rarity: 'Rare'
  },
  {
    id: 2,
    tokenId: 108,
    name: 'Platinum Loyalty #108',
    tier: 'platinum',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400',
    seller: '0xabcd...efgh',
    price: 1200,
    listed: true,
    rarity: 'Epic'
  },
  {
    id: 3,
    tokenId: 7,
    name: 'Diamond Loyalty #7',
    tier: 'diamond',
    image: 'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=400',
    seller: '0x9876...4321',
    price: 2500,
    listed: true,
    rarity: 'Legendary'
  },
  {
    id: 4,
    tokenId: 156,
    name: 'Silver Loyalty #156',
    tier: 'silver',
    image: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400',
    seller: '0x5555...6666',
    price: 200,
    listed: true,
    rarity: 'Common'
  }
];

export default function NFTMarketplace({ client, company }) {
  const [listings, setListings] = useState(MOCK_LISTINGS);
  const [activeTab, setActiveTab] = useState('browse');
  const [loading, setLoading] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [listPrice, setListPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const userWallet = client?.wallet_address;
  const userBalance = client?.current_balance || 0;

  const handleBuyNFT = async (listing) => {
    if (!userWallet) {
      toast.error('Connect a wallet first');
      return;
    }

    if (userBalance < listing.price) {
      toast.error('Not enough tokens');
      return;
    }

    setLoading(true);
    try {
      // In production: Call smart contract buyNFT function
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Remove from listings
      setListings(listings.filter(l => l.id !== listing.id));

      toast.success(`NFT #${listing.tokenId} purchased successfully!`);
    } catch (error) {
      toast.error('Purchase error');
    } finally {
      setLoading(false);
    }
  };

  const handleListNFT = async () => {
    if (!listPrice || parseFloat(listPrice) <= 0) {
      toast.error('Enter a valid price');
      return;
    }

    setLoading(true);
    try {
      // In production: Call smart contract listNFT function
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newListing = {
        id: listings.length + 1,
        tokenId: Math.floor(Math.random() * 1000),
        name: `Loyalty #${Math.floor(Math.random() * 1000)}`,
        tier: 'gold',
        image: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400',
        seller: userWallet,
        price: parseFloat(listPrice),
        listed: true,
        rarity: 'Rare'
      };

      setListings([newListing, ...listings]);
      setListPrice('');
      toast.success('NFT listed for sale!');
    } catch (error) {
      toast.error('Listing error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelListing = async (listingId) => {
    setLoading(true);
    try {
      // In production: Call smart contract cancelListing function
      await new Promise(resolve => setTimeout(resolve, 1500));

      setListings(listings.filter(l => l.id !== listingId));
      toast.success('Listing cancelled');
    } catch (error) {
      toast.error('Cancellation error');
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier) => {
    const colors = {
      bronze: 'from-amber-700 to-amber-500',
      silver: 'from-slate-400 to-slate-300',
      gold: 'from-yellow-500 to-yellow-300',
      platinum: 'from-cyan-400 to-blue-300',
      diamond: 'from-purple-500 to-pink-400'
    };
    return colors[tier] || colors.bronze;
  };

  const getRarityColor = (rarity) => {
    const colors = {
      'Common': 'bg-slate-500/20 text-slate-300 border-slate-500/50',
      'Rare': 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      'Epic': 'bg-purple-500/20 text-purple-300 border-purple-500/50',
      'Legendary': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
    };
    return colors[rarity] || colors['Common'];
  };

  const filteredListings = listings.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userListings = listings.filter(l => l.seller === userWallet);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-slate-800 bg-gradient-to-br from-indigo-900 to-purple-900">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">NFT Marketplace</h2>
              <p className="text-indigo-200">Buy, sell and trade loyalty NFTs</p>
            </div>
            <div className="text-left">
              <p className="text-sm text-indigo-200">Balance</p>
              <p className="text-2xl font-bold text-white">{userBalance.toLocaleString()}</p>
              <p className="text-xs text-indigo-300">tokens</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">NFT Market</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search NFT..."
                  className="pr-10 bg-slate-800 border-slate-700 text-white w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-800">
              <TabsTrigger value="browse">
                <ShoppingBag className="w-4 h-4 ml-2" />
                Browse
              </TabsTrigger>
              <TabsTrigger value="sell">
                <Tag className="w-4 h-4 ml-2" />
                Sell
              </TabsTrigger>
            </TabsList>

            {/* Browse Tab */}
            <TabsContent value="browse" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredListings.map(listing => (
                  <Card key={listing.id} className="border-slate-800 bg-slate-800 overflow-hidden group hover:border-indigo-500 transition-colors">
                    <div className="relative">
                      <img
                        src={listing.image}
                        alt={listing.name}
                        className="w-full h-48 object-cover"
                      />
                      <div className={`absolute top-2 right-2 px-3 py-1 rounded-lg bg-gradient-to-r ${getTierColor(listing.tier)} text-white text-xs font-bold`}>
                        {listing.tier.toUpperCase()}
                      </div>
                      <Badge className={`absolute top-2 left-2 ${getRarityColor(listing.rarity)}`}>
                        {listing.rarity}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-white mb-1">{listing.name}</h3>
                      <p className="text-xs text-slate-400 mb-3">Seller: {listing.seller}</p>

                      <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400">Price</p>
                          <p className="text-xl font-bold text-white">{listing.price.toLocaleString()}</p>
                        </div>
                        <Button
                          onClick={() => handleBuyNFT(listing)}
                          disabled={loading || listing.seller === userWallet}
                          size="sm"
                          className="bg-gradient-to-r from-indigo-500 to-purple-600"
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : listing.seller === userWallet ? (
                            'שלך'
                          ) : (
                            'קנה'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredListings.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No NFTs found</p>
                </div>
              )}
            </TabsContent>

            {/* Sell Tab */}
            <TabsContent value="sell" className="mt-6">
              <div className="space-y-6">
                {/* List NFT Form */}
                <Card className="border-slate-800 bg-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">List NFT for Sale</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300">Price (tokens)</label>
                      <Input
                        type="number"
                        value={listPrice}
                        onChange={(e) => setListPrice(e.target.value)}
                        placeholder="0"
                        className="bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                    <Button
                      onClick={handleListNFT}
                      disabled={loading || !listPrice}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          Listing...
                        </>
                      ) : (
                        <>
                          <Tag className="w-4 h-4 ml-2" />
                          List for Sale
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* User's Listings */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">My Listings</h3>
                  {userListings.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>You have no NFTs for sale</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userListings.map(listing => (
                        <div
                          key={listing.id}
                          className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700"
                        >
                          <img
                            src={listing.image}
                            alt={listing.name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                          <div className="flex-1">
                            <h4 className="font-bold text-white">{listing.name}</h4>
                            <p className="text-sm text-slate-400">Price: {listing.price.toLocaleString()} tokens</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelListing(listing.id)}
                            disabled={loading}
                            className="border-rose-600 text-rose-400 hover:bg-rose-900/20"
                          >
                            Cancel
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}