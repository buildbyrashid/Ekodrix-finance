'use client'

import Image from 'next/image'
import { useState } from 'react'
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    const result = await login(formData)
    
    if (result?.error) {
      toast.error('Login Failed', {
        description: result.error,
      })
      setIsLoading(false)
    }
    // If successful, the action will redirect
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Abstract background shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="z-10 w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-16 w-16 relative bg-white/10 p-2 rounded-2xl shadow-xl border border-white/20 backdrop-blur-md">
             <Image src="/logo.png" alt="Ekodrix Finance" fill className="object-contain p-2" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Ekodrix Finance</h1>
            <p className="text-sm text-muted-foreground mt-1">Founders Dashboard</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-2xl backdrop-blur-xl bg-card/80">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <form action={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@ekodrix.com"
                  required
                  className="bg-background/50 border-border/50 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="bg-background/50 border-border/50 focus-visible:ring-primary"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground">
          Protected by industry-standard encryption.
        </p>
      </div>
    </div>
  )
}
