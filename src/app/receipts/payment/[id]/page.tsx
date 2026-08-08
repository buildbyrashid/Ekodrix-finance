'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2, Printer, ArrowLeft, Check, Phone, Mail, Globe } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function PaymentReceiptPrintPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [payment, setPayment] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [allProjectPayments, setAllProjectPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function fetchReceiptData() {
      // 1. Fetch current payment
      const { data: payData } = await supabase
        .from('payments')
        .select('*, projects(*)')
        .eq('id', id)
        .single()

      if (payData) {
        setPayment(payData)
        const projId = payData.project_id

        // 2. Fetch project with client join & all payments ordered by date to compute dynamic totals & sequence
        const [projRes, allPayRes] = await Promise.all([
          supabase.from('projects').select('*, clients(name)').eq('id', projId).single(),
          supabase.from('payments').select('id, amount, created_at').eq('project_id', projId).order('created_at', { ascending: true })
        ])

        if (projRes.data) setProject(projRes.data)
        if (allPayRes.data) setAllProjectPayments(allPayRes.data)
      }

      setLoading(false)
    }
    fetchReceiptData()
  }, [id])

  // Format Receipt No e.g. REC-2026-015, REC-2026-016...
  const paymentDateObj = payment?.payment_date ? new Date(payment.payment_date) : new Date()
  const receiptYear = paymentDateObj.getFullYear()
  const paymentIndex = allProjectPayments.findIndex(p => p?.id === payment?.id)
  const seqNumber = paymentIndex >= 0 ? 15 + paymentIndex : 15
  const receiptNumberStr = `REC-${receiptYear}-${String(seqNumber).padStart(3, '0')}`

  useEffect(() => {
    if (payment) {
      document.title = `Ekodrix-Receipt-${receiptNumberStr}`
    }
    return () => {
      document.title = 'Ekodrix Finance | Dashboard'
    }
  }, [payment, receiptNumberStr])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!payment || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Receipt Not Found</h1>
          <p className="text-gray-500">The requested payment receipt does not exist or has been deleted.</p>
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    )
  }

  const clientName = project.client_name || project.clients?.name || 'Valued Client'
  const projectValue = Number(project.total_value)
  const totalReceived = allProjectPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const remainingBalance = Math.max(0, projectValue - totalReceived)
  const paymentAmount = Number(payment.amount)

  let paymentStatusStr = 'PARTIALLY PAID'
  if (totalReceived >= projectValue) {
    paymentStatusStr = 'FULLY PAID'
  } else if (totalReceived === 0) {
    paymentStatusStr = 'UNPAID'
  }

  // Formatting dates
  const formattedPaymentDate = paymentDateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  // Format amounts to 2 decimal places e.g. ₹484.00
  const formatINR = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 1.5cm;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans print:bg-white print:p-0 print:min-h-0">
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

        {/* Receipt Paper */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none p-6 sm:p-10 space-y-5 print:p-6 print:space-y-5 text-xs">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-5 print:pb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 shadow-sm print:w-10 print:h-10">
                <Image src="/ekodrix-logo.png" alt="Ekodrix Logo" fill className="object-cover object-left" priority />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 leading-none print:text-xl">EKODRIX</h2>
                <p className="text-xs font-bold text-[#059669] uppercase tracking-wider mt-1">BUSINESS SOLUTIONS</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 print:text-xl">PAYMENT RECEIPT</h1>
              <div className="w-20 h-0.5 bg-[#059669] ml-auto mt-1 mb-2.5"></div>
              <div className="text-xs space-y-1 text-gray-600">
                <div className="flex justify-end gap-3">
                  <span className="text-gray-500 font-medium">Receipt No.</span>
                  <span className="font-bold text-[#059669] font-mono">{receiptNumberStr}</span>
                </div>
                <div className="flex justify-end gap-3">
                  <span className="text-gray-500 font-medium">Receipt Date</span>
                  <span className="font-bold text-gray-900">{formattedPaymentDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Received From & Project Section */}
          <div className="grid grid-cols-2 gap-6 py-2">
            <div className="border-r border-gray-200 pr-6 space-y-1">
              <p className="text-xs uppercase font-bold text-[#059669] tracking-wider">RECEIVED FROM</p>
              <p className="text-base font-bold text-gray-900">{clientName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase font-bold text-[#059669] tracking-wider">PROJECT</p>
              <p className="text-base font-bold text-gray-900">{project.name}</p>
              <p className="text-xs text-gray-500">{project.project_type || 'Website & Software Development'}</p>
            </div>
          </div>

          {/* Payment Details Container */}
          <div className="border border-gray-200 rounded-xl p-5 grid grid-cols-12 gap-5 items-stretch bg-white print:p-4">
            {/* Left side details */}
            <div className="col-span-7 space-y-2.5 pr-2">
              <div>
                <p className="text-xs uppercase font-bold text-[#059669] tracking-wider">PAYMENT DETAILS</p>
                <div className="w-8 h-0.5 bg-[#059669] mt-1 mb-2.5"></div>
              </div>

              <div className="text-xs space-y-2.5 text-gray-600">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Payment Amount</span>
                  <span className="font-bold text-[#059669] text-sm">{formatINR(paymentAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Payment Date</span>
                  <span className="font-semibold text-gray-900">{formattedPaymentDate}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Remarks</span>
                  <span className="font-medium text-gray-800 text-right max-w-[200px]">
                    {payment.notes || `Payment received against project ${project.name}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side Payment Received badge box */}
            <div className="col-span-5 bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <div className="w-11 h-11 rounded-full bg-[#d1fae5] flex items-center justify-center mb-2 text-[#059669]">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-xs font-bold text-gray-900 tracking-wider">PAYMENT RECEIVED</h3>
              <div className="w-6 h-0.5 bg-[#059669] my-1.5"></div>
              <p className="text-xs text-gray-600 leading-snug max-w-[170px]">
                Thank you for your payment. We appreciate your trust in Ekodrix Business Solutions.
              </p>
            </div>
          </div>

          {/* Payment Summary Box */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-[#064e3b] text-white px-5 py-2 text-xs font-bold uppercase tracking-wider">
              PAYMENT SUMMARY
            </div>
            <div className="p-4 space-y-2.5 text-xs bg-white print:p-3.5">
              <div className="flex justify-between text-gray-700 py-0.5">
                <span>Total Project Value</span>
                <span className="font-bold text-gray-900">{formatINR(projectValue)}</span>
              </div>
              <div className="flex justify-between text-gray-700 py-0.5 border-t border-gray-100 pt-2">
                <span>Total Received to Date (Including This Payment)</span>
                <span className="font-bold text-gray-900">{formatINR(totalReceived)}</span>
              </div>
              <div className="flex justify-between text-gray-700 py-0.5 border-t border-gray-100 pt-2 font-semibold">
                <span className="text-[#059669]">Remaining Project Balance</span>
                <span className="text-[#059669]">{formatINR(remainingBalance)}</span>
              </div>

              {/* Status Bar */}
              <div className="bg-[#f0fdf4] border border-[#e6f4ea] rounded-lg p-2.5 mt-2.5 flex justify-between items-center text-xs">
                <span className="font-bold uppercase tracking-wider text-gray-500 text-xs">PAYMENT STATUS</span>
                <div className="h-3.5 w-px bg-gray-300 mx-2"></div>
                <span className="font-extrabold text-[#059669] text-xs tracking-wider">{paymentStatusStr}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 pt-4 text-center text-xs text-gray-500 space-y-1.5 print:pt-3">
            <p className="font-medium text-gray-700 text-xs">Thank you for choosing Ekodrix Business Solutions.</p>
            <div className="flex flex-wrap justify-center items-center gap-3.5 text-gray-500 text-[11px]">
              <div className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#059669]" />
                <span>+91 77367 67759</span>
              </div>
              <span>|</span>
              <div className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#059669]" />
                <span>info@ekodrix.com</span>
              </div>
              <span>|</span>
              <div className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#059669]" />
                <span>www.ekodrix.com</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  )
}
