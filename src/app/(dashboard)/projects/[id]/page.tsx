'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Banknote, Wallet, Receipt, CreditCard, FolderKanban, Loader2, IndianRupee, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState("Project")

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    if (!project) return
    setIsDeleting(true)
    try {
      // 1. Delete associated payments
      const { error: payErr } = await supabase
        .from('payments')
        .delete()
        .eq('project_id', id)

      if (payErr) throw payErr

      // 2. Delete associated expenses
      const { error: expErr } = await supabase
        .from('expenses')
        .delete()
        .eq('project_id', id)

      if (expErr) throw expErr

      // 3. Delete the project
      const { error: projErr } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (projErr) throw projErr

      toast.success(`Project "${project.name}" and connected transactions deleted successfully`)
      router.push('/projects')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project')
      setIsDeleting(false)
    }
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (id) fetchProjectDetails()
  }, [id])

  const fetchProjectDetails = async () => {
    setLoading(true)
    const [projRes, payRes, expRes] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').eq('id', id).single(),
      supabase.from('payments').select('*').eq('project_id', id).order('payment_date', { ascending: false }),
      supabase.from('expenses').select('*').eq('project_id', id).order('expense_date', { ascending: false })
    ])

    if (projRes.error) {
      toast.error('Failed to load project details')
      router.push('/projects')
      return
    }

    setProject(projRes.data)
    setPayments(payRes.data || [])
    setExpenses(expRes.data || [])
    setLoading(false)
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

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const newPayment = {
      project_id: id,
      amount: Number(formData.get('amount')),
      payment_date: formData.get('date') as string,
      payment_type: formData.get('type') as string,
      payment_method: formData.get('method') as string,
      notes: formData.get('notes') as string,
    }

    const { data, error } = await supabase.from('payments').insert([newPayment]).select()

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setPayments([data[0], ...payments])
      setIsPaymentDialogOpen(false)
      toast.success('Payment recorded successfully')
      fetchProjectDetails() // Refresh to update status if needed
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
      is_recurring: false, // Project expenses usually aren't recurring
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

  const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const pendingBalance = Number(project.total_value) - totalReceived
  const netProfit = Number(project.total_value) - totalExpenses

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
            Client: <span className="font-medium text-foreground">{project.clients?.name}</span>
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
            <div className="text-2xl font-bold text-destructive">₹{pendingBalance > 0 ? pendingBalance.toLocaleString() : 0}</div>
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
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" name="date" type="date" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="type">Payment Type</Label>
                        <Select name="type" required>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Advance">Advance</SelectItem>
                            <SelectItem value="Partial">Partial</SelectItem>
                            <SelectItem value="Final">Final</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="method">Method</Label>
                        <Select name="method" required>
                          <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bank">Bank</SelectItem>
                            <SelectItem value="UPI">UPI</SelectItem>
                            <SelectItem value="Card">Card</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
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
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.payment_date}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{payment.payment_type}</span>
                          <span className="text-xs text-muted-foreground">{payment.payment_method}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">₹{Number(payment.amount).toLocaleString()}</TableCell>
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
                  <DialogTitle>Record Project Expense</DialogTitle>
                  <DialogDescription>Add a cost incurred specifically for {project.name}.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddExpense}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <Select name="category" required value={expenseCategory} onValueChange={(val) => val && setExpenseCategory(val)}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Project">Project Specific</SelectItem>
                          <SelectItem value="Rent">Rent</SelectItem>
                          <SelectItem value="WiFi">WiFi</SelectItem>
                          <SelectItem value="Subscription">Subscription</SelectItem>
                          <SelectItem value="Travel">Travel</SelectItem>
                          <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                          <SelectItem value="Other">Other...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {expenseCategory === 'Other' && (
                      <div className="grid gap-2">
                        <Label htmlFor="customCategory">Custom Category Name</Label>
                        <Input id="customCategory" name="customCategory" required placeholder="Enter custom category" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <Input id="amount" name="amount" type="number" required placeholder="1500" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" name="date" type="date" required />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="method">Payment Method</Label>
                      <Select name="method" required>
                        <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank">Bank</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Card">Card</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes / Reason</Label>
                      <Textarea id="notes" name="notes" placeholder="e.g. Bought domain name..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" variant="destructive">Save Expense</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Receipt className="h-8 w-8 mb-2 opacity-20" />
                <p>No expenses recorded yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.expense_date}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{expense.category}</span>
                          <span className="text-xs text-muted-foreground">{expense.notes || expense.payment_method}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">-₹{Number(expense.amount).toLocaleString()}</TableCell>
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
            <p className="text-xs text-muted-foreground pt-1">
              All financial dashboards and transaction history will automatically update. This action cannot be undone.
            </p>
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
