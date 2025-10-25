import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Metodo non supportato. Usa POST per testare l\'autenticazione.' 
    })
  }

  return res.status(200).json({
    success: true,
    message: 'Test API funziona!',
    timestamp: new Date().toISOString(),
    env_check: {
      jwt_secret_configured: !!process.env.JWT_SECRET,
      database_url_configured: !!process.env.DATABASE_URL,
      node_env: process.env.NODE_ENV
    }
  })
}