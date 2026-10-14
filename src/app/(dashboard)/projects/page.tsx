'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, MoreHorizontal, FileText, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Loader2, AlertTriangle, Eye, FolderKanban, CheckCircle2, Clock, TrendingUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getCached, setCached, invalidateCache, hasCached } from '@/lib/data-cache'

export default function ProjectsPage() {
  const router = useRouter()
  const { isAdmin, isFounder } = useAuth()
  const [projects, setProjects] = useState<any[]>(() => getCached('projects') || [])
  const [payments, setPayments] = useState<any[]>(() => getCached('payments_summary') || [])
  const [expenses, setExpenses] = useState<any[]>(() => getCached('expenses_summary') || [])
  const [loading, setLoading] = useState(() => !hasCached('projects'))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [projectsRes, payRes, expRes] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').order('created_at', { ascending: false }),
      supabase.from('payments').select('project_id, amount'),
      supabase.from('expenses').select('project_id, amount').not('project_id', 'is', null)
    ])

    if (projectsRes.error) toast.error('Failed to load projects')

    if (projectsRes.data) {
      setProjects(projectsRes.data)
      setCached('projects', projectsRes.data)
    }
    if (payRes.data) {
      setPayments(payRes.data)
      setCached('payments_summary', payRes.data)
    }
    if (expRes.data) {
      setExpenses(expRes.data)
      setCached('expenses_summary', expRes.data)
    }
    setLoading(false)
  }
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    if (isFounder || !projectToDelete) return
    setIsDeleting(true)
    try {
      // 1. Delete associated payments
      const { error: payErr } = await supabase
        .from('payments')
        .delete()
        .eq('project_id', projectToDelete.id)

      if (payErr) throw payErr

      // 2. Delete associated expenses
      const { error: expErr } = await supabase
        .from('expenses')
        .delete()
        .eq('project_id', projectToDelete.id)

      if (expErr) throw expErr

      // 3. Delete the project
      const { error: projErr } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id)

      if (projErr) throw projErr

      setProjects(prev => {
        const next = prev.filter(p => p.id !== projectToDelete.id)
        setCached('projects', next)
        return next
      })
      setPayments(prev => prev.filter(p => p.project_id !== projectToDelete.id))
      setExpenses(prev => prev.filter(e => e.project_id !== projectToDelete.id))
      invalidateCache('dashboard')
      invalidateCache('reports')

      toast.success(`Project "${projectToDelete.name}" and connected transactions deleted successfully`)
      setIsDeleteDialogOpen(false)
      setProjectToDelete(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }

  // Default sorting: Newest / Latest projects first!
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'created_at',
    direction: 'desc',
  })

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc'
    } else {
      if (['total_value', 'expensesTotal', 'netProfit', 'received', 'pending', 'created_at'].includes(key)) {
        direction = 'desc'
      }
    }
    setSortConfig({ key, direction })
  }

  const processedProjects = projects.map((project) => {
    const projPayments = payments.filter(p => p.project_id === project.id)
    const projExpenses = expenses.filter(e => e.project_id === project.id)
    const received = projPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const projectExpTotal = projExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const pending = Math.max(0, Number(project.total_value) - received)
    const netProfit = received - projectExpTotal
    const collectionPercent = Number(project.total_value) > 0
      ? Math.min(100, Math.round((received / Number(project.total_value)) * 100))
      : 0
    return {
      ...project,
      received,
      expensesTotal: projectExpTotal,
      pending,
      netProfit,
      collectionPercent,
    }
  })

  // Executive KPI summary metrics
  const totalPipeline = processedProjects.reduce((sum, p) => sum + Number(p.total_value || 0), 0)
  const totalReceived = processedProjects.reduce((sum, p) => sum + p.received, 0)
  const totalExpenses = processedProjects.reduce((sum, p) => sum + p.expensesTotal, 0)
  const totalPending = processedProjects.reduce((sum, p) => sum + p.pending, 0)
  const totalNetProfit = totalReceived - totalExpenses
  const overallCollectionRate = totalPipeline > 0 ? Math.round((totalReceived / totalPipeline) * 100) : 0
  const pendingProjectsCount = processedProjects.filter(p => p.pending > 0).length

  // Live counts for filter tabs
  const countInProgress = processedProjects.filter(p => p.status === 'In Progress').length
  const countPartial = processedProjects.filter(p => p.status === 'Partial Payment').length
  const countFullyPaid = processedProjects.filter(p => p.status === 'Fully Paid').length
  const countCompleted = processedProjects.filter(p => p.status === 'Completed').length
  const countPending = processedProjects.filter(p => p.status === 'Pending').length

  const filterTabs = [
    { id: 'all', label: 'All Projects', count: processedProjects.length },
    { id: 'In Progress', label: 'In Progress', count: countInProgress },
    { id: 'Partial Payment', label: 'Partial', count: countPartial },
    { id: 'Fully Paid', label: 'Fully Paid', count: countFullyPaid },
    { id: 'Completed', label: 'Completed', count: countCompleted },
    { id: 'Pending', label: 'Pending', count: countPending },
  ]

  const filteredAndSortedProjects = processedProjects
    .filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.client_name?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (!sortConfig) return 0
      
      let aVal: any = a[sortConfig.key]
      let bVal: any = b[sortConfig.key]

      if (sortConfig.key === 'client') {
        aVal = a.clients?.name || a.client_name || ''
        bVal = b.clients?.name || b.client_name || ''
      }

      if (aVal === undefined || aVal === null) return 1
      if (bVal === undefined || bVal === null) return -1

      if (sortConfig.key === 'created_at') {
        const aTime = aVal ? new Date(aVal).getTime() : 0
        const bTime = bVal ? new Date(bVal).getTime() : 0
        return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime
      }

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      } else {
        return sortConfig.direction === 'asc'
          ? aVal - bVal
          : bVal - aVal
      }
    })

  const renderSortHeader = (label: string, sortKey: string, className?: string) => {
    const isSorted = sortConfig?.key === sortKey
    const isNumeric = ['total_value', 'expensesTotal', 'netProfit', 'received', 'pending'].includes(sortKey)
    return (
      <TableHead
        className={`${className || ''} cursor-pointer hover:bg-muted/50 transition-colors select-none group py-3`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-1.5 ${isNumeric ? 'justify-end' : 'justify-start'}`}>
          <span>{label}</span>
          <span className="inline-flex">
            {isSorted ? (
              sortConfig?.direction === 'asc' ? (
                <ArrowUp className="h-4 w-4 text-primary" />
              ) : (
                <ArrowDown className="h-4 w-4 text-primary" />
              )
            ) : (
              <ArrowUpDown className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        </div>
      </TableHead>
    )
  }

  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isFounder || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)

      const newProject = {
        name: formData.get('name') as string,
        client_name: formData.get('client_name') as string,
        project_type: (formData.get('project_type') as string) || 'Website & Software Development',
        total_value: Number(formData.get('total_value')),
        due_date: formData.get('due_date') as string,
        status: 'Pending',
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([newProject])
        .select('*, clients(name)')

      if (error) {
        toast.error(error.message)
      } else if (data) {
        const updated = [data[0], ...projects]
        setProjects(updated)
        setCached('projects', updated)
        invalidateCache('dashboard')
        invalidateCache('reports')
        setIsDialogOpen(false)
        toast.success('Project created successfully')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Fully Paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Fully Paid
          </span>
        )
      case 'Partial Payment':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Partial
          </span>
        )
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            Completed
          </span>
        )
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            In Progress
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
            Pending
          </span>
        )
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Track ongoing work, project values, and payment collections.</p>
        </div>

        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button onClick={() => setIsDialogOpen(true)} className="cursor-pointer" />}>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Set up a new project and assign it to a client.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddProject}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input id="name" name="name" required placeholder="e.g. Website Redesign" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="client_name">Client Name</Label>
                    <Input id="client_name" name="client_name" required placeholder="e.g. Afnan Teex Clothing" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="project_type">Project Type</Label>
                    <Input id="project_type" name="project_type" placeholder="e.g. E-Commerce Development" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="total_value">Total Value (₹)</Label>
                    <Input id="total_value" name="total_value" type="number" required placeholder="60000" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input id="due_date" name="due_date" type="date" required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                      </>
                    ) : (
                      'Create Project'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Top Executive KPI Cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Pipeline</CardTitle>
              <FolderKanban className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalPipeline.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{projects.length} Total Projects</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Received</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{totalReceived.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium text-emerald-500">{overallCollectionRate}% collected</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Balance</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">₹{totalPending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{pendingProjectsCount} awaiting payment</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Realized Net Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                ₹{totalNetProfit.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">After ₹{totalExpenses.toLocaleString()} expenses</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Segmented Filter Pills & Search */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Modern Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 lg:pb-0 scrollbar-none">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Clean Search Input with Clear Button */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects or clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <h3 className="text-xl font-semibold">Loading projects...</h3>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <div className="relative w-48 h-48 mb-4 opacity-80">
            <Image src="/empty-state.png" alt="No projects" fill className="object-contain" />
          </div>
          <h3 className="text-xl font-semibold">No projects yet</h3>
          <p className="text-muted-foreground mt-2 max-w-sm">Create your first project to start tracking work and payments.</p>
          {isAdmin && (
            <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {renderSortHeader('Project Name', 'name')}
                {renderSortHeader('Client', 'client')}
                {renderSortHeader('Created Date', 'created_at')}
                {renderSortHeader('Total Value', 'total_value', 'text-right')}
                {renderSortHeader('Expenses', 'expensesTotal', 'text-right')}
                {renderSortHeader('Net Profit', 'netProfit', 'text-right')}
                {renderSortHeader('Received', 'received', 'text-right')}
                {renderSortHeader('Pending', 'pending', 'text-right')}
                {renderSortHeader('Status', 'status')}
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No projects match your search or filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedProjects.map((project) => {
                  const received = project.received
                  const projectExpTotal = project.expensesTotal
                  const pending = project.pending
                  const netProfit = project.netProfit
                  const percent = project.collectionPercent
                  return (
                    <TableRow 
                      key={project.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm group-hover:text-primary transition-colors block">
                              {project.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground block md:hidden">
                              {project.client_name || project.clients?.name}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{project.client_name || project.clients?.name}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                        {new Date(project.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-right font-medium">₹{Number(project.total_value).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive text-xs">₹{projectExpTotal.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-bold ${netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        ₹{netProfit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold text-primary">₹{received.toLocaleString()}</div>
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                percent === 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-primary' : 'bg-transparent'
                              }`} 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums font-medium">{percent}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">
                        ₹{pending.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer" />}>
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)} className="cursor-pointer">
                                  Record Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                  onClick={() => {
                                    setProjectToDelete(project)
                                    setIsDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Project
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        if (!isDeleting) {
          setIsDeleteDialogOpen(open)
          if (!open) setProjectToDelete(null)
        }
      }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80">
              Are you sure you want to delete <strong className="text-foreground font-semibold">"{projectToDelete?.name}"</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 px-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm space-y-2">
            <p className="font-medium text-destructive">This action will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground pl-1">
              <li>The project profile and details</li>
              <li>All linked payment history (Received: <span className="font-semibold text-foreground">₹{projectToDelete?.received?.toLocaleString() || 0}</span>)</li>
              <li>All associated project expenses (Expenses: <span className="font-semibold text-foreground">₹{projectToDelete?.expensesTotal?.toLocaleString() || 0}</span>)</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">
              All financial dashboards, overview totals, and transaction records will automatically update. This action cannot be undone.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setProjectToDelete(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting Project...
                </>
              ) : (
                'Delete Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
