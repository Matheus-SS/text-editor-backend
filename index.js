import 'dotenv/config'
import { createServer } from 'http';
import express from 'express';
import { Server } from "socket.io";
import { ClerkExpressWithAuth, createClerkClient } from "@clerk/clerk-sdk-node";
import cors from 'cors';

const app = express();
app.use(express.json());
const server = createServer(app);

app.use(cors({
  origin: '*'
}))

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173"
  }
});
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

app.use(ClerkExpressWithAuth());
app.get("/secure", async (req, res) => {
  const userId = req.auth.userId;
  const u = await clerkClient.users.getUser(userId);
  res.send(`Authenticated user ID: ${userId}`);
});

app.get('/', (req, res) => {
  res.json(CLIENTS);
});

const ROOM = 'ROOM';
const CLIENTS = {};

io.on("connection", (socket) => {
  console.log("conexao feita, ID: ", socket.id);

  socket.join(ROOM);

  socket.on('editor-change', (newContent) => {
    console.log("Mensagem enviada para o cliente: ", newContent);
    socket.broadcast.emit('update-editor-change', newContent)
  });

  socket.on('disconnect', () => {
    console.log("Cliente desconectado")
  })
});

const server2 = server.listen(3000, () => {
  console.log("Servidor rodando na porta 3000")
});

process.on('SIGTERM', async () => {
  console.log('Sinal SIGTERM recebido, fechando conexao HTTP');
  server2.close(async () => {
    console.log('SIGTERM - Servidor HTTP fechado')
  });
});

process.on('SIGINT', async () => {
  console.log('Sinal SIGINT recebido, fechando conexao HTTP');
  server2.close(async () => {
    console.log('SIGINT - Servidor HTTP fechado')
  });
});
