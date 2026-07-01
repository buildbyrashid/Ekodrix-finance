'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Image from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [projectsRes, clientsRes, payRes, expRes] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name', { ascending: true }),
      supabase.from('payments').select('project_id, amount'),
      supabase.from('expenses').select('project_id, amount').not('project_id', 'is', null)
    ])

    if (projectsRes.error) toast.error('Failed to load projects')
    if (clientsRes.error) toast.error('Failed to load clients')

    setProjects(projectsRes.data || [])
    setClients(clientsRes.data || [])
    setPayments(payRes.data || [])
    setExpenses(expRes.data || [])
    setLoading(false)
  }
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'pending',
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
    const pending = Number(project.total_value) - received
    const netProfit = Number(project.total_value) - projectExpTotal
    return {
      ...project,
      received,
      expensesTotal: projectExpTotal,
      pending,
      netProfit,
    }
  })

  const filteredAndSortedProjects = processedProjects
    .filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.clients?.name?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (!sortConfig) return 0
      
      let aVal: any = a[sortConfig.key]
      let bVal: any = b[sortConfig.key]

      if (sortConfig.key === 'client') {
        aVal = a.clients?.name || ''
        bVal = b.clients?.name || ''
      }

      if (aVal === undefined || aVal === null) return 1
      if (bVal === undefined || bVal === null) return -1

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
    const formData = new FormData(e.currentTarget)

    const newProject = {
      name: formData.get('name') as string,
      client_id: formData.get('client') as string,
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
      setProjects([data[0], ...projects])
      setIsDialogOpen(false)
      toast.success('Project created successfully')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Fully Paid': return <Badge className="bg-primary hover:bg-primary/80">Fully Paid</Badge>
      case 'Partial Payment': return <Badge variant="secondary" className="bg-accent text-accent-foreground hover:bg-accent/80">Partial</Badge>
      case 'Completed': return <Badge variant="outline" className="text-primary border-primary">Completed</Badge>
      case 'In Progress': return <Badge variant="secondary">In Progress</Badge>
      default: return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Track ongoing work, project values, and payment statuses.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
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
                  <Label htmlFor="client">Client</Label>
                  <Select name="client" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Button type="submit">Create Project</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center space-x-2 w-full sm:max-w-sm">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search projects or clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Partial Payment">Partial</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Fully Paid">Fully Paid</SelectItem>
          </SelectContent>
        </Select>
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
          <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Project
          </Button>
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
                  return (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {project.name}
                        </div>
                      </TableCell>
                      <TableCell>{project.clients?.name}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(project.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-right font-medium">₹{Number(project.total_value).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive">₹{projectExpTotal.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-primary">₹{netProfit.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-primary">₹{received.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive">₹{pending.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Record Payment</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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
    </div>
  )
}
