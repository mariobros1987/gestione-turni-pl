import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Metodo non supportato' 
    })
  }

  try {
    const { token } = req.body
    const cookieToken = req.cookies?.auth_token

    // Usa il token dal body o dai cookie
    const tokenToVerify = token || cookieToken

    if (!tokenToVerify) {
      return res.status(401).json({
        success: false,
        message: 'Token di autenticazione mancante'
      })
    }

    // Verifica il JWT token
    const decoded = jwt.verify(tokenToVerify, JWT_SECRET) as any
    
    // Recupera l'utente dal database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utente non trovato'
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account disattivato'
      })
    }

    return res.status(200).json({
      success: true,
      user: user,
      message: 'Token valido'
    })

  } catch (error: any) {
    console.error('Errore durante la verifica del token:', error)
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token non valido'
      })
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token scaduto'
      })
    }

    return res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    })
  } finally {
    if (process.env.NODE_ENV !== 'development') {
      await prisma.$disconnect()
    }
  }
}