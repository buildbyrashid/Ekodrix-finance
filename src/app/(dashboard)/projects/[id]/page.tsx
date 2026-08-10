'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Banknote, Wallet, Receipt, CreditCard, FolderKanban, Loader2, IndianRupee, Trash2, AlertTriangle, FileText, Eye, Printer, Pencil, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState("Project")

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Invoice Edit & Delete state
  const [editingInvoice, setEditingInvoice] = useState<any>(null)
  const [isEditInvoiceDialogOpen, setIsEditInvoiceDialogOpen] = useState(false)
  const [isSavingEditInvoice, setIsSavingEditInvoice] = useState(false)

  const [deletingInvoice, setDeletingInvoice] = useState<any>(null)
  const [isDeleteInvoiceDialogOpen, setIsDeleteInvoiceDialogOpen] = useState(false)
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (id) fetchProjectDetails()
  }, [id])

  const fetchProjectDetails = async () => {
    setLoading(true)
    const projRes = await supabase.from('projects').select('*, clients(name)').eq('id', id).single()

    if (projRes.error) {
      toast.error('Failed to load project details')
      router.push('/projects')
      return
    }

    // Safely query invoices (in case table is not created in Supabase yet)
    let invData: any[] = []
    const invRes = await supabase.from('invoices').select('*').eq('project_id', id).order('created_at', { ascending: false })
    if (!invRes.error && invRes.data) {
      invData = invRes.data
    }

    // Safely query payments (try with invoices join first, fallback to simple query if relation doesn't exist)
    let payData: any[] = []
    const payResWithInv = await supabase.from('payments').select('*, invoices(invoice_number)').eq('project_id', id).order('payment_date', { ascending: false })
    if (payResWithInv.error) {
      const payResSimple = await supabase.from('payments').select('*').eq('project_id', id).order('payment_date', { ascending: false })
      if (payResSimple.data) payData = payResSimple.data
    } else if (payResWithInv.data) {
      payData = payResWithInv.data
    }

    // Query expenses
    let expData: any[] = []
    const expRes = await supabase.from('expenses').select('*').eq('project_id', id).order('expense_date', { ascending: false })
    if (expRes.data) expData = expRes.data

    setProject(projRes.data)
    setInvoices(invData)
    setPayments(payData)
    setExpenses(expData)
    setLoading(false)
  }

  const handleConfirmDelete = async () => {
    if (!project) return
    setIsDeleting(true)
    try {
      await supabase.from('payments').delete().eq('project_id', id)
      await supabase.from('expenses').delete().eq('project_id', id)
      await supabase.from('invoices').delete().eq('project_id', id)
      const { error: projErr } = await supabase.from('projects').delete().eq('id', id)

      if (projErr) throw projErr

      toast.success(`Project "${project.name}" deleted successfully`)
      router.push('/projects')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project')
      setIsDeleting(false)
    }
  }

  const handleEditProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSavingEdit(true)
    const formData = new FormData(e.currentTarget)
    const updates = {
      name: formData.get('name') as string,
      project_type: formData.get('project_type') as string,
      client_name: formData.get('client_name') as string,
      total_value: Number(formData.get('total_value')),
      due_date: formData.get('due_date') as string,
      status: formData.get('status') as string,
    }
    const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select('*, clients(name)').single()
    if (error) {
      toast.error(error.message)
    } else if (data) {
      setProject(data)
      setIsEditDialogOpen(false)
      toast.success('Project updated successfully')
    }
    setIsSavingEdit(false)
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

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge className="bg-emerald-600 hover:bg-emerald-700">PAID</Badge>
      case 'PARTIALLY PAID': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">PARTIALLY PAID</Badge>
      case 'OVERDUE': return <Badge variant="destructive">OVERDUE</Badge>
      default: return <Badge variant="outline" className="text-gray-600">UNPAID</Badge>
    }
  }

  // Line Items state for Project Details Create & Edit Invoice (start empty)
  const [createInvoiceItems, setCreateInvoiceItems] = useState<{ description: string; amount: number }[]>([
    { description: '', amount: 0 }
  ])
  const [editInvoiceItems, setEditInvoiceItems] = useState<{ description: string; amount: number }[]>([])

  const totalCreateInvoiceAmount = createInvoiceItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const totalEditInvoiceAmount = editInvoiceItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const handleAddInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const clientName = project.client_name || project.clients?.name || ''
    const currentYear = new Date().getFullYear()
    const invCount = 14 + invoices.length + 1
    const invoiceNumber = `EK-${currentYear}-${String(invCount).padStart(3, '0')}`

    const validItems = createInvoiceItems.filter(item => item.description.trim() !== '')
    const itemsJson = JSON.stringify(validItems)

    const invoiceDateVal = formData.get('invoice_date') as string
    const dueDateVal = formData.get('due_date') as string

    const newInvoice = {
      project_id: id,
      client_name: clientName,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDateVal,
      due_date: dueDateVal ? dueDateVal : invoiceDateVal,
      amount: totalCreateInvoiceAmount,
      description: itemsJson,
      notes: formData.get('notes') as string,
      status: 'UNPAID'
    }

    const { data, error } = await supabase.from('invoices').insert([newInvoice]).select()

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setInvoices([data[0], ...invoices])
      setIsInvoiceDialogOpen(false)
      setCreateInvoiceItems([{ description: '', amount: 0 }])
      toast.success(`Invoice ${invoiceNumber} created successfully`)
    }
  }

  const handleEditInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingInvoice) return
    setIsSavingEditInvoice(true)
    const formData = new FormData(e.currentTarget)

    const validItems = editInvoiceItems.filter(item => item.description.trim() !== '')
    const itemsJson = JSON.stringify(validItems)

    const updates = {
      amount: totalEditInvoiceAmount,
      invoice_date: formData.get('invoice_date') as string,
      due_date: formData.get('due_date') as string,
      description: itemsJson,
      notes: formData.get('notes') as string,
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', editingInvoice.id)
      .select()

    if (error) {
      toast.error(error.message)
    } else if (data && data.length > 0) {
      setInvoices(invoices.map(i => i.id === editingInvoice.id ? data[0] : i))
      setIsEditInvoiceDialogOpen(false)
      setEditingInvoice(null)
      toast.success(`Invoice ${editingInvoice.invoice_number} updated successfully`)
    }
    setIsSavingEditInvoice(false)
  }

  const handleDeleteInvoice = async () => {
    if (!deletingInvoice) return
    setIsDeletingInvoice(true)

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', deletingInvoice.id)

    if (error) {
      toast.error(error.message)
    } else {
      setInvoices(invoices.filter(i => i.id !== deletingInvoice.id))
      setIsDeleteInvoiceDialogOpen(false)
      setDeletingInvoice(null)
      toast.success(`Invoice ${deletingInvoice.invoice_number} deleted successfully`)
    }
    setIsDeletingInvoice(false)
  }

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const invoiceIdVal = formData.get('invoice_id') as string
    const invoice_id = invoiceIdVal && invoiceIdVal !== 'none' ? invoiceIdVal : null

    const newPayment = {
      project_id: id,
      invoice_id: invoice_id,
      amount: Number(formData.get('amount')),
      payment_date: formData.get('date') as string,
      payment_type: formData.get('type') as string || 'Partial',
      payment_method: formData.get('method') as string,
      transaction_reference: formData.get('transaction_reference') as string || null,
      notes: formData.get('notes') as string || null,
    }

    const { data, error } = await supabase.from('payments').insert([newPayment]).select('*, invoices(invoice_number)')

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setPayments([data[0], ...payments])
      setIsPaymentDialogOpen(false)
      toast.success('Payment recorded successfully')
      fetchProjectDetails() // Refresh to update project and invoice calculations
    }
  }

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    let category = formData.get('category') as string
    if (category === 'Other') {
      category = formData.get('customCategory') as string
    }
    
    const newExpense = {
      project_id: id,
      category,
      amount: Number(formData.get('amount')),
      expense_date: formData.get('date') as string,
      payment_method: formData.get('method') as string,
      notes: formData.get('notes') as string,
      is_recurring: false,
    }

    const { data, error } = await supabase.from('expenses').insert([newExpense]).select()

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setExpenses([data[0], ...expenses])
      setIsExpenseDialogOpen(false)
      toast.success('Expense recorded successfully')
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!project) return null

  // Core Financial Calculations
  const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const pendingBalance = Math.max(0, Number(project.total_value) - totalReceived)
  const netProfit = totalReceived - totalExpenses // Calculated strictly using received funds

  // Process invoices with paid amounts
  const processedInvoices = invoices.map(inv => {
    const invPayments = payments.filter(p => p.invoice_id === inv.id)
    const paid = invPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const balance = Math.max(0, Number(inv.amount) - paid)
    let derivedStatus = 'UNPAID'
    if (paid >= Number(inv.amount)) derivedStatus = 'PAID'
    else if (paid > 0) derivedStatus = 'PARTIALLY PAID'
    return { ...inv, paid, balance, derivedStatus }
  })

  // Filter invoices suitable for Add Payment modal
  const unpaidInvoices = processedInvoices.filter(inv => inv.derivedStatus !== 'PAID')

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" className="p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-foreground mb-2" onClick={() => router.push('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {getStatusBadge(project.status)}
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            Client: <span className="font-medium text-foreground">{project.client_name || project.clients?.name}</span>
            {project.due_date && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span>Due: {new Date(project.due_date).toLocaleDateString()}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" /> Edit Project
          </Button>
          <Button
            variant="destructive"
            className="cursor-pointer"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete Project
          </Button>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Banknote className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Number(project.total_value).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₹{totalReceived.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">₹{pendingBalance.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Project Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Net Profit</CardTitle>
            <IndianRupee className="h-4 w-4 text-primary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{netProfit.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Section */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between py-4 border-b">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Project Invoices
            </CardTitle>
          </div>
               <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="cursor-pointer" />}>
              <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Invoice for {project.name}</DialogTitle>
                <DialogDescription>Add itemized deliverables (E-commerce, Logo, Domain, etc.).</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddInvoice}>
                <div className="grid gap-4 py-4">
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
                      <Label className="font-semibold text-sm">Invoice Line Items</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCreateInvoiceItems([...createInvoiceItems, { description: '', amount: 0 }])}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {createInvoiceItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            placeholder="e.g. E-commerce Website, Logo Design..."
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...createInvoiceItems]
                              updated[idx].description = e.target.value
                              setCreateInvoiceItems(updated)
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
                                const updated = [...createInvoiceItems]
                                updated[idx].amount = Number(e.target.value) || 0
                                setCreateInvoiceItems(updated)
                              }}
                              className="pl-6 text-sm text-right"
                              required
                            />
                          </div>
                          {createInvoiceItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                              onClick={() => setCreateInvoiceItems(createInvoiceItems.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t text-sm font-bold">
                      <span>Total Invoice Amount:</span>
                      <span className="text-base text-primary font-mono">₹{totalCreateInvoiceAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes / Terms (Optional)</Label>
                    <Textarea id="notes" name="notes" placeholder="Optional notes for client..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Generate Invoice (₹{totalCreateInvoiceAmount.toLocaleString('en-IN')})</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {processedInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-20" />
              <p>No invoices generated yet for this project.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium font-mono text-primary">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{inv.invoice_date}</TableCell>
                    <TableCell className="text-right font-medium">₹{Number(inv.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">₹{inv.paid.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-rose-600 font-medium">₹{inv.balance.toLocaleString()}</TableCell>
                    <TableCell>{getInvoiceStatusBadge(inv.derivedStatus)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> View / Print
                          </DropdownMenuItem>
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
                            setEditInvoiceItems(items.length > 0 ? items : [{ description: 'Services', amount: Number(inv.amount) || 0 }])
                            setIsEditInvoiceDialogOpen(true)
                          }}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => {
                              setDeletingInvoice(inv)
                              setIsDeleteInvoiceDialogOpen(true)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transactions Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Payments Section */}
        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between py-4 border-b">
            <CardTitle className="text-lg">Payments Ledger</CardTitle>
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" className="cursor-pointer" />}>
                <Plus className="mr-2 h-4 w-4" /> Add Payment
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                  <DialogDescription>Add a payment received for {project.name}.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddPayment}>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <Input id="amount" name="amount" type="number" required placeholder="5000" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="date">Payment Date</Label>
                        <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="method">Payment Method</Label>
                      <Select name="method" required defaultValue="Bank Transfer">
                        <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Card">Card</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="invoice_id">Associated Invoice (Optional)</Label>
                      <Select name="invoice_id" defaultValue="none">
                        <SelectTrigger><SelectValue placeholder="No Invoice" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Invoice</SelectItem>
                          {unpaidInvoices.map(inv => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.invoice_number} (₹{inv.balance.toLocaleString()} due)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="transaction_reference">Transaction Ref / UTR (Optional)</Label>
                      <Input id="transaction_reference" name="transaction_reference" placeholder="e.g. UTR12345678" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea id="notes" name="notes" placeholder="Optional details..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Payment</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <FolderKanban className="h-8 w-8 mb-2 opacity-20" />
                <p>No payments recorded yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium text-xs whitespace-nowrap">{payment.payment_date}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-foreground">{payment.payment_method}</span>
                          <span className="text-muted-foreground">
                            {payment.invoices?.invoice_number ? `Inv: ${payment.invoices.invoice_number}` : 'No Invoice'}
                          </span>
                          {payment.transaction_reference && (
                            <span className="font-mono text-[10px] text-muted-foreground">Ref: {payment.transaction_reference}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">₹{Number(payment.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View Receipt" onClick={() => router.push(`/receipts/payment/${payment.id}`)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Expenses Section */}
        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between py-4 border-b">
            <CardTitle className="text-lg">Expenses Ledger</CardTitle>
            <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer" />}>
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Expense</DialogTitle>
                  <DialogDescription>Record a project cost (outsourcing, domains, tools, etc.).</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddExpense}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <Select name="category" value={expenseCategory} onValueChange={(val) => val && setExpenseCategory(val)}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Project">Project Expense</SelectItem>
                          <SelectItem value="Software/Tools">Software / Tools</SelectItem>
                          <SelectItem value="Subcontractor">Subcontractor / Freelancer</SelectItem>
                          <SelectItem value="Hosting/Domain">Hosting / Domain</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <Input id="amount" name="amount" type="number" required placeholder="1000" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="expense_date">Expense Date</Label>
                        <Input id="expense_date" name="expense_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Input id="description" name="description" required placeholder="e.g. Domain purchase or UI kit" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Record Expense</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <CreditCard className="h-8 w-8 mb-2 opacity-20" />
                <p>No expenses recorded yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium text-xs whitespace-nowrap">{expense.expense_date}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-foreground">{expense.description}</span>
                          <span className="text-muted-foreground">{expense.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-rose-600">₹{Number(expense.amount).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Project Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        if (!isDeleting) setIsDeleteDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80">
              Are you sure you want to delete <strong className="text-foreground font-semibold">"{project?.name}"</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 px-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm space-y-2">
            <p className="font-medium text-destructive">This action will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground pl-1">
              <li>The project record and details</li>
              <li>All linked payments (Received: <span className="font-semibold text-foreground">₹{totalReceived.toLocaleString()}</span>)</li>
              <li>All associated project expenses (Expenses: <span className="font-semibold text-foreground">₹{totalExpenses.toLocaleString()}</span>)</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
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
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!isSavingEdit) setIsEditDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Pencil className="h-5 w-5" /> Edit Project
            </DialogTitle>
            <DialogDescription>
              Update project details. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditProject}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Project Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  required
                  defaultValue={project?.name}
                  placeholder="e.g. Website Redesign"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-project-type">Project Type</Label>
                <Input
                  id="edit-project-type"
                  name="project_type"
                  defaultValue={project?.project_type || ''}
                  placeholder="e.g. E-Commerce Development"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-client-name">Client Name</Label>
                <Input
                  id="edit-client-name"
                  name="client_name"
                  required
                  defaultValue={project?.client_name || project?.clients?.name || ''}
                  placeholder="e.g. Afnan Teex Clothing"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-total-value">Total Project Value (₹)</Label>
                <Input
                  id="edit-total-value"
                  name="total_value"
                  type="number"
                  required
                  defaultValue={project?.total_value}
                  placeholder="e.g. 60000"
                />
                <p className="text-xs text-muted-foreground">You can increase or decrease the project value here.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-due-date">Due Date</Label>
                <Input
                  id="edit-due-date"
                  name="due_date"
                  type="date"
                  defaultValue={project?.due_date ? project.due_date.split('T')[0] : ''}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select name="status" defaultValue={project?.status || 'Pending'}>
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Partial Payment">Partial Payment</SelectItem>
                    <SelectItem value="Fully Paid">Fully Paid</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={isEditInvoiceDialogOpen} onOpenChange={(open) => {
        if (!isSavingEditInvoice) {
          setIsEditInvoiceDialogOpen(open)
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
                    <Label htmlFor="edit_due_date">Due Date</Label>
                    <Input id="edit_due_date" name="due_date" type="date" required defaultValue={editingInvoice.due_date} />
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
                      onClick={() => setEditInvoiceItems([...editInvoiceItems, { description: '', amount: 0 }])}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {editInvoiceItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...editInvoiceItems]
                            updated[idx].description = e.target.value
                            setEditInvoiceItems(updated)
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
                              const updated = [...editInvoiceItems]
                              updated[idx].amount = Number(e.target.value) || 0
                              setEditInvoiceItems(updated)
                            }}
                            className="pl-6 text-sm text-right"
                            required
                          />
                        </div>
                        {editInvoiceItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                            onClick={() => setEditInvoiceItems(editInvoiceItems.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t text-sm font-bold">
                    <span>Total Amount:</span>
                    <span className="text-base text-primary font-mono">₹{totalEditInvoiceAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit_notes">Notes (Optional)</Label>
                  <Textarea id="edit_notes" name="notes" defaultValue={editingInvoice.notes || ''} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditInvoiceDialogOpen(false)} disabled={isSavingEditInvoice}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingEditInvoice}>
                  {isSavingEditInvoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    `Save Changes (₹${totalEditInvoiceAmount.toLocaleString('en-IN')})`
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Confirmation Dialog */}
      <Dialog open={isDeleteInvoiceDialogOpen} onOpenChange={(open) => {
        if (!isDeletingInvoice) {
          setIsDeleteInvoiceDialogOpen(open)
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
            <Button variant="outline" onClick={() => setIsDeleteInvoiceDialogOpen(false)} disabled={isDeletingInvoice}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteInvoice} disabled={isDeletingInvoice}>
              {isDeletingInvoice ? (
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
