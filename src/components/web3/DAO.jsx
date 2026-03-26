import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Vote, 
  ThumbsUp, 
  ThumbsDown, 
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  Lightbulb,
  Crown,
  Star,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Shield,
  ArrowRightLeft,
  Send
} from 'lucide-react';
import { toast } from "sonner";
import DAOTreasury from './DAOTreasury';

// Voting power tiers
const VOTING_TIERS = [
  { name: 'Member', minTokens: 0, multiplier: 1, icon: Users },
  { name: 'Active', minTokens: 1000, multiplier: 1.5, icon: Star },
  { name: 'Leader', minTokens: 5000, multiplier: 2, icon: Crown },
  { name: 'VIP', minTokens: 10000, multiplier: 3, icon: Crown }
];

// Mock proposals
const MOCK_PROPOSALS = [
  {
    id: 1,
    title: 'Increase Staking APY to 15%',
    description: 'Proposal to increase annual yield on staking from 12% to 15% to attract more users',
    proposer: '0x1234...5678',
    status: 'active',
    votesFor: 15000,
    votesAgainst: 3000,
    totalVotes: 18000,
    quorum: 20000,
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    createdDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    treasuryAllocation: 10000,
    requiresMultiSig: true,
    approvalsReceived: 2,
    approvalsRequired: 3
  }
];

export default function DAO({ client, company }) {
  const [proposals, setProposals] = useState(MOCK_PROPOSALS);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [delegateDialogOpen, setDelegateDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [expandedProposals, setExpandedProposals] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('proposals');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    treasuryAmount: 0
  });
  const [newComment, setNewComment] = useState('');
  const [delegateAddress, setDelegateAddress] = useState('');

  const queryClient = useQueryClient();
  const companyId = company?.id;

  const { data: templates = [] } = useQuery({
    queryKey: ['proposal-templates', companyId],
    queryFn: () => base44.entities.ProposalTemplate.filter({ company_id: companyId }),
    enabled: !!companyId,
    initialData: [
      { id: '1', name: 'Create Reward', category: 'reward_creation', default_fields: { points: 1000, rarity: 'rare' } },
      { id: '2', name: 'Setup Campaign', category: 'campaign_setup', default_fields: { duration: 7, multiplier: 2 } },
      { id: '3', name: 'Treasury Allocation', category: 'treasury_allocation', default_fields: { amount: 5000 } }
    ]
  });

  const { data: discussions = [] } = useQuery({
    queryKey: ['discussions', selectedProposal?.id],
    queryFn: () => base44.entities.ProposalDiscussion.filter({ 
      company_id: companyId,
      proposal_id: selectedProposal?.id 
    }),
    enabled: !!selectedProposal?.id && !!companyId,
    initialData: []
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ['delegations', client?.id],
    queryFn: () => base44.entities.VoteDelegation.filter({ 
      company_id: companyId,
      delegator_id: client?.id 
    }),
    enabled: !!client?.id && !!companyId,
    initialData: []
  });

  const baseVotingPower = client?.current_balance || 0;
  const delegatedPower = delegations.reduce((sum, d) => sum + (d.is_active ? d.voting_power : 0), 0);
  
  const getTier = (tokens) => {
    return [...VOTING_TIERS].reverse().find(tier => tokens >= tier.minTokens) || VOTING_TIERS[0];
  };
  
  const userTier = getTier(baseVotingPower);
  const votingPower = Math.floor((baseVotingPower - delegatedPower) * userTier.multiplier);
  const TierIcon = userTier.icon;

  const postCommentMutation = useMutation({
    mutationFn: (data) => base44.entities.ProposalDiscussion.create({
      company_id: companyId,
      proposal_id: selectedProposal.id,
      author_id: client.id,
      author_name: client.full_name || 'Anonymous',
      content: data.content
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['discussions']);
      setNewComment('');
      toast.success('Comment posted!');
    }
  });

  const delegateVoteMutation = useMutation({
    mutationFn: (data) => base44.entities.VoteDelegation.create({
      company_id: companyId,
      delegator_id: client.id,
      delegate_id: data.delegate_id,
      voting_power: data.voting_power,
      delegation_type: 'full'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['delegations']);
      setDelegateDialogOpen(false);
      toast.success('Voting power delegated!');
    }
  });

  const handleVote = async (proposalId, support) => {
    if (votingPower === 0) {
      toast.error('No voting power (0 tokens)');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      setProposals(proposals.map(p => {
        if (p.id === proposalId) {
          return {
            ...p,
            votesFor: support ? p.votesFor + votingPower : p.votesFor,
            votesAgainst: !support ? p.votesAgainst + votingPower : p.votesAgainst,
            totalVotes: p.totalVotes + votingPower
          };
        }
        return p;
      }));

      toast.success(`Voted ${support ? 'for' : 'against'} successfully!`);
    } catch (error) {
      toast.error('Voting error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposal.title || !newProposal.description) {
      toast.error('Fill all fields');
      return;
    }

    if (baseVotingPower < 1000) {
      toast.error('Minimum 1,000 tokens required to create proposal');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const proposal = {
        id: proposals.length + 1,
        title: newProposal.title,
        description: newProposal.description,
        proposer: client?.wallet_address || '0x...',
        status: 'active',
        votesFor: 0,
        votesAgainst: 0,
        totalVotes: 0,
        quorum: 20000,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdDate: new Date(),
        treasuryAllocation: parseFloat(newProposal.treasuryAmount) || 0,
        requiresMultiSig: parseFloat(newProposal.treasuryAmount) > 5000,
        approvalsReceived: 0,
        approvalsRequired: 3
      };

      setProposals([proposal, ...proposals]);
      setCreateDialogOpen(false);
      setNewProposal({ title: '', description: '', treasuryAmount: 0 });
      toast.success('Proposal created!');
    } catch (error) {
      toast.error('Creation error');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setNewProposal({
        title: `[${template.category}] `,
        description: `Using template: ${template.name}`,
        treasuryAmount: template.default_fields?.amount || 0
      });
    }
  };

  const handleMultiSigApproval = async (proposalId) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      setProposals(proposals.map(p => {
        if (p.id === proposalId) {
          return { ...p, approvalsReceived: p.approvalsReceived + 1 };
        }
        return p;
      }));

      toast.success('Approval signed!');
    } catch (error) {
      toast.error('Approval error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (proposal) => {
    if (proposal.status === 'passed') {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Passed</Badge>;
    }
    if (proposal.status === 'rejected') {
      return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/50">Rejected</Badge>;
    }
    if (new Date(proposal.endDate) < new Date()) {
      return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/50">Ended</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Active</Badge>;
  };

  const calculateProgress = (proposal) => {
    return (proposal.totalVotes / proposal.quorum) * 100;
  };

  const getTimeRemaining = (endDate) => {
    const diff = new Date(endDate) - new Date();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days} days`;
    if (hours > 0) return `${hours} hours`;
    return 'less than 1 hour';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-slate-800 bg-gradient-to-br from-purple-900 to-indigo-900">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">DAO - Community Governance</h2>
              <p className="text-purple-200">Participate in platform decisions</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeView === 'proposals' ? 'default' : 'outline'}
                onClick={() => setActiveView('proposals')}
                className={activeView === 'proposals' ? 'bg-white text-purple-900' : 'border-white text-white'}
              >
                Proposals
              </Button>
              <Button
                variant={activeView === 'treasury' ? 'default' : 'outline'}
                onClick={() => setActiveView('treasury')}
                className={activeView === 'treasury' ? 'bg-white text-purple-900' : 'border-white text-white'}
              >
                Treasury
              </Button>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-purple-900 hover:bg-purple-50">
                    <Plus className="w-4 h-4 mr-2" />
                    New Proposal
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Proposal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Template (Optional)</label>
                      <Select value={selectedTemplate} onValueChange={(value) => {
                        setSelectedTemplate(value);
                        applyTemplate(value);
                      }}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        value={newProposal.title}
                        onChange={(e) => setNewProposal({...newProposal, title: e.target.value})}
                        placeholder="Brief proposal description"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Detailed Description</label>
                      <Textarea
                        value={newProposal.description}
                        onChange={(e) => setNewProposal({...newProposal, description: e.target.value})}
                        placeholder="Explain your proposal..."
                        rows={4}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Treasury Budget (Optional)</label>
                      <Input
                        type="number"
                        value={newProposal.treasuryAmount}
                        onChange={(e) => setNewProposal({...newProposal, treasuryAmount: e.target.value})}
                        placeholder="0"
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                      {parseFloat(newProposal.treasuryAmount) > 5000 && (
                        <p className="text-xs text-amber-400">⚠️ Requires multi-sig approval (3 signatures)</p>
                      )}
                    </div>
                    <Button
                      onClick={handleCreateProposal}
                      disabled={loading || baseVotingPower < 1000}
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-600"
                    >
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />}
                      Create Proposal
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-2 text-purple-100">
              <TierIcon className="w-5 h-5" />
              <span className="text-sm">
                Tier: <strong>{userTier.name}</strong> (x{userTier.multiplier})
              </span>
            </div>
            <div className="flex items-center gap-2 text-purple-100">
              <Vote className="w-5 h-5" />
              <span className="text-sm">
                Voting Power: <strong>{votingPower.toLocaleString()}</strong> tokens
              </span>
            </div>
            {delegatedPower > 0 && (
              <Badge className="bg-amber-500/20 text-amber-300">
                {delegatedPower.toLocaleString()} delegated
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDelegateDialogOpen(true)}
              className="border-purple-400 text-purple-300"
            >
              <ArrowRightLeft className="w-3 h-3 mr-1" />
              Delegate Votes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delegation Dialog */}
      <Dialog open={delegateDialogOpen} onOpenChange={setDelegateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delegate Voting Power</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Delegate Address</label>
              <Input
                value={delegateAddress}
                onChange={(e) => setDelegateAddress(e.target.value)}
                placeholder="0x..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <p className="text-sm text-slate-400">
              You have <strong>{votingPower.toLocaleString()}</strong> voting power available to delegate
            </p>
            <Button
              onClick={() => delegateVoteMutation.mutate({
                delegate_id: delegateAddress,
                voting_power: votingPower
              })}
              disabled={!delegateAddress || delegateVoteMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600"
            >
              Delegate All Votes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Treasury View */}
      {activeView === 'treasury' && <DAOTreasury />}

      {/* Proposals List */}
      {activeView === 'proposals' && (
        <div className="space-y-4">
          {proposals.map(proposal => {
            const supportPercentage = proposal.totalVotes > 0 
              ? (proposal.votesFor / proposal.totalVotes) * 100 
              : 0;
            
            return (
              <Card key={proposal.id} className="border-slate-800 bg-slate-900">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(proposal)}
                        <span className="text-xs text-slate-500">#{proposal.id}</span>
                        {proposal.requiresMultiSig && (
                          <Badge className="bg-amber-500/20 text-amber-300">
                            <Shield className="w-3 h-3 mr-1" />
                            Multi-Sig
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl text-white">{proposal.title}</CardTitle>
                      <p className="text-sm text-slate-400 mt-2">{proposal.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Voting Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">For ({supportPercentage.toFixed(1)}%)</span>
                      <span className="text-slate-400">Against ({(100 - supportPercentage).toFixed(1)}%)</span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all"
                        style={{ width: `${supportPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Multi-Sig Approvals */}
                  {proposal.requiresMultiSig && (
                    <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-400" />
                          <span className="text-sm text-amber-300">
                            Multi-Sig: {proposal.approvalsReceived}/{proposal.approvalsRequired} approvals
                          </span>
                        </div>
                        {proposal.approvalsReceived < proposal.approvalsRequired && (
                          <Button
                            size="sm"
                            onClick={() => handleMultiSigApproval(proposal.id)}
                            disabled={loading}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            Sign
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Discussion Forum */}
                  <Tabs defaultValue="info">
                    <TabsList className="bg-slate-800">
                      <TabsTrigger value="info">Info</TabsTrigger>
                      <TabsTrigger value="discussion">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Discussion ({discussions.length})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="info" className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Participation</span>
                        <span className="text-slate-300">
                          {proposal.totalVotes.toLocaleString()} / {proposal.quorum.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={calculateProgress(proposal)} className="h-1 bg-slate-800" />
                    </TabsContent>
                    <TabsContent value="discussion" className="space-y-3">
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {discussions.map(comment => (
                          <div key={comment.id} className="p-3 bg-slate-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white">{comment.author_name}</span>
                              <span className="text-xs text-slate-500">
                                {new Date(comment.created_date).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-300">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="bg-slate-800 border-slate-700 text-white"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && newComment.trim()) {
                              setSelectedProposal(proposal);
                              postCommentMutation.mutate({ content: newComment });
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedProposal(proposal);
                            postCommentMutation.mutate({ content: newComment });
                          }}
                          disabled={!newComment.trim()}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {proposal.status === 'active' ? (
                        <span>{getTimeRemaining(proposal.endDate)} remaining</span>
                      ) : (
                        <span>Ended</span>
                      )}
                    </div>

                    {proposal.status === 'active' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleVote(proposal.id, true)}
                          disabled={loading}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          For
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVote(proposal.id, false)}
                          disabled={loading}
                          className="border-rose-600 text-rose-400"
                        >
                          <ThumbsDown className="w-3 h-3 mr-1" />
                          Against
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}