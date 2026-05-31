'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2, Printer } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function SalaryReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const [salary, setSalary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function fetchSalary() {
      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .eq('id', id)
        .single()
      
      if (data) {
        setSalary(data)
      }
      setLoading(false)
    }
    fetchSalary()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!salary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Receipt Not Found</h1>
          <p className="text-gray-500">The requested salary receipt does not exist or has been deleted.</p>
        </div>
      </div>
    )
  }

  const salaryMonth = new Date(salary.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const formattedAmount = `₹${Number(salary.amount).toLocaleString('en-IN')}`
  
  let formattedPaymentDate = 'N/A'
  if (salary.payment_date) {
    const paymentDateObj = new Date(salary.payment_date)
    formattedPaymentDate = paymentDateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans print:bg-white print:p-0">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Print Controls - Hidden during print */}
        <div className="flex justify-end print:hidden">
          <Button onClick={() => window.print()} className="shadow-sm">
            <Printer className="mr-2 h-4 w-4" /> Save as PDF / Print
          </Button>
        </div>

        {/* Receipt Paper */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
          {/* Header */}
          <div className="bg-slate-900 px-8 py-8 text-center border-b-4 border-green-600 print:bg-slate-900 print:text-white print:break-inside-avoid">
            <div className="flex justify-center mb-4">
              <div className="relative w-48 h-12">
                <Image src="/ekodrix-logo.png" alt="Ekodrix Logo" fill className="object-contain" priority />
              </div>
            </div>
            <h1 className="text-white text-2xl font-semibold tracking-wide m-0">SALARY PAYMENT RECEIPT</h1>
          </div>

          {/* Body */}
          <div className="px-8 py-10 print:break-inside-avoid">
            <p className="text-gray-700 text-lg m-0">Dear <strong>{salary.employee_name}</strong>,</p>
            <p className="text-gray-500 mt-2 mb-8 leading-relaxed">
              We are pleased to inform you that your salary for <strong>{salaryMonth}</strong> has been successfully processed and credited to your account.
            </p>
            
            {/* Details Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8 print:bg-slate-50">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="py-2 text-gray-500 text-sm">Receipt No:</td>
                    <td className="py-2 text-gray-900 text-sm font-semibold text-right">{salary.receipt_number || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 text-sm">Role:</td>
                    <td className="py-2 text-gray-900 text-sm font-semibold text-right">{salary.role || 'Employee'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 text-sm">Payment Date:</td>
                    <td className="py-2 text-gray-900 text-sm font-semibold text-right">{formattedPaymentDate}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-500 text-sm">Status:</td>
                    <td className="py-2 text-green-600 text-sm font-bold text-right uppercase">{salary.payment_status}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border-b border-dashed border-slate-300 pt-4 mb-4"></td>
                  </tr>
                  <tr>
                    <td className="pt-5 text-gray-700 text-lg font-semibold">Net Amount Credited:</td>
                    <td className="pt-5 text-green-600 text-2xl font-extrabold text-right">{formattedAmount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-100 px-8 py-6 text-center border-t border-slate-200 print:bg-slate-100 print:break-inside-avoid">
            <p className="text-slate-700 font-medium text-sm m-0 mb-3">Thank you for your contribution.</p>
            <p className="text-gray-500 text-sm m-0">This is a system-generated salary receipt from <strong>Ekodrix Business Solutions</strong>.</p>
            <p className="text-gray-400 text-xs mt-2 m-0">
              Generated on {salary.receipt_sent_at ? new Date(salary.receipt_sent_at).toLocaleString() : new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
