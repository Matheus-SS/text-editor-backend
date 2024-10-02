import 'dotenv/config'
import cors from 'cors';
import { createServer } from 'http';
import { Server } from "socket.io";
import express from 'express';
import jwt from 'jsonwebtoken';
import { DocumentModel } from './schema/Document.js';
import { User } from './schema/User.js'
import { ClerkExpressWithAuth } from "@clerk/clerk-sdk-node";
import { Database } from './database.js';
import { App } from './app.js'

const database = new Database();
const appController = new App();

const ROOM = 'ROOM';
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENTS = {};

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

app.use(ClerkExpressWithAuth());

app.get("/secure", appController.secure);
app.get('/', appController.index);
app.get('/clients', (req, res) => {
  console.log("CLIENTS", CLIENTS);

  res.send("ok");
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log("token", token);
  if (!token) {
    return next(new Error('Erro de autenticacao'))
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      next(new Error('Erro de autenticao'))
    }
    socket.userId = decoded.userId
  });
  next();
});

io.on("connection", (socket) => {
  console.log("conexao feita, ID: ", socket.id);

  CLIENTS[socket.userId] = socket.id;

  socket.join(ROOM);

  socket.on('editor-change', (newContent) => {
    console.log("Mensagem enviada para o cliente: ", newContent);
    socket.to(ROOM).emit("update-editor-change", newContent);
  });

  socket.on('client.document.save', async (content) => {
    const user = await User.findById(socket.userId).exec();
    const obj = JSON.parse(content);
    console.log("user", user);
    await DocumentModel.create({
      text: obj.text,
      title: obj.title,
      authorId: socket.userId
    });
    const doc = await DocumentModel.find({ authorId: socket.userId });
    console.log("content", content);
    const d = { data: doc, success: true }
    socket.emit('server.document.list', d);
  });

  socket.on('server.document.list', async (callback) => {
    const doc = await DocumentModel.find({ authorId: socket.userId });
    console.log("content", doc);
    callback({ success: true, data: doc })
  });

  socket.on('disconnect', () => {
    console.log("Cliente desconectado")
  })
});

database.connect().then(() => {
  const server2 = server.listen(3000, () => {
    console.log("Servidor rodando na porta 3000")
  });

  process.on('SIGTERM', async () => {
    console.log('Sinal SIGTERM recebido, fechando conexao HTTP');
    await database.disconnect();
    server2.close(async () => {
      console.log('SIGTERM - Servidor HTTP fechado')
    });
  });

  process.on('SIGINT', async () => {
    console.log('Sinal SIGINT recebido, fechando conexao HTTP');
    await database.disconnect();
    server2.close(async () => {
      console.log('SIGINT - Servidor HTTP fechado')
    });
  });
})