'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download, Filter, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, PieChart, Pie, Cell } from 'recharts'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'
import { format, parseISO } from 'date-fns'

const COLORS = ['var(--color-primary)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)']

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [projects, setProjects] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [salaries, setSalaries] = useState<any[]>([])
  
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  useEffect(() => {
    setMounted(true)
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [projRes, payRes, expRes, salRes] = await Promise.all([
      supabase.from('projects').select('*, clients(name)'),
      supabase.from('payments').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('salaries').select('*')
    ])
    
    if (projRes.data) setProjects(projRes.data)
    if (payRes.data) setPayments(payRes.data)
    if (expRes.data) setExpenses(expRes.data)
    if (salRes.data) setSalaries(salRes.data)
    setLoading(false)
  }

  const handleExport = (type: 'CSV' | 'PDF') => {
    toast.success(`Exporting report as ${type}...`)
  }

  const monthlyData = useMemo(() => {
    const map = new Map<string, {name: string, income: number, expenses: number}>()
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    months.forEach(m => map.set(m, { name: m, income: 0, expenses: 0 }))
    
    payments.forEach(p => {
      if(!p.payment_date) return;
      const d = parseISO(p.payment_date)
      if (d.getFullYear().toString() === yearFilter) {
        const m = format(d, 'MMM')
        if (map.has(m)) map.get(m)!.income += Number(p.amount)
      }
    })
    
    expenses.forEach(e => {
      if(!e.expense_date) return;
      const d = parseISO(e.expense_date)
      if (d.getFullYear().toString() === yearFilter) {
        const m = format(d, 'MMM')
        if (map.has(m)) map.get(m)!.expenses += Number(e.amount)
      }
    })
    
    salaries.forEach(s => {
      if(!s.month_year) return;
      const d = parseISO(s.month_year)
      if (d.getFullYear().toString() === yearFilter) {
        const m = format(d, 'MMM')
        if (map.has(m)) map.get(m)!.expenses += Number(s.amount)
      }
    })

    return Array.from(map.values())
  }, [payments, expenses, salaries, yearFilter])
  
  const expenseCategories = useMemo(() => {
    const map = new Map<string, number>()
    
    expenses.forEach(e => {
      if(!e.expense_date) return;
      const d = parseISO(e.expense_date)
      if (d.getFullYear().toString() === yearFilter) {
        map.set(e.category, (map.get(e.category) || 0) + Number(e.amount))
      }
    })
    
    salaries.forEach(s => {
      if(!s.month_year) return;
      const d = parseISO(s.month_year)
      if (d.getFullYear().toString() === yearFilter) {
        map.set('Salaries', (map.get('Salaries') || 0) + Number(s.amount))
      }
    })
    
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [expenses, salaries, yearFilter])

  const pendingReceivables = useMemo(() => {
    return projects.map(proj => {
      const projPayments = payments.filter(p => p.project_id === proj.id)
      const received = projPayments.reduce((sum, p) => sum + Number(p.amount), 0)
      const pending = Number(proj.total_value) - received
      return { ...proj, pending }
    }).filter(p => p.pending > 0)
  }, [projects, payments])
  
  const totalIncome = monthlyData.reduce((sum, item) => sum + item.income, 0)
  const totalExpenses = monthlyData.reduce((sum, item) => sum + item.expenses, 0)
  const netProfit = totalIncome - totalExpenses

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">Generate and export comprehensive financial summaries.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('CSV')}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button onClick={() => handleExport('PDF')}>
            <Download className="mr-2 h-4 w-4" /> PDF Report
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card/50 p-4 rounded-lg border backdrop-blur-sm">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          <Select value={yearFilter} onValueChange={(val) => val && setYearFilter(val)}>
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Profit & Loss</TabsTrigger>
            <TabsTrigger value="expenses">Expense Breakdown</TabsTrigger>
            <TabsTrigger value="receivables">Pending Receivables</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Income ({yearFilter})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">₹{totalIncome.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses ({yearFilter})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">₹{totalExpenses.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Net Profit ({yearFilter})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    ₹{netProfit.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses (Monthly)</CardTitle>
                <CardDescription>A month-by-month comparison of your cashflow in {yearFilter}.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--color-foreground)' }}
                      />
                      <Legend />
                      <Bar dataKey="income" name="Income" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Expense Categories</CardTitle>
                <CardDescription>Where your company is spending money in {yearFilter}.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                {mounted && expenseCategories.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie
                        data={expenseCategories}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {expenseCategories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--color-foreground)' }}
                        formatter={(value: any) => `₹${Number(value).toLocaleString()}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground">No expenses recorded for this year.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receivables">
            <Card>
              <CardHeader>
                <CardTitle>Pending Receivables</CardTitle>
                <CardDescription>Clients who still owe you money for completed or ongoing projects.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingReceivables.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No pending receivables. All good!</div>
                  ) : (
                    pendingReceivables.map(proj => (
                      <div key={proj.id} className="flex justify-between items-center p-4 border rounded-lg bg-accent/20">
                        <div>
                          <div className="font-semibold text-lg">{proj.clients?.name || 'Unknown Client'}</div>
                          <div className="text-sm text-muted-foreground">{proj.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-destructive text-lg">₹{proj.pending.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            Due: {proj.due_date ? new Date(proj.due_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
