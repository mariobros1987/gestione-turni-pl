import { VercelRequest, VercelResponse } from '@vercel/node'
import { prisma } from '../../../src/lib/prisma'
import { verifyPassword, validateEmail } from '../../../src/lib/auth-utils'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    return res.status(200).json({
      success: true,
      message: 'Login effettuato con successo!',
      user: userWithoutPassword
    })

  } catch (error) {
    console.error('Errore durante il login:', error)
    return res.status(500).json({
      success: false, 
      message: 'Errore interno del server' 
    })
  }
}