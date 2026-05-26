'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  CreditCard, 
  Receipt, 
  Banknote,
  LineChart,
  Settings,
  LogOut,
  Menu,
  Moon,
  Sun
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Salaries', href: '/salaries', icon: Banknote },
  { name: 'Reports', href: '/reports', icon: LineChart },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card/50 backdrop-blur-xl">
        <div className="flex h-16 shrink-0 items-center px-6 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 relative bg-primary/10 rounded-lg flex items-center justify-center p-1">
              <Image src="/logo.png" alt="Logo" fill sizes="32px" className="object-contain p-1" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Ekodrix</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary' 
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

        <div className="border-t p-4 flex flex-col gap-2">
          <Button variant="ghost" className="justify-start text-muted-foreground hover:text-foreground" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {mounted ? (theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />) : <div className="mr-2 h-4 w-4" />}
            Toggle Theme
          </Button>
          <Button variant="ghost" className="justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full pb-16 md:pb-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex h-14 items-center justify-between border-b px-4 bg-card/50 backdrop-blur-xl z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 relative bg-primary/10 rounded">
              <Image src="/logo.png" alt="Logo" fill sizes="24px" className="object-contain p-0.5" />
            </div>
            <span className="font-semibold">Ekodrix</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
             {mounted ? (theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <div className="h-4 w-4" />}
          </Button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t bg-card/80 backdrop-blur-xl z-50 flex items-center justify-around px-2">
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
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
