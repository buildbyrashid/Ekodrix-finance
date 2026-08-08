'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function fetchInvoice() {
      const [invRes, payRes] = await Promise.all([
        supabase.from('invoices').select('*, projects(name, client_name, project_type, clients(name))').eq('id', id).single(),
        supabase.from('payments').select('amount').eq('invoice_id', id)
      ])

      if (invRes.data) {
        setInvoice(invRes.data)
      }
      if (payRes.data) {
        setPayments(payRes.data)
      }
      setLoading(false)
    }
    fetchInvoice()
  }, [id])

  useEffect(() => {
    if (invoice?.invoice_number) {
      document.title = `Ekodrix-Invoice-${invoice.invoice_number}`
    }
    return () => {
      document.title = 'Ekodrix Finance | Dashboard'
    }
  }, [invoice])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Invoice Not Found</h1>
          <p className="text-gray-500">The requested invoice does not exist or has been removed.</p>
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    )
  }

  const clientName = invoice.client_name || invoice.projects?.client_name || invoice.projects?.clients?.name || 'Valued Client'
  const projectName = invoice.projects?.name || 'N/A'

  const totalPaidAgainstInvoice = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const invoiceAmount = Number(invoice.amount)
  const amountDue = Math.max(0, invoiceAmount - totalPaidAgainstInvoice)

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: portrait;
          }
          body {
            margin: 0 !important;
            padding: 1.2cm !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans print:bg-white print:p-0 print:min-h-0 print:m-0">
      <div className="max-w-3xl mx-auto space-y-4 print:space-y-0 print:max-w-none print:w-full">
        {/* Controls - Hidden during print */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={() => window.print()} className="shadow-sm">
            <Printer className="mr-2 h-4 w-4" /> Save as PDF / Print
          </Button>
        </div>

        {/* Invoice Paper */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none p-8 sm:p-12 space-y-8 print:p-4 print:space-y-5">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b pb-6 gap-6">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 shadow-sm">
                <Image src="/ekodrix-logo.png" alt="Ekodrix Logo" fill className="object-cover object-left" priority />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 leading-none">EKODRIX</h2>
                <p className="text-xs font-bold text-primary uppercase tracking-wider mt-1">BUSINESS SOLUTIONS</p>
              </div>
            </div>
            <div className="text-left sm:text-right space-y-1">
              <h1 className="text-3xl font-extrabold text-primary tracking-tight">INVOICE</h1>
              <p className="text-sm font-semibold text-gray-700">#{invoice.invoice_number}</p>
              <div className="pt-2 text-xs text-gray-500 space-y-0.5">
                <p><span className="font-medium text-gray-700">Invoice Date:</span> {new Date(invoice.invoice_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
          </div>

          {/* Billed To & Project info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-100">
            <div>
              <p className="text-xs uppercase font-bold text-gray-400 tracking-wider">Billed To</p>
              <p className="text-base font-bold text-gray-900 mt-1">{clientName}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-gray-400 tracking-wider">Project Reference</p>
              <p className="text-base font-semibold text-gray-800 mt-1">{projectName}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-gray-700 text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                <tr>
                  <td className="py-4 px-4">
                    <p className="font-medium text-gray-900">{invoice.description || (invoice.projects?.project_type ? `${invoice.projects.project_type} Services` : 'Software Development & Consulting Services')}</p>
                    {invoice.notes && <p className="text-xs text-gray-500 mt-1">{invoice.notes}</p>}
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-gray-900">
                    ₹{invoiceAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-sm py-1 border-b">
                <span className="text-gray-500">Invoice Total:</span>
                <span className="font-semibold text-gray-900">₹{invoiceAmount.toLocaleString('en-IN')}</span>
              </div>
              {totalPaidAgainstInvoice > 0 && (
                <div className="flex justify-between text-sm py-1 border-b">
                  <span className="text-gray-500">Amount Received:</span>
                  <span className="font-semibold text-emerald-600">₹{totalPaidAgainstInvoice.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-base py-2 font-bold bg-primary/5 px-3 rounded text-primary">
                <span>Amount Due:</span>
                <span>₹{amountDue.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Footer Notes */}
          <div className="border-t pt-6 text-center text-xs text-gray-400 space-y-1">
            <p className="font-medium text-gray-600">Thank you for choosing Ekodrix Business Solutions!</p>
            <p>If you have any questions regarding this invoice, please reach out to our accounts team.</p>
          </div>

        </div>
      </div>
    </div>
    </>
  )
}
