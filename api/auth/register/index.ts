import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Auth utilities inline
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('La password deve essere di almeno 8 caratteri')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('La password deve contenere almeno una lettera maiuscola')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('La password deve contenere almeno una lettera minuscola')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('La password deve contenere almeno un numero')
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('La password deve contenere almeno un carattere speciale')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
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
    console.log('🔍 Register API chiamata');
    console.log('📦 Content-Type:', req.headers['content-type']);
    console.log('📦 Raw body:', typeof req.body, req.body);
    
    // Parse del body se necessario
    let data = req.body;
    if (typeof req.body === 'string') {
      try {
        data = JSON.parse(req.body);
        console.log('📦 Body parsato da string:', data);
      } catch (parseError) {
        console.log('❌ Errore parsing JSON:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Formato dati non valido'
        });
      }
    }
    
    const {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      badgeNumber,
      department,
      rank,
      phoneNumber
    } = data

    console.log('📧 Email estratta:', email);
    console.log('🔑 Password:', password ? 'presente' : 'mancante');
    console.log('👤 Nome:', firstName, lastName);

    // Validazioni
    if (!validateEmail(email)) {
      console.log('❌ Email non valida:', email);
      return res.status(400).json({
        success: false, 
        message: 'Email non valida' 
      })
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false, 
        message: 'Password non valida:\n' + passwordValidation.errors.join('\n') 
      })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false, 
        message: 'Le password non coincidono' 
      })
    }

    if (!firstName?.trim() || !lastName?.trim() || !badgeNumber?.trim() || !department?.trim()) {
      return res.status(400).json({
        success: false, 
        message: 'Tutti i campi obbligatori devono essere compilati' 
      })
    }

    // Verifica unicità email
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUserByEmail) {
      return res.status(409).json({
        success: false, 
        message: 'Email già registrata' 
      })
    }

    // Verifica unicità numero distintivo
    const existingUserByBadge = await prisma.user.findUnique({
      where: { badgeNumber: badgeNumber.trim() }
    })

    if (existingUserByBadge) {
      return res.status(409).json({
        success: false, 
        message: 'Numero distintivo già registrato' 
      })
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Crea utente
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        badgeNumber: badgeNumber.trim(),
        department: department.trim(),
        rank: rank?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        passwordHash,
        name: `${firstName.trim()} ${lastName.trim()}`, // Per compatibilità NextAuth
        isActive: true,
        isVerified: false // Potrebbe essere verificato tramite email in futuro
      },
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
        createdAt: true
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Registrazione completata con successo!',
      user: newUser
    })

  } catch (error: any) {
    console.error('Errore durante la registrazione:', error)
    
    // Gestione errori specifici di Prisma
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0]
      if (field === 'email') {
        return res.status(409).json({
          success: false, 
          message: 'Email già registrata' 
        })
      } else if (field === 'badgeNumber') {
        return res.status(409).json({
          success: false, 
          message: 'Numero distintivo già registrato' 
        })
      }
    }

    return res.status(500).json({
      success: false, 
      message: 'Errore interno del server' 
    })
  } finally {
    // Disconnetti in ambiente serverless
    if (process.env.NODE_ENV !== 'development') {
      await prisma.$disconnect()
    }
  }
}