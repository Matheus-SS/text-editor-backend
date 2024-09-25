import { User } from './schema/User.js'
import { createClerkClient } from "@clerk/clerk-sdk-node";
import jwt from 'jsonwebtoken'
const JWT_SECRET = process.env.JWT_SECRET;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

export class App {
  async index(req, res) {
    res.send('API GEDITOR');
  }

  async secure(req, res) {
    try {
      const userId = req.auth.userId;
      const u = await clerkClient.users.getUser(userId);
      let uid = '';

      const uf = await User.findOne({ clerkId: u.id }).exec();

      if (!uf) {
        const uc = await User.create({
          clerkId: u.id,
          email: u.emailAddresses[0].emailAddress
        });

        uid = uc._id
      } else {
        uid = uf._id
      }

      const token = jwt.sign({ userId: uid }, JWT_SECRET, { expiresIn: '7d' });

      res.status(200).json({
        message: `Authenticated user ID: ${userId}`,
        token: token
      });

    } catch (err) {
      console.log("err", err);
      res.status(500).json("erro")
    }
  }
}