import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET')!

async function verifySignature(body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const sigBytes = new Uint8Array(
    (signature.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16))
  )
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
}

Deno.serve(async (req) => {
  const signature = req.headers.get('x-signature') ?? ''
  const body = await req.text()

  const valid = await verifySignature(body, signature)
  if (!valid) return new Response('Invalid signature', { status: 401 })

  const payload = JSON.parse(body)
  const eventName = payload.meta?.event_name

  if (eventName === 'order_created' || eventName === 'subscription_created') {
    const email = payload.data?.attributes?.user_email
    if (!email) return new Response('No email in payload', { status: 400 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find((u) => u.email === email)

    if (user) {
      await supabase
        .from('profiles')
        .update({ is_pro: true, lemon_subscription_id: String(payload.data?.id ?? '') })
        .eq('id', user.id)
    }
  }

  return new Response('OK', { status: 200 })
})
