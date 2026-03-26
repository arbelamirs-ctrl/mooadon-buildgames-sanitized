import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserPermissions } from '@/components/auth/useUserPermissions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  AlertCircle,
  Plus,
  Minus,
  Lock,
  Unlock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CashPoolManagement() {
  const { primaryCompanyId } = useUserPermissions();
  const queryClient = useQueryClient();
  const [selectedPool, setSelectedPool] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: pools = [] } = useQuery({
    queryKey: ['cashPools', primaryCompanyId],
    queryFn: () => base44.entities.CashPool.filter({ company_id: primaryCompanyId }),
    enabled: !!primaryCompanyId
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['cashSessions', selectedPool?.id],
    queryFn: () => base44.entities.CashPoolSession.filter({ cash_pool_id: selectedPool.id }, '-created_date', 50),
    enabled: !!selectedPool
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['cashMovements', selectedPool?.id],
    queryFn: () => base44.entities.CashMovement.filter({ cash_pool_id: selectedPool.id }, '-created_date', 100),
    enabled: !!selectedPool,
    refetchInterval: 5000
  });

  const activeSession = sessions.find(s => s.status === 'open');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cash Pool Management</h1>
          <p className="text-[#9ca3af] text-sm">Shared cash drawer for multiple terminals</p>
        </div>
        <CreatePoolDialog companyId={primaryCompanyId} />
      </div>

      {/* Pool Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {pools.map(pool => (
          <Button
            key={pool.id}
            variant={selectedPool?.id === pool.id ? 'default' : 'outline'}
            onClick={() => setSelectedPool(pool)}
            className={selectedPool?.id === pool.id ? 'bg-[#10b981]' : 'border-[#2d2d3a]'}
          >
            {pool.name}
            <Badge className="ml-2 bg-white/20">${pool.current_balance?.toFixed(2) || '0.00'}</Badge>
          </Button>
        ))}
      </div>

      {selectedPool && (
        <>
          {/* Current Session Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#9ca3af] text-xs mb-1">Current Balance</p>
                    <p className="text-2xl font-bold text-white">
                      ${selectedPool.current_balance?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-[#10b981]" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1f2128] border-[#2d2d3a]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#9ca3af] text-xs mb-1">Session Status</p>
                    <Badge className={activeSession ? 'bg-[#10b981]' : 'bg-gray-500'}>
                      {activeSession ? (
                        <><Unlock className="w-3 h-3 mr-1" /> Open</>
                      ) : (
                        <><Lock className="w-3 h-3 mr-1" /> Closed</>
                      )}
                    </Badge>
                  </div>
                  <Clock className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            {activeSession && (
              <>
                <Card className="bg-[#1f2128] border-[#2d2d3a]">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#9ca3af] text-xs mb-1">Opening Balance</p>
                        <p className="text-xl font-bold text-white">
                          ${activeSession.opening_balance?.toFixed(2)}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1f2128] border-[#2d2d3a]">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#9ca3af] text-xs mb-1">Movements</p>
                        <p className="text-xl font-bold text-white">
                          {movements.filter(m => m.session_id === activeSession.id).length}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-purple-400" />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Session Controls */}
          <Card className="bg-[#1f2128] border-[#2d2d3a]">
            <CardHeader className="border-b border-[#2d2d3a]">
              <CardTitle className="text-white text-sm">Session Controls</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {activeSession ? (
                <div className="flex items-center gap-3">
                  <RecordMovementDialog 
                    poolId={selectedPool.id} 
                    sessionId={activeSession.id}
                    companyId={primaryCompanyId}
                    userId={user?.id}
                    userEmail={user?.email}
                  />
                  <CloseSessionDialog
                    session={activeSession}
                    pool={selectedPool}
                    movements={movements.filter(m => m.session_id === activeSession.id)}
                  />
                </div>
              ) : (
                <OpenSessionDialog
                  pool={selectedPool}
                  companyId={primaryCompanyId}
                  userId={user?.id}
                  userEmail={user?.email}
                />
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="movements">
            <TabsList className="bg-[#1f2128] border border-[#2d2d3a]">
              <TabsTrigger value="movements">Recent Movements</TabsTrigger>
              <TabsTrigger value="sessions">Session History</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="movements">
              <Card className="bg-[#1f2128] border-[#2d2d3a]">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#2d2d3a]">
                    {movements.slice(0, 20).map(movement => (
                      <div key={movement.id} className="p-4 hover:bg-[#17171f] transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              movement.amount > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}>
                              {movement.amount > 0 ? (
                                <TrendingUp className="w-5 h-5 text-green-400" />
                              ) : (
                                <TrendingDown className="w-5 h-5 text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">
                                {movement.movement_type.replace(/_/g, ' ').toUpperCase()}
                              </p>
                              <p className="text-[#9ca3af] text-xs">
                                {movement.user_email} • {format(new Date(movement.created_date), 'MMM d, h:mm a')}
                              </p>
                              {movement.reason && (
                                <p className="text-[#9ca3af] text-xs mt-1">{movement.reason}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${movement.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {movement.amount > 0 ? '+' : ''}${Math.abs(movement.amount).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions">
              <Card className="bg-[#1f2128] border-[#2d2d3a]">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#2d2d3a]">
                    {sessions.map(session => (
                      <div key={session.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-white font-medium">
                              {format(new Date(session.session_date), 'MMM d, yyyy')}
                            </p>
                            <p className="text-[#9ca3af] text-xs">
                              Opened by {session.opened_by}
                            </p>
                          </div>
                          <Badge className={session.status === 'open' ? 'bg-[#10b981]' : 'bg-gray-500'}>
                            {session.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-3">
                          <div>
                            <p className="text-[#9ca3af] text-xs">Opening</p>
                            <p className="text-white font-medium">${session.opening_balance?.toFixed(2)}</p>
                          </div>
                          {session.status === 'closed' && (
                            <>
                              <div>
                                <p className="text-[#9ca3af] text-xs">Closing</p>
                                <p className="text-white font-medium">${session.closing_balance?.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-[#9ca3af] text-xs">Expected</p>
                                <p className="text-white font-medium">${session.expected_balance?.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-[#9ca3af] text-xs">Variance</p>
                                <p className={`font-medium ${
                                  Math.abs(session.variance || 0) < 1 ? 'text-green-400' : 'text-orange-400'
                                }`}>
                                  ${session.variance?.toFixed(2)}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <ReportsTab pool={selectedPool} movements={movements} sessions={sessions} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function CreatePoolDialog({ companyId }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const queryClient = useQueryClient();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', companyId],
    queryFn: () => base44.entities.Branch.filter({ company_id: companyId }),
    enabled: !!companyId
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CashPool.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cashPools']);
      setOpen(false);
      setName('');
      toast.success('Cash pool created');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#10b981] hover:bg-[#059669]">
          <Plus className="w-4 h-4 mr-2" />
          New Pool
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
        <DialogHeader>
          <DialogTitle className="text-white">Create Cash Pool</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-white">Pool Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main Register"
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>
          <div>
            <Label className="text-white">Branch</Label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 bg-[#17171f] border border-[#2d2d3a] rounded-lg text-white"
            >
              <option value="">Select branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => createMutation.mutate({ company_id: companyId, branch_id: branchId, name })}
            disabled={!name || !branchId}
            className="w-full bg-[#10b981]"
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OpenSessionDialog({ pool, companyId, userId, userEmail }) {
  const [open, setOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const queryClient = useQueryClient();

  const openMutation = useMutation({
    mutationFn: async (data) => {
      const session = await base44.entities.CashPoolSession.create(data);
      await base44.entities.CashMovement.create({
        company_id: companyId,
        cash_pool_id: pool.id,
        session_id: session.id,
        user_id: userId,
        user_email: userEmail,
        movement_type: 'opening',
        amount: parseFloat(openingBalance),
        reason: 'Session opened'
      });
      await base44.entities.CashPool.update(pool.id, { current_balance: parseFloat(openingBalance) });
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cashSessions']);
      queryClient.invalidateQueries(['cashPools']);
      queryClient.invalidateQueries(['cashMovements']);
      setOpen(false);
      toast.success('Session opened');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#10b981]">
          <Unlock className="w-4 h-4 mr-2" />
          Open Session
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
        <DialogHeader>
          <DialogTitle className="text-white">Open Cash Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-white">Opening Balance</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>
          <Button
            onClick={() => openMutation.mutate({
              company_id: companyId,
              cash_pool_id: pool.id,
              session_date: format(new Date(), 'yyyy-MM-dd'),
              opening_balance: parseFloat(openingBalance),
              opened_by: userEmail,
              opened_at: new Date().toISOString()
            })}
            disabled={!openingBalance}
            className="w-full bg-[#10b981]"
          >
            Open Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CloseSessionDialog({ session, pool, movements }) {
  const [open, setOpen] = useState(false);
  const [closingBalance, setClosingBalance] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const sessionMovements = movements.filter(m => m.session_id === session.id);
  const expectedBalance = session.opening_balance + sessionMovements.reduce((sum, m) => sum + m.amount, 0);

  const closeMutation = useMutation({
    mutationFn: async () => {
      const counted = parseFloat(closingBalance);
      const variance = counted - expectedBalance;
      
      await base44.entities.CashPoolSession.update(session.id, {
        closing_balance: counted,
        expected_balance: expectedBalance,
        variance: variance,
        closed_by: user?.email,
        closed_at: new Date().toISOString(),
        status: 'closed',
        notes
      });
      
      await base44.entities.CashPool.update(pool.id, { current_balance: counted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cashSessions']);
      queryClient.invalidateQueries(['cashPools']);
      setOpen(false);
      toast.success('Session closed');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#2d2d3a]">
          <Lock className="w-4 h-4 mr-2" />
          Close Session
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
        <DialogHeader>
          <DialogTitle className="text-white">Close Cash Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
              <p className="text-[#9ca3af] text-xs">Opening</p>
              <p className="text-white font-bold">${session.opening_balance?.toFixed(2)}</p>
            </div>
            <div className="bg-[#17171f] border border-[#2d2d3a] rounded-lg p-3">
              <p className="text-[#9ca3af] text-xs">Expected</p>
              <p className="text-white font-bold">${expectedBalance.toFixed(2)}</p>
            </div>
          </div>
          
          <div>
            <Label className="text-white">Count Actual Cash</Label>
            <Input
              type="number"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              placeholder="0.00"
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>

          {closingBalance && (
            <div className={`p-3 rounded-lg border ${
              Math.abs(parseFloat(closingBalance) - expectedBalance) < 1
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-orange-500/10 border-orange-500/30'
            }`}>
              <p className="text-xs text-white">Variance</p>
              <p className="text-lg font-bold text-white">
                ${(parseFloat(closingBalance) - expectedBalance).toFixed(2)}
              </p>
            </div>
          )}

          <div>
            <Label className="text-white">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this session..."
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>

          <Button
            onClick={() => closeMutation.mutate()}
            disabled={!closingBalance}
            className="w-full bg-[#10b981]"
          >
            Close Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordMovementDialog({ poolId, sessionId, companyId, userId, userEmail }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('cash_in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const recordMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.CashMovement.create(data);
      
      const pool = await base44.entities.CashPool.filter({ id: poolId });
      if (pool[0]) {
        const newBalance = pool[0].current_balance + (data.movement_type === 'cash_out' ? -data.amount : data.amount);
        await base44.entities.CashPool.update(poolId, { current_balance: newBalance });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cashMovements']);
      queryClient.invalidateQueries(['cashPools']);
      setOpen(false);
      setAmount('');
      setReason('');
      toast.success('Movement recorded');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-500 hover:bg-blue-600">
          <DollarSign className="w-4 h-4 mr-2" />
          Record Movement
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1f2128] border-[#2d2d3a]">
        <DialogHeader>
          <DialogTitle className="text-white">Record Cash Movement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-white">Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-[#17171f] border border-[#2d2d3a] rounded-lg text-white"
            >
              <option value="cash_in">Cash In</option>
              <option value="cash_out">Cash Out</option>
              <option value="change_given">Change Given</option>
              <option value="manual_adjustment">Manual Adjustment</option>
            </select>
          </div>
          
          <div>
            <Label className="text-white">Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>

          <div>
            <Label className="text-white">Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Bank deposit, Safe drop"
              className="bg-[#17171f] border-[#2d2d3a] text-white"
            />
          </div>

          <Button
            onClick={() => recordMutation.mutate({
              company_id: companyId,
              cash_pool_id: poolId,
              session_id: sessionId,
              user_id: userId,
              user_email: userEmail,
              movement_type: type,
              amount: parseFloat(amount),
              reason
            })}
            disabled={!amount}
            className="w-full bg-[#10b981]"
          >
            Record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportsTab({ pool, movements, sessions }) {
  const byUser = movements.reduce((acc, m) => {
    const key = m.user_email || 'Unknown';
    if (!acc[key]) acc[key] = { total: 0, count: 0, movements: [] };
    acc[key].total += m.amount;
    acc[key].count++;
    acc[key].movements.push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card className="bg-[#1f2128] border-[#2d2d3a]">
        <CardHeader className="border-b border-[#2d2d3a]">
          <CardTitle className="text-white text-sm">By User</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[#2d2d3a]">
            {Object.entries(byUser).map(([email, data]) => (
              <div key={email} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{email}</p>
                    <p className="text-[#9ca3af] text-xs">{data.count} movements</p>
                  </div>
                  <p className={`font-bold ${data.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.total >= 0 ? '+' : ''}${data.total.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}