'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, MoreHorizontal, ArrowUpRight, Filter, Loader2, Pencil } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { getCached, setCached, invalidateCache, hasCached } from '@/lib/data-cache'

export default function ExpensesPage() {
  const { isAdmin, isFounder } = useAuth()
  const [expenses, setExpenses] = useState<any[]>(() => getCached('expenses') || [])
  const [projects, setProjects] = useState<any[]>(() => getCached('projects_short') || [])
  const [loading, setLoading] = useState(() => !hasCached('expenses'))
  const [expenseType, setExpenseType] = useState<'office' | 'project'>('office')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  // Edit Expense State
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editCategory, setEditCategory] = useState('')

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [expRes, projRes] = await Promise.all([
      supabase.from('expenses').select('*, projects(name)').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name').order('name', { ascending: true })
    ])
    if (expRes.error) toast.error('Failed to load expenses')
    if (expRes.data) {
      setExpenses(expRes.data)
      setCached('expenses', expRes.data)
    }
    if (projRes.data) {
      setProjects(projRes.data)
      setCached('projects_short', projRes.data)
    }
    setLoading(false)
  }

  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('')

  const filteredExpenses = expenses.filter(e => 
    e.category?.toLowerCase().includes(search.toLowerCase()) || 
    e.notes?.toLowerCase().includes(search.toLowerCase()) ||
    e.projects?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isFounder || submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      
      let category = formData.get('category') as string
      if (category === 'Other') {
        category = formData.get('customCategory') as string
      }

      const projId = formData.get('project_id') as string
      const project_id = (expenseType === 'project' && projId && projId !== 'none') ? projId : null
      const chosenMethod = (formData.get('method') as string) || 'Bank Transfer'
      
      const newExpense: any = {
        category,
        project_id,
        amount: Number(formData.get('amount')),
        expense_date: formData.get('date') as string,
        payment_method: chosenMethod,
        notes: formData.get('notes') as string,
        is_recurring: formData.get('is_recurring') === 'on',
      }

      let res = await supabase
        .from('expenses')
        .insert([newExpense])
        .select('*, projects(name)')

      // Fallback if check constraint requires 'Bank' instead of 'Bank Transfer'
      if (res.error && res.error.message?.includes('payment_method_check') && chosenMethod === 'Bank Transfer') {
        newExpense.payment_method = 'Bank'
        res = await supabase
          .from('expenses')
          .insert([newExpense])
          .select('*, projects(name)')
      }

      const { data, error } = res

      if (error) {
        toast.error(error.message)
      } else if (data) {
        const updated = [data[0], ...expenses]
        setExpenses(updated)
        setCached('expenses', updated)
        invalidateCache('dashboard')
        invalidateCache('projects')
        invalidateCache('reports')
        setIsDialogOpen(false)
        setExpenseCategory('')
        toast.success('Expense recorded successfully')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to record expense')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleOpenEdit = (expense: any) => {
    setEditingExpense(expense)
    setEditCategory(expense.category || '')
    setIsEditDialogOpen(true)
  }

  const handleEditExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isFounder || !editingExpense || isSavingEdit) return
    setIsSavingEdit(true)

    try {
      const formData = new FormData(e.currentTarget)
      
      let category = formData.get('category') as string
      if (category === 'Other') {
        category = formData.get('customCategory') as string
      }
      const chosenMethod = (formData.get('method') as string) || 'Bank Transfer'

      const updates: any = {
        category,
        amount: Number(formData.get('amount')),
        expense_date: formData.get('date') as string,
        payment_method: chosenMethod,
        notes: formData.get('notes') as string,
        is_recurring: formData.get('is_recurring') === 'on',
      }

      let res = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', editingExpense.id)
        .select('*, projects(name)')

      if (res.error && res.error.message?.includes('payment_method_check') && chosenMethod === 'Bank Transfer') {
        updates.payment_method = 'Bank'
        res = await supabase
          .from('expenses')
          .update(updates)
          .eq('id', editingExpense.id)
          .select('*, projects(name)')
      }

      const { data, error } = res

      if (error) {
        toast.error(error.message)
      } else if (data && data.length > 0) {
        const updated = expenses.map(e => e.id === editingExpense.id ? data[0] : e)
        setExpenses(updated)
        setCached('expenses', updated)
        invalidateCache('dashboard')
        invalidateCache('projects')
        invalidateCache('reports')
        setIsEditDialogOpen(false)
        setEditingExpense(null)
        toast.success('Expense updated successfully')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update expense')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (isFounder) return
    if (!confirm('Are you sure you want to delete this expense?')) return

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error(error.message)
    } else {
      const updated = expenses.filter(e => e.id !== id)
      setExpenses(updated)
      setCached('expenses', updated)
      invalidateCache('dashboard')
      invalidateCache('projects')
      invalidateCache('reports')
      toast.success('Expense deleted successfully')
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground mt-1">Track company spending across various categories.</p>
        </div>
        
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button onClick={() => setIsDialogOpen(true)} variant="destructive" className="bg-destructive hover:bg-destructive/90" />}>
              <Plus className="mr-2 h-4 w-4" /> Add Expense
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Record Expense</DialogTitle>
              <DialogDescription>
                Add a new company expense to the ledger.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddExpense}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" required value={expenseCategory} onValueChange={(val) => val && setExpenseCategory(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="WiFi">WiFi</SelectItem>
                      <SelectItem value="Electricity">Electricity</SelectItem>
                      <SelectItem value="Water">Water</SelectItem>
                      <SelectItem value="Subscription">Subscription</SelectItem>
                      <SelectItem value="Travel">Travel</SelectItem>
                      <SelectItem value="Office">Office Supplies</SelectItem>
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
                <div className="grid gap-2">
                  <Label>Expense Type</Label>
                  <Select value={expenseType} onValueChange={(val) => val && setExpenseType(val as 'office' | 'project')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office">Office / General</SelectItem>
                      <SelectItem value="project">Project Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {expenseType === 'project' && (
                  <div className="grid gap-2">
                    <Label htmlFor="project_id">Project</Label>
                    <Select name="project_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" required placeholder="5000" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="method">Payment Method</Label>
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
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Reason or description for this expense" />
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="is_recurring" name="is_recurring" className="rounded border-gray-300" />
                  <Label htmlFor="is_recurring" className="font-normal text-sm">This is a recurring monthly expense</Label>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  variant="destructive" 
                  className="bg-destructive hover:bg-destructive/90 cursor-pointer"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Expense'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}

        {/* Edit Expense Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" /> Edit Expense
              </DialogTitle>
              <DialogDescription>
                Update the expense details below.
              </DialogDescription>
            </DialogHeader>
            {editingExpense && (
              <form onSubmit={handleEditExpense}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-category">Category</Label>
                    <Select name="category" required defaultValue={editingExpense.category} onValueChange={(val) => val && setEditCategory(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rent">Rent</SelectItem>
                        <SelectItem value="WiFi">WiFi</SelectItem>
                        <SelectItem value="Electricity">Electricity</SelectItem>
                        <SelectItem value="Water">Water</SelectItem>
                        <SelectItem value="Subscription">Subscription</SelectItem>
                        <SelectItem value="Travel">Travel</SelectItem>
                        <SelectItem value="Office">Office Supplies</SelectItem>
                        <SelectItem value="Project">Project Cost</SelectItem>
                        <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                        <SelectItem value="Other">Other...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editCategory === 'Other' && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-customCategory">Custom Category Name</Label>
                      <Input id="edit-customCategory" name="customCategory" required defaultValue={editingExpense.category} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-amount">Amount (₹)</Label>
                      <Input id="edit-amount" name="amount" type="number" required defaultValue={editingExpense.amount} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-date">Date</Label>
                      <Input id="edit-date" name="date" type="date" required defaultValue={editingExpense.expense_date} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-method">Payment Method</Label>
                    <Select name="method" required defaultValue={editingExpense.payment_method === 'Bank' ? 'Bank Transfer' : (editingExpense.payment_method || 'Bank Transfer')}>
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
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Textarea id="edit-notes" name="notes" defaultValue={editingExpense.notes || ''} placeholder="Reason or description" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="edit-is_recurring" name="is_recurring" defaultChecked={editingExpense.is_recurring} className="rounded border-gray-300" />
                    <Label htmlFor="edit-is_recurring" className="font-normal text-sm">This is a recurring monthly expense</Label>
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
                      'Save Changes'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2 flex-1 max-w-sm">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Search expenses..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" className="hidden sm:flex">
          <Filter className="mr-2 h-4 w-4" /> Filter
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <h3 className="text-xl font-semibold">Loading expenses...</h3>
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <div className="relative w-48 h-48 mb-4 opacity-80 grayscale">
            <Image src="/empty-state.png" alt="No expenses" fill className="object-contain" />
          </div>
          <h3 className="text-xl font-semibold">No expenses recorded</h3>
          <p className="text-muted-foreground mt-2 max-w-sm">Great! No expenses have been logged yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="bg-destructive/10 p-1.5 rounded-full">
                        <ArrowUpRight className="h-4 w-4 text-destructive" />
                      </div>
                      {expense.category}
                      {expense.is_recurring && <Badge variant="secondary" className="ml-2 text-[10px] h-5">Recurring</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{expense.projects?.name || 'Office'}</TableCell>
                  <TableCell>{expense.expense_date}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[200px]">{expense.notes}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {expense.payment_method === 'Bank' ? 'Bank Transfer' : expense.payment_method}
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    -₹{Number(expense.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleOpenEdit(expense)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Expense
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteExpense(expense.id)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
