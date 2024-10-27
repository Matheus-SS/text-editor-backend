import 'dotenv/config'
import cors from 'cors';
import { createServer } from 'http';
import { Server } from "socket.io";
import express from 'express';
import jwt from 'jsonwebtoken';
import { DocumentModel } from './schema/Document.js';
import { ClerkExpressWithAuth } from "@clerk/clerk-sdk-node";
import { Database } from './database.js';
import { App } from './app.js'

const database = new Database();
const appController = new App();

const ROOM = 'ROOM';
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENTS = {};
const errDocNotFound = 'Documento nao encontrado';
const errInternalServer = 'Erro interno de servidor';
const errMaxAllowedDocuments = 'Número máximo de documentos atingido';


function RESPONSE(data, success, err = '') {
  if (success === false) {
    return { error: err, message: data, success: false }
  } else {
    return { data: data, success: true }
  }
}

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
    const count = await DocumentModel.countDocuments({ authorId: socket.userId });
    console.log("count", count);

    const saveOrUpdate = {
      text: content.text,
      title: content.title,
      authorId: socket.userId
    };

    if (content.docId) {
      const doc = await DocumentModel.findOne({ _id: content.docId, authorId: socket.userId });
      console.log("doci")
      if (!doc) {
        const d = RESPONSE(errDocNotFound, false, 'errDocNotFound');
        socket.emit('server.document.list', d);
        return;
      }

      doc.text = saveOrUpdate.text;
      doc.title = saveOrUpdate.title;
      doc.authorId = saveOrUpdate.authorId;

      await doc.save();
      const doc2 = await DocumentModel.find({ authorId: socket.userId });

      const d = RESPONSE(doc2, true);
      socket.emit('server.document.list', d);
      return
    }

    if (count >= 5) {
      const d = RESPONSE(errMaxAllowedDocuments, false, 'errMaxAllowedDocuments');
      socket.emit('server.document.list', d);
      return
    }

    await DocumentModel.create(saveOrUpdate);

    const doc2 = await DocumentModel.find({ authorId: socket.userId });
    const d = RESPONSE(doc2, true);
    // envia para preencher a lista do menu
    socket.emit('server.document.list', d);
  });

  socket.on('client.document.update', async (content) => {
    const update = {
      text: content.text,
      title: content.title,
      authorId: socket.userId
    };

    if (content.docId) {
      const doc = await DocumentModel.findOne({ _id: content.docId, authorId: socket.userId });
      if (!doc) {
        const d = RESPONSE(errDocNotFound, false, 'errDocNotFound');
        socket.emit('server.document.update', d);
        return;
      }

      doc.text = update.text;
      doc.title = update.title;
      doc.authorId = update.authorId;

      await doc.save();
      const doc2 = await DocumentModel.find({ authorId: socket.userId });

      const d = RESPONSE(doc2, true);
      socket.emit('server.document.update', d);
      return
    }
  });

  socket.on('server.document.list', async (callback) => {
    const doc = await DocumentModel.find({ authorId: socket.userId });
    callback({ success: true, data: doc });
  });

  socket.on('server.document.open', async (_id, callback) => {
    try {
      const doc = await DocumentModel.findOne({ _id });

      if (doc.authorId !== socket.userId) {
        callback({ success: false, data: errDocNotFound });
        return;
      };
      callback({ success: true, data: doc });
    } catch (error) {
      callback({ success: false, data: errInternalServer })
    }
  })

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