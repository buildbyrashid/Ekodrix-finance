'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, MoreHorizontal, FileText, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Loader2, AlertTriangle, Eye, Printer, Pencil, Receipt, CheckCircle2, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getCached, setCached, invalidateCache, hasCached } from '@/lib/data-cache'

export default function InvoicesPage() {
  const router = useRouter()
  const { isAdmin, isFounder } = useAuth()
  const [invoices, setInvoices] = useState<any[]>(() => getCached('invoices_all') || [])
  const [projects, setProjects] = useState<any[]>(() => getCached('invoices_projects') || [])
  const [payments, setPayments] = useState<any[]>(() => getCached('invoices_payments') || [])
  const [loading, setLoading] = useState(() => !hasCached('invoices_all'))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  // Edit & Delete state
  const [editingInvoice, setEditingInvoice] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [deletingInvoice, setDeletingInvoice] = useState<any>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const supabase = createClient()

  // Line Items state for Create Invoice (start with 1 blank row)
  const [createItems, setCreateItems] = useState<{ description: string; amount: number }[]>([
    { description: '', amount: 0 }
  ])

  // Line Items state for Edit Invoice
  const [editItems, setEditItems] = useState<{ description: string; amount: number }[]>([])

  const totalCreateAmount = createItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const totalEditAmount = editItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    if (!hasCached('invoices_all')) {
      setLoading(true)
    }

    let projData: any[] = []
    const projRes = await supabase.from('projects').select('id, name, client_name, clients(name)').order('name', { ascending: true })
    if (projRes.data) {
      projData = projRes.data
      setCached('invoices_projects', projData)
    }

    let invData: any[] = []
    const invRes = await supabase.from('invoices').select('*, projects(name, client_name, clients(name))').order('created_at', { ascending: false })
    if (invRes.data) {
      invData = invRes.data
      setCached('invoices_all', invData)
    }

    let payData: any[] = []
    const payRes = await supabase.from('payments').select('invoice_id, amount').not('invoice_id', 'is', null)
    if (payRes.data) {
      payData = payRes.data
      setCached('invoices_payments', payData)
    }

    setInvoices(invData)
    setProjects(projData)
    setPayments(payData)
    setLoading(false)
  }

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isFounder || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)

      const projId = formData.get('project_id') as string
      const selProj = projects.find(p => p.id === projId)
      const clientName = selProj?.client_name || selProj?.clients?.name || ''

      // Generate Invoice Number EK-YYYY-XXX — query live count so number is always sequential
      const currentYear = new Date().getFullYear()
      const { count: liveInvCount } = await supabase.from('invoices').select('id', { count: 'exact', head: true })
      const invCount = 15 + (liveInvCount ?? invoices.length) + 1
      const invoiceNumber = `EK-${currentYear}-${String(invCount).padStart(3, '0')}`

      // Parse line items JSON string into description or store structured
      const validItems = createItems.filter(item => item.description.trim() !== '')
      const itemsJson = JSON.stringify(validItems)

      const invoiceDateVal = formData.get('invoice_date') as string
      const dueDateVal = formData.get('due_date') as string

      const newInvoice = {
        project_id: projId,
        client_name: clientName,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDateVal,
        due_date: dueDateVal ? dueDateVal : invoiceDateVal,
        amount: totalCreateAmount,
        description: itemsJson,
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
        const updated = [data[0], ...invoices]
        setInvoices(updated)
        setCached('invoices_all', updated)
        invalidateCache('dashboard')
        invalidateCache('reports')
        setIsDialogOpen(false)
        setCreateItems([{ description: '', amount: 0 }])
        toast.success(`Invoice ${invoiceNumber} created successfully`)
      }
    } finally {
      setIsSubmitting(false)
      submittingRef.current = false
    }
  }

  const handleEditInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isFounder || !editingInvoice || isSavingEdit) return
    setIsSavingEdit(true)

    try {
      const formData = new FormData(e.currentTarget)

      const validItems = editItems.filter(item => item.description.trim() !== '')
      const itemsJson = JSON.stringify(validItems)

      const updates = {
        amount: totalEditAmount,
        invoice_date: formData.get('invoice_date') as string,
        due_date: formData.get('due_date') as string,
        description: itemsJson,
        notes: formData.get('notes') as string,
      }

      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', editingInvoice.id)
        .select('*, projects(name, client_name, clients(name))')

      if (error) {
        toast.error(error.message)
      } else if (data && data.length > 0) {
        const updated = invoices.map(i => i.id === editingInvoice.id ? data[0] : i)
        setInvoices(updated)
        setCached('invoices_all', updated)
        invalidateCache('dashboard')
        invalidateCache('reports')
        setIsEditDialogOpen(false)
        setEditingInvoice(null)
        toast.success(`Invoice ${editingInvoice.invoice_number} updated successfully`)
      }
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (isFounder || !deletingInvoice || isDeleting) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', deletingInvoice.id)

      if (error) {
        toast.error(error.message)
      } else {
        const updated = invoices.filter(i => i.id !== deletingInvoice.id)
        setInvoices(updated)
        setCached('invoices_all', updated)
        invalidateCache('dashboard')
        invalidateCache('reports')
        setIsDeleteDialogOpen(false)
        setDeletingInvoice(null)
        toast.success(`Invoice ${deletingInvoice.invoice_number} deleted successfully`)
      }
    } finally {
      setIsDeleting(false)
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

  // Executive KPI stats
  const totalBilled = processedInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
  const totalPaid = processedInvoices.reduce((sum, inv) => sum + inv.paid, 0)
  const totalOutstanding = processedInvoices.reduce((sum, inv) => sum + inv.balance, 0)
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0

  const countUnpaid = processedInvoices.filter(i => i.derivedStatus === 'UNPAID').length
  const countPartial = processedInvoices.filter(i => i.derivedStatus === 'PARTIALLY PAID').length
  const countPaid = processedInvoices.filter(i => i.derivedStatus === 'PAID').length

  const filterTabs = [
    { id: 'all', label: 'All Invoices', count: processedInvoices.length },
    { id: 'UNPAID', label: 'Unpaid', count: countUnpaid },
    { id: 'PARTIALLY PAID', label: 'Partially Paid', count: countPartial },
    { id: 'PAID', label: 'Paid', count: countPaid },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            PAID
          </span>
        )
      case 'PARTIALLY PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            PARTIAL
          </span>
        )
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            OVERDUE
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
            UNPAID
          </span>
        )
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Create and manage bills sent to clients.</p>
        </div>

        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button onClick={() => setIsDialogOpen(true)} />}>
              <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </DialogTrigger>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Generate a custom invoice with itemized services (E-commerce, Logo, Domain, etc.).
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
                    <Label htmlFor="invoice_date">Invoice Date</Label>
                    <Input id="invoice_date" name="invoice_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="due_date">Due Date (Optional)</Label>
                    <Input id="due_date" name="due_date" type="date" />
                  </div>
                </div>

                {/* Dynamic Line Items Section */}
                <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-sm">Invoice Deliverables / Line Items</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCreateItems([...createItems, { description: '', amount: 0 }])}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {createItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          placeholder="e.g. E-commerce Website, Logo Design..."
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...createItems]
                            updated[idx].description = e.target.value
                            setCreateItems(updated)
                          }}
                          className="flex-1 text-sm"
                          required
                        />
                        <div className="relative w-32 shrink-0">
                          <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">₹</span>
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={item.amount || ''}
                            onChange={(e) => {
                              const updated = [...createItems]
                              updated[idx].amount = Number(e.target.value) || 0
                              setCreateItems(updated)
                            }}
                            className="pl-6 text-sm text-right"
                            required
                          />
                        </div>
                        {createItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                            onClick={() => setCreateItems(createItems.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t text-sm font-bold">
                    <span>Total Invoice Amount:</span>
                    <span className="text-base text-primary font-mono">₹{totalCreateAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes / Terms (Optional)</Label>
                  <Textarea id="notes" name="notes" placeholder="Payment terms or instructions..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Invoice...
                    </>
                  ) : (
                    `Generate Invoice (₹${totalCreateAmount.toLocaleString('en-IN')})`
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Top KPI Summary Cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Invoiced</CardTitle>
              <Receipt className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalBilled.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{invoices.length} Invoices Issued</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Received</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{totalPaid.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium text-emerald-500">{collectionRate}% collected</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding Due</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">₹{totalOutstanding.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{countUnpaid + countPartial} awaiting clearance</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fully Paid Invoices</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{countPaid}</div>
              <p className="text-xs text-muted-foreground mt-1">Cleared invoices</p>
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
            placeholder="Search by invoice #, client or project..."
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
          <h3 className="text-xl font-semibold">Loading invoices...</h3>
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-xl font-semibold">No invoices generated yet</h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">Create your first invoice whenever you request a payment from a client.</p>
          {isAdmin && (
            <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Button>
          )}
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
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No invoices match your search or filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv) => {
                  const clientName = inv.client_name || inv.projects?.client_name || inv.projects?.clients?.name || 'Client'
                  return (
                    <TableRow 
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                    >
                      <TableCell className="font-medium font-mono text-primary group-hover:underline">
                        {inv.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm group-hover:text-primary transition-colors">{clientName}</span>
                          <span className="text-xs text-muted-foreground">{inv.projects?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{inv.invoice_date}</TableCell>
                      <TableCell className="text-right font-medium">₹{Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-500 font-medium">₹{inv.paid.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive font-medium">₹{inv.balance.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(inv.derivedStatus)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer" />}>
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}`)} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" /> View / Print Invoice
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem onClick={() => {
                                  setEditingInvoice(inv)
                                  let items = []
                                  try {
                                    if (inv.description && inv.description.startsWith('[')) {
                                      items = JSON.parse(inv.description)
                                    } else if (inv.description) {
                                      items = [{ description: inv.description, amount: Number(inv.amount) || 0 }]
                                    }
                                  } catch {
                                    items = [{ description: inv.description || 'Services', amount: Number(inv.amount) || 0 }]
                                  }
                                  setEditItems(items.length > 0 ? items : [{ description: 'Services', amount: Number(inv.amount) || 0 }])
                                  setIsEditDialogOpen(true)
                                }} className="cursor-pointer">
                                  <Pencil className="mr-2 h-4 w-4" /> Edit Invoice
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/projects/${inv.project_id}`)} className="cursor-pointer">
                                  Record Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                  onClick={() => {
                                    setDeletingInvoice(inv)
                                    setIsDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Invoice
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

      {/* Edit Invoice Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!isSavingEdit) {
          setIsEditDialogOpen(open)
          if (!open) setEditingInvoice(null)
        }
      }}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Invoice {editingInvoice?.invoice_number}
            </DialogTitle>
            <DialogDescription>
              Update invoice line items and details. Total updates automatically.
            </DialogDescription>
          </DialogHeader>
          {editingInvoice && (
            <form onSubmit={handleEditInvoice}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit_invoice_date">Invoice Date</Label>
                    <Input id="edit_invoice_date" name="invoice_date" type="date" required defaultValue={editingInvoice.invoice_date} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit_due_date">Due Date (Optional)</Label>
                    <Input id="edit_due_date" name="due_date" type="date" defaultValue={editingInvoice.due_date || ''} />
                  </div>
                </div>

                {/* Edit Line Items */}
                <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-sm">Invoice Line Items</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setEditItems([...editItems, { description: '', amount: 0 }])}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {editItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...editItems]
                            updated[idx].description = e.target.value
                            setEditItems(updated)
                          }}
                          className="flex-1 text-sm"
                          required
                        />
                        <div className="relative w-32 shrink-0">
                          <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">₹</span>
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={item.amount || ''}
                            onChange={(e) => {
                              const updated = [...editItems]
                              updated[idx].amount = Number(e.target.value) || 0
                              setEditItems(updated)
                            }}
                            className="pl-6 text-sm text-right"
                            required
                          />
                        </div>
                        {editItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                            onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t text-sm font-bold">
                    <span>Total Amount:</span>
                    <span className="text-base text-primary font-mono">₹{totalEditAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit_notes">Notes (Optional)</Label>
                  <Textarea id="edit_notes" name="notes" defaultValue={editingInvoice.notes || ''} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSavingEdit}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingEdit}>
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    `Save Changes (₹${totalEditAmount.toLocaleString('en-IN')})`
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        if (!isDeleting) {
          setIsDeleteDialogOpen(open)
          if (!open) setDeletingInvoice(null)
        }
      }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Invoice
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete invoice <strong className="text-foreground">{deletingInvoice?.invoice_number}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 px-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm space-y-1">
            <p className="font-medium text-destructive">This action cannot be undone.</p>
            <p className="text-xs text-muted-foreground">Any payments linked to this invoice will remain recorded but will no longer reference this invoice.</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteInvoice} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                'Delete Invoice'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
