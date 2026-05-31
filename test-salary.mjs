import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function test() {
  console.log('Inserting salary...')
  const newSalary = {
    employee_name: 'Test Employee',
    employee_email: 'test@example.com',
    role: 'tester',
    amount: 1000,
    month_year: '2026-05-01',
    payment_status: 'Pending',
    payment_date: '2026-05-29'
  }
  const { data, error } = await supabase.from('salaries').insert([newSalary]).select()
  if (error) {
    console.error('Insert Error:', error)
    return
  }
  
  const id = data[0].id
  console.log('Inserted ID:', id)

  console.log('Calling API...')
  const res = await fetch('http://localhost:3000/api/salaries/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salaryId: id })
  })
  const text = await res.text()
  console.log('API Response:', text)
}

test()
