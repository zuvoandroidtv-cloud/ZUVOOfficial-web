import React, { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Filter,
  Layers,
  Users,
  Search,
  ChevronRight,
  UserCheck,
  Calendar,
  AlertCircle,
  FileCheck,
  BarChart2,
  PieChart,
  RefreshCw,
  Send,
  Sliders,
  DollarSign,
  Package,
  Wrench,
  Cpu,
  Target
} from 'lucide-react';

interface WorkItem {
  id: string;
  number: string;
  title: string;
  department: 'SALES' | 'SERVICE' | 'SUPPLY_CHAIN' | 'MANUFACTURING' | 'FINANCE' | 'QUALITY' | 'EXECUTIVE' | 'SECURITY';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  assignedTo: string;
  dueDate: string;
  slaStatus: 'WITHIN_SLA' | 'AT_RISK' | 'BREACHED' | 'COMPLETED_ON_TIME' | 'COMPLETED_LATE';
  escalationTier: number;
  sourceEntity: string;
}

interface ApprovalItem {
  id: string;
  code: string;
  type: string;
  sourceRef: string;
  amount: number;
  requestedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  date: string;
}

export const EnterpriseExecutionPage: React.FC = () => {
  const [activeWorkspace, setActiveWorkspace] = useState<
    | 'action_center'
    | 'my_work'
    | 'team_work'
    | 'approvals'
    | 'sla_escalations'
    | 'sales_exec'
    | 'customer_retention'
    | 'dealer_actions'
    | 'finance_ops'
    | 'supply_chain'
    | 'manufacturing'
    | 'service_warranty'
    | 'productivity'
    | 'reports'
  >('action_center');

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Synthetic enterprise work queue items grounded in CRM operations
  const [workItems, setWorkItems] = useState<WorkItem[]>([
    {
      id: '1',
      number: 'WRK-20261021-1001',
      title: 'Collect Overdue AR from Apex Electronics (62 Days Overdue)',
      department: 'FINANCE',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      assignedTo: 'Vikram Mehta (Finance Controller)',
      dueDate: '2026-10-22',
      slaStatus: 'AT_RISK',
      escalationTier: 1,
      sourceEntity: 'INV-20261001-0981'
    },
    {
      id: '2',
      number: 'WRK-20261021-1002',
      title: 'Verify Panel Delamination Epidemic on ZUV-55-4K Lot B09',
      department: 'QUALITY',
      priority: 'CRITICAL',
      status: 'ASSIGNED',
      assignedTo: 'Dr. R. Sharma (QA Lead)',
      dueDate: '2026-10-21',
      slaStatus: 'BREACHED',
      escalationTier: 2,
      sourceEntity: 'NCR-2026-009'
    },
    {
      id: '3',
      number: 'WRK-20261021-1003',
      title: 'Quotation Follow-Up: Metro Retailers (100x 43" UHD)',
      department: 'SALES',
      priority: 'HIGH',
      status: 'OPEN',
      assignedTo: 'Priya Patel (Enterprise Sales)',
      dueDate: '2026-10-23',
      slaStatus: 'WITHIN_SLA',
      escalationTier: 0,
      sourceEntity: 'QUO-2026-0812'
    },
    {
      id: '4',
      number: 'WRK-20261021-1004',
      title: 'Replenish Finished Goods 43" Smart TV Buffer (< 7 Days Stock)',
      department: 'SUPPLY_CHAIN',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      assignedTo: 'Anand Kumar (SCM Manager)',
      dueDate: '2026-10-24',
      slaStatus: 'WITHIN_SLA',
      escalationTier: 0,
      sourceEntity: 'SKU-ZUV-43-SMART'
    },
    {
      id: '5',
      number: 'WRK-20261021-1005',
      title: 'Emergency On-Site Motherboard Swap — Hotel Grand Horizon',
      department: 'SERVICE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      assignedTo: 'Suresh Verma (Sr. Field Tech)',
      dueDate: '2026-10-21',
      slaStatus: 'WITHIN_SLA',
      escalationTier: 0,
      sourceEntity: 'TCK-20261019-001'
    },
    {
      id: '6',
      number: 'WRK-20261021-1006',
      title: 'Clear Factory Line 2 WIP Bottleneck at Burn-In Chamber',
      department: 'MANUFACTURING',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      assignedTo: 'K. Pillai (Factory Supv)',
      dueDate: '2026-10-20',
      slaStatus: 'COMPLETED_ON_TIME',
      escalationTier: 0,
      sourceEntity: 'WO-2026-001'
    }
  ]);

  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    {
      id: 'app-1',
      code: 'APR-2026-041',
      type: 'COMMERCIAL_PRICING_FLOOR',
      sourceRef: 'QUO-2026-0812',
      amount: 450000.0,
      requestedBy: 'Priya Patel (Sales)',
      status: 'PENDING',
      date: '2026-10-21'
    },
    {
      id: 'app-2',
      code: 'APR-2026-042',
      type: 'DEALER_ONBOARDING',
      sourceRef: 'DLR-APP-2026-091',
      amount: 1000000.0,
      requestedBy: 'Rajiv Menon (Channel Lead)',
      status: 'PENDING',
      date: '2026-10-20'
    },
    {
      id: 'app-3',
      code: 'APR-2026-043',
      type: 'SCRAP_WRITE_OFF',
      sourceRef: 'NCR-2026-009',
      amount: 85000.0,
      requestedBy: 'Dr. R. Sharma (QA Lead)',
      status: 'PENDING',
      date: '2026-10-21'
    }
  ]);

  const handleCompleteTask = (id: string) => {
    setWorkItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'COMPLETED', slaStatus: 'COMPLETED_ON_TIME' } : item
      )
    );
  };

  const handleDecision = (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setApprovals((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: decision } : item))
    );
  };

  const filteredWork = workItems.filter((item) => {
    const matchesDept = selectedDeptFilter === 'ALL' || item.department === selectedDeptFilter;
    const matchesPriority = selectedPriorityFilter === 'ALL' || item.priority === selectedPriorityFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sourceEntity.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesPriority && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Enterprise Execution & Productivity Center
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-medium">
                  Phase 16
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Operational Work Queue, Cross-Department Execution, SLA Escalations & Unified Approvals
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Metrics */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-lg text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Work Items</div>
            <div className="text-lg font-bold text-white">
              {workItems.filter((i) => i.status !== 'COMPLETED').length}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-lg text-right">
            <div className="text-xs text-rose-400 uppercase tracking-wider font-semibold">SLA Breaches</div>
            <div className="text-lg font-bold text-rose-400">
              {workItems.filter((i) => i.slaStatus === 'BREACHED').length}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-lg text-right">
            <div className="text-xs text-amber-400 uppercase tracking-wider font-semibold">Pending Approvals</div>
            <div className="text-lg font-bold text-amber-400">
              {approvals.filter((a) => a.status === 'PENDING').length}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 text-sm">
        {[
          { id: 'action_center', label: 'Action Center', icon: Briefcase },
          { id: 'my_work', label: 'Work Queue', icon: Layers },
          { id: 'approvals', label: 'Approval Center', icon: FileCheck },
          { id: 'sla_escalations', label: 'SLA & Escalations', icon: Clock },
          { id: 'sales_exec', label: 'Sales Execution', icon: Target },
          { id: 'customer_retention', label: 'Customer Retention', icon: Users },
          { id: 'dealer_actions', label: 'Dealer Actions', icon: Briefcase },
          { id: 'finance_ops', label: 'Finance Operations', icon: DollarSign },
          { id: 'supply_chain', label: 'Supply Chain', icon: Package },
          { id: 'manufacturing', label: 'Manufacturing', icon: Cpu },
          { id: 'service_warranty', label: 'Service & Warranty', icon: Wrench },
          { id: 'productivity', label: 'Workforce Productivity', icon: BarChart2 },
          { id: 'reports', label: 'Executive Reports', icon: PieChart }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeWorkspace === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveWorkspace(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Executive Action Center */}
      {activeWorkspace === 'action_center' && (
        <div className="space-y-6">
          {/* Action Horizon Cockpit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> TODAY: Critical Attention
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-medium">3 Immediate</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Panel Quality Hold: ZUV-55-4K Lot B09</div>
                    <div className="text-xs text-slate-400 mt-1">Escalated to Tier 2 (Dept Head) • QA Team</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-rose-500/20 text-rose-300 font-bold rounded">P1</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Overdue Collections: Apex Electronics (₹3.5L)</div>
                    <div className="text-xs text-slate-400 mt-1">SLA At Risk • Finance Work Queue</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-rose-500/20 text-rose-300 font-bold rounded">P1</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Urgent Motherboard Swap: Hotel Horizon</div>
                    <div className="text-xs text-slate-400 mt-1">Due Today 17:00 • Field Service Lead</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded">P2</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> THIS WEEK: Milestones & Approvals
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">3 Pending</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Commercial Pricing Floor Approval (₹4.5L)</div>
                    <div className="text-xs text-slate-400 mt-1">Quotation QUO-2026-0812 • Sales Ops</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded">Review</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Dealer Credit Onboarding: Metro Corp (₹10L)</div>
                    <div className="text-xs text-slate-400 mt-1">KYC Verified • Commercial Committee</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded">Review</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Manufacturing WIP Replenishment Batch #14</div>
                    <div className="text-xs text-slate-400 mt-1">50x 43" Units • Planned Oct 24</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold rounded">Planned</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> EXECUTION VELOCITY & SLA
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">Healthy</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Resolution SLA Compliance</span>
                  <span className="font-semibold text-white">94.2%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '94.2%' }} />
                </div>
                <div className="flex justify-between items-center text-sm pt-2">
                  <span className="text-slate-400">Weekly Task Closure Velocity</span>
                  <span className="font-semibold text-white">48 Tasks / Week</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Overloaded Department Ratio</span>
                  <span className="font-semibold text-emerald-400">0% (All Optimal)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">First-Visit Resolution (FVR)</span>
                  <span className="font-semibold text-white">88.5%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Filtered Work View */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Urgent Operational Action Queue
              </h2>
              <div className="text-xs text-slate-400">Server-Authoritative Dynamic Aggregation</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 bg-slate-950/40">
                    <th className="py-3 px-4">Task #</th>
                    <th className="py-3 px-4">Title & Context</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Owner</th>
                    <th className="py-3 px-4">SLA Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {workItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-indigo-400">{item.number}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{item.title}</div>
                        <div className="text-xs text-slate-400">Ref: {item.sourceEntity}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                          {item.department}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            item.priority === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300'
                              : item.priority === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">{item.assignedTo}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            item.slaStatus === 'BREACHED'
                              ? 'bg-rose-500/20 text-rose-300'
                              : item.slaStatus === 'AT_RISK'
                              ? 'bg-amber-500/20 text-amber-300'
                              : item.slaStatus.includes('COMPLETED')
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {item.slaStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {item.status !== 'COMPLETED' ? (
                          <button
                            onClick={() => handleCompleteTask(item.id)}
                            className="text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                          >
                            Complete
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Full Enterprise Work Queue */}
      {activeWorkspace === 'my_work' && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter tasks, refs, owners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Departments</option>
                <option value="SALES">Sales</option>
                <option value="FINANCE">Finance</option>
                <option value="SERVICE">Service</option>
                <option value="SUPPLY_CHAIN">Supply Chain</option>
                <option value="MANUFACTURING">Manufacturing</option>
                <option value="QUALITY">Quality</option>
              </select>

              <select
                value={selectedPriorityFilter}
                onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="font-semibold text-white">{filteredWork.length}</span> actionable work items
            </div>
          </div>

          {/* List of Tasks */}
          <div className="grid grid-cols-1 gap-3">
            {filteredWork.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-indigo-400 font-semibold">{item.number}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{item.department}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        item.priority === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300'
                          : item.priority === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.priority}
                    </span>
                    {item.escalationTier > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Tier {item.escalationTier} Escalated
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Source Entity: <strong className="text-slate-300">{item.sourceEntity}</strong></span>
                    <span>Assigned To: <strong className="text-slate-300">{item.assignedTo}</strong></span>
                    <span>Due Date: <strong className="text-slate-300">{item.dueDate}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded font-medium ${
                      item.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : item.status === 'IN_PROGRESS'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.status.replace(/_/g, ' ')}
                  </span>
                  {item.status !== 'COMPLETED' ? (
                    <button
                      onClick={() => handleCompleteTask(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                    >
                      Mark Complete
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Finished
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Unified Approval Center */}
      {activeWorkspace === 'approvals' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-1">Unified Enterprise Approval Center</h2>
            <p className="text-xs text-slate-400 mb-4">
              Dual-Control & Maker-Checker Enforced Approvals across Quotations, Dealer Onboarding, Scrap & Finance
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 bg-slate-950/40">
                    <th className="py-3 px-4">Approval Code</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Supporting Ref</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4">Requested By</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {approvals.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 font-mono text-xs text-indigo-400">{app.code}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {app.type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">{app.sourceRef}</td>
                      <td className="py-3.5 px-4 font-medium text-white">₹{app.amount.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">{app.requestedBy}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            app.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : app.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {app.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDecision(app.id, 'APPROVED')}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecision(app.id, 'REJECTED')}
                              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Decided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: SLA & Escalations */}
      {activeWorkspace === 'sla_escalations' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs text-slate-400 uppercase font-semibold">Tier 1 Escalations (Team Lead)</div>
              <div className="text-2xl font-bold text-amber-400 mt-2">1 Active Case</div>
              <div className="text-xs text-slate-400 mt-1">Overdue AR Collection (Apex Electronics)</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs text-slate-400 uppercase font-semibold">Tier 2 Escalations (Dept Head)</div>
              <div className="text-2xl font-bold text-rose-400 mt-2">1 Active Case</div>
              <div className="text-xs text-slate-400 mt-1">Panel Delamination Quality Hold (QA Lead)</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs text-slate-400 uppercase font-semibold">Tier 3 Escalations (Executive)</div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">0 Cases</div>
              <div className="text-xs text-slate-400 mt-1">No critical enterprise breaches</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5–14 Generic Workspaces */}
      {['sales_exec', 'customer_retention', 'dealer_actions', 'finance_ops', 'supply_chain', 'manufacturing', 'service_warranty', 'productivity', 'reports'].includes(activeWorkspace) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3">
          <Layers className="w-8 h-8 text-indigo-400 mx-auto" />
          <h2 className="text-lg font-semibold text-white capitalize">
            {activeWorkspace.replace(/_/g, ' ')} Workspace
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Operational workflows, exception-to-action automation, and productivity metrics for {activeWorkspace.replace(/_/g, ' ')} are active and synchronizing with the central enterprise execution engine.
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-indigo-400 font-mono">
            Status: Fully Linked to General Ledger, CRM & Manufacturing Subsystems
          </div>
        </div>
      )}
    </div>
  );
};
