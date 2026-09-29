'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  FolderKanban, 
  CreditCard, 
  Receipt, 
  Banknote,
  LineChart,
  FileText,
  LogOut,
  Moon,
  Sun,
  UserPlus,
  Eye,
  ShieldCheck,
  User
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '@/lib/auth-context'

const allNavItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Reports', href: '/reports', icon: LineChart },
  { name: 'Employees', href: '/employees', icon: UserPlus, adminOnly: true },
  { name: 'Salaries', href: '/salaries', icon: Banknote, adminOnly: true },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)
  const { user, profile, isAdmin, isFounder } = useAuth()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Filter navigation items: strictly hide salaries and employees for founders
  const navItems = allNavItems.filter((item) => {
    if (isFounder && item.adminOnly) {
      return false
    }
    return true
  })

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card/50 backdrop-blur-xl">
        <div className="flex flex-col border-b px-5 py-4 gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 relative bg-primary/10 rounded-lg flex items-center justify-center p-1">
              <Image src="/logo.png" alt="Logo" fill sizes="32px" className="object-contain p-1" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg leading-tight tracking-tight">Ekodrix</span>
              <span className="text-[11px] text-muted-foreground">Finance Management</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-5 px-3">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary font-semibold' 
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* User Status Card */}
        <div className="px-4 py-2">
          <div className="rounded-lg bg-accent/40 p-2.5 flex items-center gap-2.5 border border-border/50">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-foreground">
                {user?.email || (isFounder ? 'founder@ekodrix.com' : 'admin@ekodrix.com')}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {isFounder ? 'Founder' : 'Administrator'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t p-3 pb-16 flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="justify-start text-muted-foreground hover:text-foreground text-xs" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {mounted ? (theme === 'dark' ? <Sun className="mr-2 h-3.5 w-3.5 text-amber-400" /> : <Moon className="mr-2 h-3.5 w-3.5 text-blue-400" />) : <div className="mr-2 h-3.5 w-3.5" />}
            {mounted ? (theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode') : 'Toggle Theme'}
          </Button>
          <Button variant="ghost" size="sm" className="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive text-xs" onClick={handleLogout}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full pb-16 md:pb-0 h-screen overflow-hidden">
        {/* Desktop Top Header Bar for Theme Switcher & Actions */}
        <header className="hidden md:flex h-14 items-center justify-between border-b px-8 bg-card/30 backdrop-blur-md">
          <div className="text-xs font-medium text-muted-foreground">
            Ekodrix Finance
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-xs border-border/60 hover:bg-accent cursor-pointer"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {mounted && theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span>White Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-blue-400" />
                  <span>Dark Mode</span>
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden flex h-14 items-center justify-between border-b px-4 bg-card/50 backdrop-blur-xl z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 relative bg-primary/10 rounded">
              <Image src="/logo.png" alt="Logo" fill sizes="24px" className="object-contain p-0.5" />
            </div>
            <span className="font-semibold text-sm">Ekodrix</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
               {mounted ? (theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-400" />) : <div className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t bg-card/90 backdrop-blur-xl z-50 flex items-center justify-around px-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
