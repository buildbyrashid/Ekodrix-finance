'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal, UserCircle, CheckCircle2, Clock, Banknote, Calendar, Mail } from 'lucide-react'
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
import { createBrowserClient } from '@supabase/ssr'

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<any[]>([])
  const [employeesList, setEmployeesList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formAmount, setFormAmount] = useState('10000')
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formEmployeeName, setFormEmployeeName] = useState('')

  // Modal employee selection states
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [formMonth, setFormMonth] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 7)
  })
  const [bypassMonthFilter, setBypassMonthFilter] = useState(false)

  // Filtering states
  const [filterType, setFilterType] = useState<'month' | 'range' | 'all'>('month')
  const [filterMonth, setFilterMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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
    const loadedSalaries = salariesData || []
    setSalaries(loadedSalaries)

    const { data: employeesData, error: employeesError } = await supabase.from('employees').select('*').order('name', { ascending: true })
    if (employeesError) toast.error('Failed to load employees')
    setEmployeesList(employeesData || [])

    // Set default month filter dynamically to the month of the last paid/recorded salary
    if (loadedSalaries.length > 0) {
      const latestPaid = loadedSalaries.find(s => s.payment_status === 'Paid') || loadedSalaries[0]
      if (latestPaid && latestPaid.month_year) {
        setFilterMonth(latestPaid.month_year.slice(0, 7))
      }
    } else {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      setFilterMonth(d.toISOString().slice(0, 7))
    }

    setLoading(false)
  }
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const uniqueMonths = Array.from(new Set(salaries.map(s => s.month_year?.slice(0, 7)))).filter(Boolean).sort().reverse() as string[]

  const filteredSalaries = salaries.filter(s => {
    // Search filter
    const matchesSearch = (
      s.employee_name?.toLowerCase().includes(search.toLowerCase()) || 
      s.role?.toLowerCase().includes(search.toLowerCase())
    )
    if (!matchesSearch) return false

    // Date/Month filters
    if (filterType === 'month') {
      return filterMonth === 'all' || s.month_year?.startsWith(filterMonth)
    } else if (filterType === 'range') {
      const paymentDate = s.payment_date || s.created_at?.slice(0, 10)
      if (!paymentDate) return false
      if (startDate && paymentDate < startDate) return false
      if (endDate && paymentDate > endDate) return false
      return true
    }
    
    // 'all' type (All Time)
    return true
  })

  const handleEmployeeChange = (empId: string | null) => {
    if (!empId) return;
    const emp = employeesList.find((e: any) => e.id === empId)
    if (emp) {
      setFormEmployeeId(emp.id)
      setFormEmployeeName(emp.name)
      setFormEmail(emp.email || '')
      setFormRole(emp.role || '')
      setFormAmount(emp.salary && Number(emp.salary) > 0 ? emp.salary.toString() : '10000')
    }
  }

  // Filter employees for the Add Salary form dropdown
  const filteredEmployeesForForm = employeesList.filter(emp => {
    if (employeeSearch && !emp.name.toLowerCase().includes(employeeSearch.toLowerCase())) {
      return false
    }
    
    if (bypassMonthFilter || !formMonth) return true
    
    const targetMonthYear = `${formMonth}-01`
    const hasRecord = salaries.some(s => s.employee_id === emp.id && s.month_year === targetMonthYear)
    return !hasRecord
  })

  const totalSpentAllTime = salaries
    .filter(s => s.payment_status === 'Paid')
    .reduce((sum, s) => sum + Number(s.amount), 0)

  const filteredSpent = filteredSalaries
    .filter(s => s.payment_status === 'Paid')
    .reduce((sum, s) => sum + Number(s.amount), 0)

  // Calculate last payment date
  const latestPayment = salaries
    .filter(s => s.payment_status === 'Paid' && s.payment_date)
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0]

  const lastPaymentDate = latestPayment 
    ? new Date(latestPayment.payment_date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) 
    : '-'

  let card1Title = "All-Time Spent"
  let card1Desc = "Total paid payroll history"

  let card2Title = "Current Spent"
  let card2Desc = "Paid in selected view"

  if (filterType === 'month' && filterMonth && filterMonth !== 'all') {
    const formattedMonth = new Date(filterMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    card2Title = `${formattedMonth} Spent`
    card2Desc = `Paid salaries for ${formattedMonth}`
  } else if (filterType === 'range') {
    card2Title = "Range Spent"
    card2Desc = "Paid salaries in date range"
  } else {
    card2Title = "Total Paid"
    card2Desc = "Paid salaries overall"
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
      
      // Reset form search/selection states
      setEmployeeSearch('')
      setFormEmployeeId('')
      setFormEmployeeName('')
      setFormEmail('')
      setFormRole('')
      setFormAmount('10000')
      
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

  const handleSendReceipt = async (id: string) => {
    const toastId = toast.loading('Sending receipt...')
    
    try {
      const response = await fetch('/api/salaries/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salaryId: id, resend: true })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send receipt')
      }
      
      // Update local state by replacing the receipt status and details
      setSalaries(currentSalaries => 
        currentSalaries.map(s => s.id === id ? { 
          ...s, 
          receipt_sent: result.emailSent,
          receipt_sent_at: result.emailSent ? new Date().toISOString() : s.receipt_sent_at,
          receipt_number: result.salary.receipt_number || s.receipt_number
        } : s)
      )
      
      if (result.emailSent) {
        toast.success('Receipt sent successfully.', { id: toastId })
      } else {
        toast.error(result.emailError ? `Failed to send email: ${result.emailError}` : 'Failed to send email.', { id: toastId })
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
                <div className="grid gap-2 relative">
                  <Label htmlFor="employee_select">Employee Name</Label>
                  <div className="relative">
                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <span>{formEmployeeName || "Select an employee..."}</span>
                      <span className="text-muted-foreground text-xs">▼</span>
                    </button>
                    
                    {isDropdownOpen && (
                      <div className="absolute top-11 left-0 z-50 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 p-1 max-h-[220px] overflow-hidden flex flex-col">
                        <Input
                          placeholder="Search employee..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="mb-1 h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
                          autoFocus
                        />
                        <div className="overflow-y-auto flex-1 space-y-0.5">
                          {filteredEmployeesForForm.length === 0 ? (
                            <div className="py-2 text-center text-xs text-muted-foreground">No employees found.</div>
                          ) : (
                            filteredEmployeesForForm.map(emp => (
                              <button
                                key={emp.id}
                                type="button"
                                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground flex flex-col"
                                onClick={() => {
                                  handleEmployeeChange(emp.id)
                                  setIsDropdownOpen(false)
                                  setEmployeeSearch('')
                                }}
                              >
                                <span className="font-semibold">{emp.name}</span>
                                <span className="text-[10px] text-muted-foreground">{emp.role || "No Role"}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Bypass checkbox */}
                  <div className="flex items-center space-x-2 mt-0.5">
                    <input 
                      type="checkbox" 
                      id="bypass_filter" 
                      checked={bypassMonthFilter} 
                      onChange={(e) => setBypassMonthFilter(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <Label htmlFor="bypass_filter" className="text-[11px] text-muted-foreground cursor-pointer select-none">
                      Show employees already paid/recorded for this month
                    </Label>
                  </div>
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
                    <Input id="month" name="month" type="month" required value={formMonth} onChange={e => setFormMonth(e.target.value)} />
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

      {!loading && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card2Title}</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{filteredSpent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{card2Desc}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card1Title}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalSpentAllTime.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{card1Desc}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Last Paid On</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{lastPaymentDate}</div>
              <p className="text-xs text-muted-foreground mt-1">Latest salary payment date</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
        <div className="flex items-center space-x-2 w-full sm:w-auto flex-1 max-w-sm">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Search employees or roles..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        
        {/* Filter Type Toggle */}
        <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Filter Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month Wise</SelectItem>
            <SelectItem value="range">Date Range</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        {/* Dynamic Month Filter */}
        {filterType === 'month' && (
          <Select value={filterMonth} onValueChange={(val) => val && setFilterMonth(val)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {uniqueMonths.map(month => (
                <SelectItem key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Dynamic Date Range Filter */}
        {filterType === 'range' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-full sm:w-[140px]" 
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-full sm:w-[140px]" 
            />
          </div>
        )}
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
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit text-primary border-primary bg-primary/10">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
                        </Badge>
                        {salary.receipt_sent ? (
                          <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Receipt Sent
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-destructive flex items-center gap-1 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
                              Failed / Not Sent
                            </span>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-5 px-1.5 text-[9px] text-primary hover:text-primary-foreground hover:bg-primary border-primary/20"
                              onClick={() => handleSendReceipt(salary.id)}
                            >
                              <Mail className="mr-0.5 h-2.5 w-2.5" /> Send
                            </Button>
                          </div>
                        )}
                      </div>
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
                          <>
                            <DropdownMenuItem onClick={() => handleSendReceipt(salary.id)}>
                              {salary.receipt_sent ? 'Resend Receipt' : 'Send Receipt'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/receipts/${salary.id}`, '_blank')}>
                              Download Receipt
                            </DropdownMenuItem>
                          </>
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
