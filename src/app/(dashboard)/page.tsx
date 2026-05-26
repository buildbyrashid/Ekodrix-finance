'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banknote, CreditCard, Receipt, Wallet, TrendingUp, TrendingDown, FolderKanban, Loader2 } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, startOfWeek, startOfMonth, startOfYear, parseISO } from 'date-fns'

type Timeframe = 'week' | 'month' | 'year' | 'all'

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [timeframe, setTimeframe] = useState<Timeframe>('all')
  
  const [projects, setProjects] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [salaries, setSalaries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    setMounted(true)
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    const [projRes, payRes, expRes, salRes] = await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('payments').select('*, projects(name)'),
      supabase.from('expenses').select('*'),
      supabase.from('salaries').select('*')
    ])
    
    if (projRes.data) setProjects(projRes.data)
    if (payRes.data) setPayments(payRes.data)
    if (expRes.data) setExpenses(expRes.data)
    if (salRes.data) setSalaries(salRes.data)
    
    setLoading(false)
  }

  const getStartDate = () => {
    const now = new Date()
    switch (timeframe) {
      case 'week': return startOfWeek(now)
      case 'month': return startOfMonth(now)
      case 'year': return startOfYear(now)
      case 'all': return new Date(0)
    }
  }

  const startDate = getStartDate()

  const filteredProjects = projects.filter(p => parseISO(p.created_at).getTime() >= startDate.getTime())
  const filteredPayments = payments.filter(p => p.payment_date && parseISO(p.payment_date).getTime() >= startDate.getTime())
  const filteredExpenses = expenses.filter(e => e.expense_date && parseISO(e.expense_date).getTime() >= startDate.getTime())
  const filteredSalaries = salaries.filter(s => s.month_year && parseISO(s.month_year).getTime() >= startDate.getTime())

  const totalGrossValue = filteredProjects.reduce((sum, p) => sum + Number(p.total_value), 0)
  const filteredProjectExpenses = filteredProjects.reduce((sum, p) => {
    const projExp = expenses.filter(e => e.project_id === p.id).reduce((s, e) => s + Number(e.amount), 0)
    return sum + projExp
  }, 0)
  const totalValue = totalGrossValue - filteredProjectExpenses
  
  const received = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  
  const pending = projects.reduce((sum, p) => {
    const projPayments = payments.filter(pay => pay.project_id === p.id)
    const projReceived = projPayments.reduce((s, pay) => s + Number(pay.amount), 0)
    const projPending = Number(p.total_value) - projReceived
    return sum + (projPending > 0 ? projPending : 0)
  }, 0)
  
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0) + filteredSalaries.reduce((sum, s) => sum + Number(s.amount), 0)
  const currentBalance = received - totalExpenses

  const chartData = useMemo(() => {
    const formatStr = (timeframe === 'year' || timeframe === 'all') ? 'MMM' : 'MMM dd'
    const map = new Map<string, {name: string, received: number, expenses: number, timestamp: number}>()
    
    const addToMap = (dateStr: string, type: 'received'|'expenses', amount: number) => {
      if (!dateStr) return
      const d = parseISO(dateStr)
      if (d.getTime() < startDate.getTime()) return
      const key = format(d, formatStr)
      if (!map.has(key)) map.set(key, { name: key, received: 0, expenses: 0, timestamp: d.getTime() })
      map.get(key)![type] += amount
    }

    payments.forEach(p => addToMap(p.payment_date, 'received', Number(p.amount)))
    expenses.forEach(e => addToMap(e.expense_date, 'expenses', Number(e.amount)))
    salaries.forEach(s => addToMap(s.month_year, 'expenses', Number(s.amount)))

    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp)
  }, [payments, expenses, salaries, timeframe, startDate])

  const recentActivity = useMemo(() => {
    const activities = [
      ...payments.map(p => ({
        label: `Payment: ${p.projects?.name || 'Unknown'}`,
        amount: `+₹${Number(p.amount).toLocaleString()}`,
        time: new Date(p.created_at),
        type: 'income'
      })),
      ...expenses.map(e => ({
        label: `Expense: ${e.category}`,
        amount: `-₹${Number(e.amount).toLocaleString()}`,
        time: new Date(e.created_at),
        type: 'expense'
      })),
      ...salaries.map(s => ({
        label: `Salary: ${s.employee_name}`,
        amount: `-₹${Number(s.amount).toLocaleString()}`,
        time: new Date(s.created_at),
        type: 'expense'
      })),
      ...projects.map(p => ({
        label: `New Project: ${p.name}`,
        amount: `₹${Number(p.total_value).toLocaleString()}`,
        time: new Date(p.created_at),
        type: 'info'
      }))
    ]
    return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5).map(a => ({
      ...a,
      timeStr: format(a.time, 'MMM d, yyyy h:mm a')
    }))
  }, [payments, expenses, salaries, projects])

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <div className="w-48">
          <Select value={timeframe} onValueChange={(val) => val && setTimeframe(val as Timeframe)}>
            <SelectTrigger>
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net Project Value</CardTitle>
                <Banknote className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                  Based on timeframe
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Received</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">₹{received.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">₹{pending.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Total outstanding</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalExpenses.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-primary text-primary-foreground shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-primary-foreground/80">Net Cashflow</CardTitle>
                <Wallet className="h-4 w-4 text-primary-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{currentBalance.toLocaleString()}</div>
                <p className="text-xs text-primary-foreground/70 mt-1">
                  Received - Expenses
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Cashflow Trend</CardTitle>
              </CardHeader>
              <CardContent className="pl-0 h-[300px]">
                {mounted && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--color-foreground)' }}
                      />
                      <Area type="monotone" dataKey="received" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorReceived)" />
                      <Area type="monotone" dataKey="expenses" stroke="var(--color-destructive)" fillOpacity={1} fill="url(#colorExpenses)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No cashflow data for this timeframe.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {recentActivity.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">No recent activity.</div>
                  ) : (
                    recentActivity.map((activity, i) => (
                      <div key={i} className="flex items-center">
                        <div className={`mt-1 mr-4 h-9 w-9 rounded-full flex items-center justify-center ${
                          activity.type === 'income' ? 'bg-primary/10 text-primary' : 
                          activity.type === 'expense' ? 'bg-destructive/10 text-destructive' : 
                          'bg-accent text-accent-foreground'
                        }`}>
                          {activity.type === 'income' ? <TrendingUp className="h-4 w-4" /> : 
                          activity.type === 'expense' ? <TrendingDown className="h-4 w-4" /> : 
                          <FolderKanban className="h-4 w-4" />}
                        </div>
                        <div className="space-y-1 flex-1">
                          <p className="text-sm font-medium leading-none">{activity.label}</p>
                          <p className="text-sm text-muted-foreground">{activity.timeStr}</p>
                        </div>
                        <div className={`font-medium ${
                          activity.type === 'income' ? 'text-primary' : 
                          activity.type === 'expense' ? 'text-destructive' : ''
                        }`}>
                          {activity.amount}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
