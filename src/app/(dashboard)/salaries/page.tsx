'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal, UserCircle, CheckCircle2, Clock } from 'lucide-react'
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

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<any[]>([])
  const [employeesList, setEmployeesList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formEmployeeName, setFormEmployeeName] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: salariesData, error: salariesError } = await supabase.from('salaries').select('*').order('created_at', { ascending: false })
    if (salariesError) toast.error('Failed to load salaries')
    setSalaries(salariesData || [])

    const { data: employeesData, error: employeesError } = await supabase.from('employees').select('*').order('name', { ascending: true })
    if (employeesError) toast.error('Failed to load employees')
    setEmployeesList(employeesData || [])

    setLoading(false)
  }
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredSalaries = salaries.filter(s => 
    s.employee_name?.toLowerCase().includes(search.toLowerCase()) || 
    s.role?.toLowerCase().includes(search.toLowerCase())
  )

  const handleEmployeeChange = (empId: string) => {
    const emp = employeesList.find((e: any) => e.id === empId)
    if (emp) {
      setFormEmployeeId(emp.id)
      setFormEmployeeName(emp.name)
      setFormEmail(emp.email || '')
      setFormRole(emp.role || '')
      setFormAmount(emp.salary ? emp.salary.toString() : '0')
    }
  }

  const handleAddSalary = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const statusInput = formData.get('status') as string
    
    const newSalary = {
      employee_id: formEmployeeId || null,
      employee_name: formEmployeeName || (formData.get('employee') as string),
      employee_email: formData.get('employee_email') as string,
      role: formData.get('role') as string,
      amount: Number(formData.get('amount')),
      month_year: formData.get('month') + '-01',
      payment_status: 'Pending', // Always create as Pending first to allow API to process payment securely
      payment_date: formData.get('payment_date') as string || null,
    }

    const { data, error } = await supabase
      .from('salaries')
      .insert([newSalary])
      .select()

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setIsDialogOpen(false)
      
      // If user selected Paid, process the payment immediately via our API
      if (statusInput === 'Paid') {
        toast.success('Record created. Processing payment receipt...')
        await markAsPaid(data[0].id)
      } else {
        setSalaries([data[0], ...salaries])
        toast.success('Salary record added successfully')
      }
    }
  }

  const markAsPaid = async (id: string) => {
    const toastId = toast.loading('Processing payment and sending receipt...')
    
    try {
      const response = await fetch('/api/salaries/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salaryId: id })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process payment')
      }
      
      // Update local state by replacing or prepending
      setSalaries(currentSalaries => {
        const exists = currentSalaries.find(s => s.id === id)
        const updatedRecord = { 
          ...(exists || result.salary), 
          payment_status: 'Paid', 
          payment_date: result.salary.payment_date,
          receipt_number: result.salary.receipt_number,
          receipt_sent: result.emailSent
        }
        
        if (exists) {
          return currentSalaries.map(s => s.id === id ? updatedRecord : s)
        } else {
          return [updatedRecord, ...currentSalaries]
        }
      })
      
      if (result.emailSent) {
        toast.success('Salary marked as paid and receipt emailed successfully.', { id: toastId })
      } else {
        toast.warning('Salary marked as paid but receipt email could not be delivered.', { id: toastId })
      }
      
    } catch (error: any) {
      toast.error(error.message || 'An error occurred', { id: toastId })
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salaries</h1>
          <p className="text-muted-foreground mt-1">Manage team payroll and track salary payments.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Add Record
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Salary Record</DialogTitle>
              <DialogDescription>
                Create a new payroll record for an employee.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSalary}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="employee_select">Employee Name</Label>
                  <Select name="employee_select" onValueChange={handleEmployeeChange} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesList.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} (ID: {emp.id.split('-')[0]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Hidden input to allow traditional form behavior if needed, though we rely on state in the handler */}
                  <input type="hidden" name="employee" value={formEmployeeName} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="employee_email">Employee Email</Label>
                  <Input id="employee_email" name="employee_email" type="email" required placeholder="alice@example.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" name="role" required placeholder="e.g. Frontend Engineer" value={formRole} onChange={e => setFormRole(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" required placeholder="50000" value={formAmount} onChange={e => setFormAmount(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="month">Month</Label>
                    <Input id="month" name="month" type="month" required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue="Pending" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payment_date">Payment Date (if paid)</Label>
                  <Input id="payment_date" name="payment_date" type="date" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save Record</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input 
          placeholder="Search employees or roles..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <h3 className="text-xl font-semibold">Loading salaries...</h3>
        </div>
      ) : salaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-card/50">
          <div className="relative w-48 h-48 mb-4 opacity-80">
            <Image src="/empty-state.png" alt="No salaries" fill className="object-contain grayscale" />
          </div>
          <h3 className="text-xl font-semibold">No salary records</h3>
          <p className="text-muted-foreground mt-2 max-w-sm">Start tracking your team's payroll by adding a record.</p>
        </div>
      ) : (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSalaries.map((salary) => (
                <TableRow key={salary.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      {salary.employee_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{salary.role}</TableCell>
                  <TableCell>
                    {new Date(salary.month_year).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    {salary.receipt_number && (
                      <div className="text-xs text-muted-foreground mt-1">{salary.receipt_number}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">₹{salary.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    {salary.payment_status === 'Paid' ? (
                      <Badge variant="outline" className="text-primary border-primary bg-primary/10">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-accent text-accent-foreground">
                        <Clock className="mr-1 h-3 w-3" /> Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {salary.payment_date || '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        {salary.payment_status === 'Pending' && (
                          <DropdownMenuItem onClick={() => markAsPaid(salary.id)}>Mark as Paid</DropdownMenuItem>
                        )}
                        {salary.payment_status === 'Paid' && (
                          <DropdownMenuItem onClick={() => window.open(`/receipts/${salary.id}`, '_blank')}>
                            Download Receipt
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>Edit Record</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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
