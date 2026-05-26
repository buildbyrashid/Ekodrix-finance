'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'

// Dummy Data
export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      toast.error('Failed to load clients')
      console.error(error)
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const newClient = {
      name: formData.get('name') as string,
      contact_person: formData.get('contact_person') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
    }

    const { data, error } = await supabase
      .from('clients')
      .insert([newClient])
      .select()

    if (error) {
      toast.error(error.message)
    } else if (data) {
      setClients([data[0], ...clients])
      setIsDialogOpen(false)
      toast.success('Client added successfully')
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your company's clients and their contact information.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Add Client
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Enter the client's details below. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddClient}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input id="name" name="name" required placeholder="Acme Corp" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input id="contact_person" name="contact_person" required placeholder="John Doe" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input id="email" name="email" type="email" placeholder="john@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input id="phone" name="phone" placeholder="+91 98765 43210" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save Client</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input 
          placeholder="Search clients..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Loading clients...
                </TableCell>
              </TableRow>
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No clients found.
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {client.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {client.name}
                  </TableCell>
                  <TableCell>{client.contact_person}</TableCell>
                  <TableCell className="hidden md:table-cell">{client.email}</TableCell>
                  <TableCell className="hidden md:table-cell">{client.phone}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(client.email)}>
                          Copy Email
                        </DropdownMenuItem>
                        <DropdownMenuItem>View Projects</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete Client</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
