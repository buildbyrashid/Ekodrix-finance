'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal, ArrowUpRight, Filter } from 'lucide-react'
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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expenseType, setExpenseType] = useState<'office' | 'project'>('office')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [expRes, projRes] = await Promise.all([
      supabase.from('expenses').select('*, projects(name)').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name').order('name', { ascending: true })
    ])
    if (expRes.error) toast.error('Failed to load expenses')
    setExpenses(expRes.data || [])
    setProjects(projRes.data || [])
    setLoading(false)
  }
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('')

  const filteredExpenses = expenses.filter(e => 
    e.category.toLowerCase().includes(search.toLowerCase()) || 
    e.notes.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    let category = formData.get('category') as string
    if (category === 'Other') {
      category = formData.get('customCategory') as string
    }
    
    const newExpense = {
      category,
      project_id: expenseType === 'project' ? formData.get('project_id') : null,
      amount: Number(formData.get('amount')),
      expense_date: formData.get('date') as string,
      payment_method: formData.get('method') as string,
      notes: formData.get('notes') as string,
      is_recurring: formData.get('is_recurring') === 'on',
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert([newExpense])
      .select('*, projects(name)')

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setExpenses([data[0], ...expenses])
      setIsDialogOpen(false)
      toast.success('Expense recorded successfully')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error(error.message)
    } else {
      setExpenses(expenses.filter(e => e.id !== id))
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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button variant="destructive" className="bg-destructive hover:bg-destructive/90" />}>
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
                    <Input id="date" name="date" type="date" required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="method">Payment Method</Label>
                  <Select name="method" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
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
                <Button type="submit" variant="destructive" className="bg-destructive hover:bg-destructive/90">Save Expense</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search expenses..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
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
                  <TableCell className="text-muted-foreground">{expense.payment_method}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    -₹{Number(expense.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>Edit Expense</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteExpense(expense.id)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
