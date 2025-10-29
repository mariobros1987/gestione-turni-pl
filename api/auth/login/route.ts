
import { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../../src/lib/prisma'
import { verifyPassword, validateEmail } from '../../../src/lib/auth-utils'
import jwt from 'jsonwebtoken'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('➡️  Richiesta login ricevuta:', { method: req.method, url: req.url, body: req.body })
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

    // Genera JWT
    const jwtSecret = process.env.JWT_SECRET || ''
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'JWT_SECRET non configurato nel server.'
      })
    }
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        badgeNumber: user.badgeNumber,
        department: user.department,
        rank: user.rank,
        phoneNumber: user.phoneNumber,
        isActive: user.isActive,
        isVerified: user.isVerified
      },
      jwtSecret,
      { expiresIn: '12h' }
    )

    return res.status(200).json({
      success: true,
      message: 'Login effettuato con successo!',
      user: userWithoutPassword,
      token
    })

  } catch (error) {
    console.error('Errore durante il login:', error)
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack)
    }
    return res.status(500).json({
      success: false, 
      message: 'Errore interno del server',
      error: (process.env.NODE_ENV === 'development' && error instanceof Error) ? error.message : undefined
    })
  }
}