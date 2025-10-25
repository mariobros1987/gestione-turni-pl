import express from 'express'
import cors from 'cors'
import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword, validateEmail, validatePassword } from '../lib/auth-utils'

const app = express()
app.use(express.json())

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000']

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))

// Nuova route compatibile con frontend
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
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
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, users, count: users.length, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore interno del server', timestamp: new Date().toISOString() });
  }
});

app.post('/auth/register', async (req, res) => {
  // ...existing code...
})

// Nuova route compatibile con frontend
app.post('/api/auth/register', async (req, res) => {
  try {
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
    } = req.body

    if (!validateEmail(email)) {
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

    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email già registrata'
      })
    }

    const existingUserByBadge = await prisma.user.findUnique({
      where: { badgeNumber: badgeNumber.trim() }
    })

// Blocco duplicato rimosso, la logica è già presente nella funzione della route

    if (existingUserByBadge) {
      return res.status(409).json({
        success: false,
        message: 'Numero di matricola già registrato'
      })
    }

    const passwordHash = await hashPassword(password)

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        badgeNumber: badgeNumber.trim(),
        department: department.trim(),
        rank: rank?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        passwordHash,
        isActive: true,
        isVerified: false
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

    res.json({
      success: true,
      message: 'Registrazione completata con successo!',
      user: newUser
    })
  } catch (error) {
    console.error('Errore durante la registrazione:', error)
    if (error instanceof Error) {
      console.error('Stack:', error.stack)
    }
    res.status(500).json({
      success: false,
      message: 'Errore interno del server',
  error: (error instanceof Error ? error.message : String(error))
    })
  }
})

app.post('/auth/login', async (req, res) => {
  // ...existing code...
})

// Nuova route compatibile con frontend
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

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
        message: "Account disattivato. Contatta l'amministratore."
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    const { passwordHash, ...userWithoutPassword } = user

    res.json({
      success: true,
      message: 'Login effettuato con successo!',
      user: userWithoutPassword
    })
  } catch (error) {
    console.error('Errore durante il login:', error)
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    })
  }
})


// Endpoint di debug utenti (solo sviluppo)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/users', async (req, res) => {
    try {
      const users = await prisma.user.findMany({
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
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, users, count: users.length, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Errore interno del server', timestamp: new Date().toISOString() });
    }
  });
}


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});

export { app }
