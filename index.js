import 'dotenv/config'
import { createServer } from 'http';
import express from 'express';
import { Server } from "socket.io";
import { ClerkExpressWithAuth } from "@clerk/clerk-sdk-node";
import cors from 'cors';
import { Database } from './database.js';
import { App } from './app.js'

const database = new Database();
const appController = new App();

const ROOM = 'ROOM';
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