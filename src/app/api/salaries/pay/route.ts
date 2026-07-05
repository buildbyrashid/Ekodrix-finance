import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import nodemailer from 'nodemailer'
import path from 'path'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    const { salaryId, resend = false } = await req.json()

    if (!salaryId) {
      return NextResponse.json({ error: 'Salary ID is required' }, { status: 400 })
    }

    console.log('[API] Processing salary payment and receipt. salaryId:', salaryId, 'resend:', resend)

    // 1. Fetch the salary record
    const { data: salary, error: fetchError } = await supabase
      .from('salaries')
      .select('*')
      .eq('id', salaryId)
      .single()

    console.log('[API] Supabase fetch result - salary:', salary ? 'Found' : 'Null', 'error:', fetchError)

    if (fetchError || !salary) {
      return NextResponse.json({ error: 'Salary record not found', details: fetchError }, { status: 404 })
    }

    if (salary.payment_status === 'Paid' && !resend) {
      return NextResponse.json({ error: 'Salary is already paid' }, { status: 400 })
    }

    // 2. Determine/Generate Receipt Number and Payment Date
    let receiptNumber = salary.receipt_number
    let paymentDate = salary.payment_date
    let updatedSalary = salary

    if (salary.payment_status === 'Paid') {
      // If already paid, reuse or generate missing receipt number
      if (!receiptNumber) {
        const currentYear = new Date().getFullYear()
        const { count, error: countError } = await supabase
          .from('salaries')
          .select('*', { count: 'exact', head: true })
          .not('receipt_number', 'is', null)
          .gte('payment_date', `${currentYear}-01-01`)
          .lte('payment_date', `${currentYear}-12-31`)

        if (countError) {
          console.error('Error getting count:', countError)
          return NextResponse.json({ error: 'Failed to generate receipt number' }, { status: 500 })
        }

        const nextNumber = (count || 0) + 1
        receiptNumber = `EKO-SAL-${currentYear}-${nextNumber.toString().padStart(4, '0')}`
        paymentDate = paymentDate || new Date().toISOString().split('T')[0]

        const { data: dbUpdated, error: updateError } = await supabase
          .from('salaries')
          .update({ 
            receipt_number: receiptNumber,
            payment_date: paymentDate
          })
          .eq('id', salaryId)
          .select()
          .single()

        if (updateError) {
          return NextResponse.json({ error: 'Failed to update receipt number' }, { status: 500 })
        }
        updatedSalary = dbUpdated
      }
    } else {
      // Mark as Paid and Generate Receipt Number
      const currentYear = new Date().getFullYear()
      const { count, error: countError } = await supabase
        .from('salaries')
        .select('*', { count: 'exact', head: true })
        .not('receipt_number', 'is', null)
        .gte('payment_date', `${currentYear}-01-01`)
        .lte('payment_date', `${currentYear}-12-31`)

      if (countError) {
        console.error('Error getting count:', countError)
        return NextResponse.json({ error: 'Failed to generate receipt number' }, { status: 500 })
      }

      const nextNumber = (count || 0) + 1
      receiptNumber = `EKO-SAL-${currentYear}-${nextNumber.toString().padStart(4, '0')}`
      paymentDate = new Date().toISOString().split('T')[0]

      const { data: dbUpdated, error: updateError } = await supabase
        .from('salaries')
        .update({ 
          payment_status: 'Paid', 
          payment_date: paymentDate,
          receipt_number: receiptNumber
        })
        .eq('id', salaryId)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update salary status' }, { status: 500 })
      }
      updatedSalary = dbUpdated
    }

    const paymentDateObj = new Date(paymentDate)
    const formattedPaymentDate = paymentDateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    // 4. Send Email if employee email is provided
    let emailSent = false
    let emailError = null

    if (salary.employee_email) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 465,
          secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        })

        // Verify connection config
        await transporter.verify()

        const salaryMonth = new Date(salary.month_year).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const formattedAmount = `₹${Number(salary.amount).toLocaleString('en-IN')}`

        // HTML Template
        const htmlContent = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <!-- Header -->
            <div style="background-color: #0f172a; padding: 30px 20px; text-align: center; border-bottom: 4px solid #16a34a;">
              <img src="cid:ekodrixlogo" alt="Ekodrix Logo" style="max-height: 50px; margin-bottom: 15px;" />
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Salary Payment Receipt</h1>
            </div>

            <!-- Body -->
            <div style="padding: 40px 30px; background-color: #ffffff;">
              <p style="color: #334155; font-size: 16px; margin-top: 0;">Dear <strong>${salary.employee_name}</strong>,</p>
              <p style="color: #64748b; font-size: 15px; line-height: 1.6;">We are pleased to inform you that your salary for <strong>${salaryMonth}</strong> has been successfully processed and credited to your account.</p>
              
              <!-- Details Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 25px; margin: 30px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Receipt No:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${receiptNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Payment Date:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${formattedPaymentDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Status:</td>
                    <td style="padding: 8px 0; color: #16a34a; font-size: 14px; font-weight: 700; text-align: right;">PAID</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="border-bottom: 1px dashed #cbd5e1; padding-top: 15px; margin-bottom: 15px;"></td>
                  </tr>
                  <tr>
                    <td style="padding-top: 20px; color: #334155; font-size: 16px; font-weight: 600;">Net Amount Credited:</td>
                    <td style="padding-top: 20px; color: #16a34a; font-size: 20px; font-weight: 800; text-align: right;">${formattedAmount}</td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #334155; font-size: 14px; font-weight: 500; margin: 0 0 10px 0;">Thank you for your contribution.</p>
              <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.5;">This is a system-generated salary receipt from <strong>Ekodrix Business Solutions</strong>.</p>
              <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">Generated on ${new Date().toLocaleString()}</p>
            </div>
          </div>
        `

        // Path to the logo image
        const logoPath = path.join(process.cwd(), 'public', 'ekodrix-logo.png')

        await transporter.sendMail({
          from: `"Ekodrix Finance" <${process.env.SMTP_USER}>`,
          to: salary.employee_email,
          subject: `Salary Receipt - ${salaryMonth} - Ekodrix`,
          html: htmlContent,
          attachments: [
            {
              filename: 'ekodrix-logo.png',
              path: logoPath,
              cid: 'ekodrixlogo' // Same CID value as in the HTML img src
            }
          ]
        })

        emailSent = true
      } catch (err: any) {
        console.error('Failed to send email:', err)
        emailError = err.message
      }
    }

    // 5. Update Email Status in DB
    if (emailSent) {
      const { data: finalSalary } = await supabase
        .from('salaries')
        .update({ 
          receipt_sent: true, 
          receipt_sent_at: new Date().toISOString() 
        })
        .eq('id', salaryId)
        .select()
        .single()
      if (finalSalary) {
        updatedSalary = finalSalary
      }
    }

    return NextResponse.json({ 
      success: true, 
      salary: updatedSalary,
      emailSent,
      emailError
    })

  } catch (err: any) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
