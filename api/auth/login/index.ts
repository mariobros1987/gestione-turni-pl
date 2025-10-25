import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

// JWT Secret (in produzione deve essere una variabile d'ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024'

// Auth utilities inline
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

function generateJWT(user: any): string {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      badgeNumber: user.badgeNumber 
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Token valido per 7 giorni
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Metodo non supportato' 
    })
  }
  try {
    const { email, password } = req.body

    // Validazioni base
    if (!email || !password) {
      return res.status(400).json({
        success: false, 
        message: 'Email e password sono obbligatori' 
      })
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false, 
        message: 'Email non valida' 
      })
    }

    // Cerca utente
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        badgeNumber: true,
        department: true,
        rank: true,
        phoneNumber: true,
        passwordHash: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false, 
        message: 'Email o password non corretti' 
      })
    }

    // Verifica password
    const isPasswordValid = await verifyPassword(password, user.passwordHash)
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false, 
        message: 'Email o password non corretti' 
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false, 
        message: 'Account disattivato. Contatta l\'amministratore.' 
      })
    }

    // Aggiorna ultimo login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    // Rimuovi password hash dalla risposta
    const { passwordHash, ...userWithoutPassword } = user

    // Genera JWT token
    const token = generateJWT(user)

    // Imposta cookie HTTP-only con il token (più sicuro)
    res.setHeader('Set-Cookie', [
      `auth_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    ])

    return res.status(200).json({
      success: true,
      message: 'Login effettuato con successo!',
      user: userWithoutPassword,
      token: token // Includo anche nel body per flessibilità
    })

  } catch (error) {
    console.error('Errore durante il login:', error)
    return res.status(500).json({
      success: false, 
      message: 'Errore interno del server' 
    })
  }
}