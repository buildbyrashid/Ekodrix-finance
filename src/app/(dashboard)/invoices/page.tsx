'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal, FileText, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Loader2, AlertTriangle, Eye, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    let projData: any[] = []
    const projRes = await supabase.from('projects').select('id, name, client_name, clients(name)').order('name', { ascending: true })
    if (projRes.data) projData = projRes.data

    let invData: any[] = []
    const invRes = await supabase.from('invoices').select('*, projects(name, client_name, clients(name))').order('created_at', { ascending: false })
    if (invRes.data) invData = invRes.data

    let payData: any[] = []
    const payRes = await supabase.from('payments').select('invoice_id, amount').not('invoice_id', 'is', null)
    if (payRes.data) payData = payRes.data

    setInvoices(invData)
    setProjects(projData)
    setPayments(payData)
    setLoading(false)
  }

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const projId = formData.get('project_id') as string
    const selProj = projects.find(p => p.id === projId)
    const clientName = selProj?.client_name || selProj?.clients?.name || ''

    // Generate Invoice Number EK-YYYY-XXX
    const currentYear = new Date().getFullYear()
    const invCount = invoices.length + 1
    const invoiceNumber = `EK-${currentYear}-${String(invCount).padStart(3, '0')}`

    const newInvoice = {
      project_id: projId,
      client_name: clientName,
      invoice_number: invoiceNumber,
      invoice_date: formData.get('invoice_date') as string,
      due_date: formData.get('due_date') as string,
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      notes: formData.get('notes') as string,
      status: 'UNPAID'
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert([newInvoice])
      .select('*, projects(name, client_name, clients(name))')

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setInvoices([data[0], ...invoices])
      setIsDialogOpen(false)
      toast.success(`Invoice ${invoiceNumber} created successfully`)
    }
  }

  // Calculate invoice paid amount & status dynamically
  const processedInvoices = invoices.map(inv => {
    const invPayments = payments.filter(p => p.invoice_id === inv.id)
    const paid = invPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const balance = Math.max(0, Number(inv.amount) - paid)
    
    let derivedStatus = inv.status || 'UNPAID'
    if (paid >= Number(inv.amount)) {
      derivedStatus = 'PAID'
    } else if (paid > 0) {
      derivedStatus = 'PARTIALLY PAID'
    } else {
      derivedStatus = 'UNPAID'
    }

    return {
      ...inv,
      paid,
      balance,
      derivedStatus
    }
  })

  const filteredInvoices = processedInvoices.filter(inv => {
    const clientName = inv.client_name || inv.projects?.client_name || inv.projects?.clients?.name || ''
    const projName = inv.projects?.name || ''
    const matchesSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      clientName.toLowerCase().includes(search.toLowerCase()) ||
      projName.toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || inv.derivedStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge className="bg-emerald-600 hover:bg-emerald-700">PAID</Badge>
      case 'PARTIALLY PAID': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">PARTIALLY PAID</Badge>
      case 'OVERDUE': return <Badge variant="destructive">OVERDUE</Badge>
      default: return <Badge variant="outline" className="text-gray-600">UNPAID</Badge>
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Create and manage bills sent to clients.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Generate a custom invoice for a project.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateInvoice}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="project_id">Project</Label>
                  <Select name="project_id" required value={selectedProjectId} onValueChange={(val) => val && setSelectedProjectId(val)}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Invoice Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" required placeholder="10000" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="invoice_date">Invoice Date</Label>
                    <Input id="invoice_date" name="invoice_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" name="due_date" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" required placeholder="Software Development Services" defaultValue="Software Development Services" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea id="notes" name="notes" placeholder="Payment terms or instructions..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Generate Invoice</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center space-x-2 w-full sm:max-w-sm">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search by invoice #, client or project..."
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
            <SelectItem value="UNPAID">Unpaid</SelectItem>
            <SelectItem value="PARTIALLY PAID">Partially Paid</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <h3 className="text-xl font-semibold">Loading invoices...</h3>
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-xl font-semibold">No invoices generated yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">Create your first invoice whenever you request a payment from a client.</p>
          <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Invoice
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client / Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((inv) => {
                const clientName = inv.client_name || inv.projects?.client_name || inv.projects?.clients?.name || 'Client'
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium font-mono text-primary">{inv.invoice_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{clientName}</span>
                        <span className="text-xs text-muted-foreground">{inv.projects?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inv.invoice_date}</TableCell>
                    <TableCell className="text-right font-medium">₹{Number(inv.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">₹{inv.paid.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-rose-600 font-medium">₹{inv.balance.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(inv.derivedStatus)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> View / Print Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/projects/${inv.project_id}`)}>
                            Record Payment
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
