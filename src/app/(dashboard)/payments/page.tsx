'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal, ArrowDownRight, Trash2, Loader2, AlertTriangle, Printer } from 'lucide-react'
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
import Image from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function PaymentsPage() {
  const router = useRouter()
  const [payments, setPayments] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // 1. Projects
    let projData: any[] = []
    const projRes = await supabase.from('projects').select('id, name, client_name, clients(name)').order('name', { ascending: true })
    if (projRes.data) projData = projRes.data

    // 2. Invoices (safely)
    let invData: any[] = []
    const invRes = await supabase.from('invoices').select('id, project_id, invoice_number, amount').order('created_at', { ascending: false })
    if (invRes.data) invData = invRes.data

    // 3. Payments (with fallback)
    let payData: any[] = []
    const payResWithInv = await supabase.from('payments').select('*, projects(name, client_name, clients(name)), invoices(invoice_number)').order('created_at', { ascending: false })
    if (payResWithInv.error) {
      const payResSimple = await supabase.from('payments').select('*, projects(name, client_name, clients(name))').order('created_at', { ascending: false })
      if (payResSimple.data) payData = payResSimple.data
    } else if (payResWithInv.data) {
      payData = payResWithInv.data
    }

    setPayments(payData)
    setProjects(projData)
    setInvoices(invData)
    setLoading(false)
  }

  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<any | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentToDelete.id)

      if (error) throw error

      setPayments(prev => prev.filter(p => p.id !== paymentToDelete.id))
      toast.success('Payment transaction deleted successfully')
      setIsDeleteDialogOpen(false)
      setPaymentToDelete(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete payment')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredPayments = payments.filter(p => {
    const clientName = p.projects?.client_name || p.projects?.clients?.name || ''
    return p.projects?.name?.toLowerCase().includes(search.toLowerCase()) || 
      clientName.toLowerCase().includes(search.toLowerCase()) ||
      p.invoices?.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.payment_method?.toLowerCase().includes(search.toLowerCase())
  })

  const availableInvoicesForSelectedProject = invoices.filter(inv => inv.project_id === selectedProjectId)

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const invoiceIdVal = formData.get('invoice_id') as string
    const invoice_id = invoiceIdVal && invoiceIdVal !== 'none' ? invoiceIdVal : null

    const newPayment = {
      project_id: formData.get('project') as string,
      invoice_id: invoice_id,
      amount: Number(formData.get('amount')),
      payment_date: formData.get('date') as string,
      payment_method: formData.get('method') as string,
      transaction_reference: formData.get('transaction_reference') as string || null,
      notes: formData.get('notes') as string || null,
    }

    const { data, error } = await supabase
      .from('payments')
      .insert([newPayment])
      .select('*, projects(name, client_name, clients(name)), invoices(invoice_number)')

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setPayments([data[0], ...payments])
      setIsDialogOpen(false)
      toast.success('Payment recorded successfully')
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments Received</h1>
          <p className="text-muted-foreground mt-1">Record and track payments received from clients.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Record Payment
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
              <DialogDescription>
                Enter the payment details received from the client.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPayment}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="project">Project</Label>
                  <Select name="project" required value={selectedProjectId} onValueChange={(val) => val && setSelectedProjectId(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" required placeholder="50000" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">Payment Date</Label>
                    <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="method">Method</Label>
                  <Select name="method" required defaultValue="Bank Transfer">
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
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
                      {availableInvoicesForSelectedProject.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number} (₹{Number(inv.amount).toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="transaction_reference">Transaction Reference (Optional)</Label>
                  <Input id="transaction_reference" name="transaction_reference" placeholder="e.g. UTR / Ref Number" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea id="notes" name="notes" placeholder="Optional notes about this payment" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save Payment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input 
          placeholder="Search by client, project, or invoice #..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <h3 className="text-xl font-semibold">Loading payments...</h3>
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <div className="relative w-48 h-48 mb-4 opacity-80">
            <Image src="/empty-state.png" alt="No payments" fill className="object-contain" />
          </div>
          <h3 className="text-xl font-semibold">No payments recorded</h3>
          <p className="text-muted-foreground mt-2 max-w-sm">Record your first payment when a client pays.</p>
          <Button className="mt-6" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Record Payment
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client / Project</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Method & Ref</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => {
                const clientName = payment.projects?.client_name || payment.projects?.clients?.name || 'Client'
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">{payment.payment_date}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{clientName}</span>
                        <span className="text-xs text-muted-foreground">{payment.projects?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.invoices?.invoice_number ? (
                        <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                          {payment.invoices.invoice_number}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No Invoice</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium">{payment.payment_method}</span>
                        {payment.transaction_reference && (
                          <span className="font-mono text-muted-foreground text-[10px]">Ref: {payment.transaction_reference}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      +₹{Number(payment.amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/receipts/payment/${payment.id}`)}>
                            <Printer className="mr-2 h-4 w-4" /> View / Print Receipt
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => {
                              setPaymentToDelete(payment)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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

      {/* Delete Payment Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        if (!isDeleting) {
          setIsDeleteDialogOpen(open)
          if (!open) setPaymentToDelete(null)
        }
      }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5" />
              Delete Payment Transaction
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80">
              Are you sure you want to delete this payment record of <strong className="text-foreground font-semibold">₹{Number(paymentToDelete?.amount).toLocaleString()}</strong> for <strong className="text-foreground font-semibold">{paymentToDelete?.projects?.name || 'Project'}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 px-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm space-y-1 text-muted-foreground">
            <p className="font-medium text-destructive">This action will remove the transaction record from finance history.</p>
            <p className="text-xs">Project pending balances and dashboard totals will adjust automatically.</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setPaymentToDelete(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeletePayment}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
