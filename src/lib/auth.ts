import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'tushar' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Please enter a username and password');
        }

        const username = credentials.username.trim();
        const password = credentials.password;

        try {
          // Check if user exists
          let user = await prisma.user.findUnique({
            where: { username }
          });

          if (!user) {
            // Auto-signup: Register user on the fly to simplify testing/ux
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await prisma.user.create({
              data: {
                username,
                password: hashedPassword,
                cash: 1000.0 // Default starting balance
              }
            });
            console.log(`Auto-registered user: ${username}`);
          } else {
            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
              throw new Error('Incorrect password');
            }
          }

          return {
            id: user.id.toString(),
            name: user.username,
            cash: user.cash
          };
        } catch (error: any) {
          throw new Error(error.message || 'Authentication failed');
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      
      // Update session when balance changes (e.g. from Faucet API)
      if (trigger === 'update') {
        const dbUser = await prisma.user.findUnique({
          where: { id: parseInt(token.id as string, 10) }
        });
        if (dbUser) {
          token.cash = dbUser.cash;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).name = token.name;

        // Fetch fresh cash balance from DB for the user session
        const dbUser = await prisma.user.findUnique({
          where: { id: parseInt(token.id as string, 10) },
          select: { cash: true }
        });
        (session.user as any).cash = dbUser ? dbUser.cash : 1000.0;
      }
      return session;
    }
  },
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
};
