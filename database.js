import mongoose from 'mongoose';
const MONGO_URI = process.env.MONGO_URI;;
const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

export class Database {
  async connect() {
    try {
      await mongoose.connect(MONGO_URI, clientOptions);
      await mongoose.connection.db.admin().command({ ping: 1 });
      console.log("Conectado ao banco de dados MongoDB");
    } catch (err) {
      console.log("Erro ao conectar ao banco de dados MongoDB", err)
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log("Desconectado do banco de dados MongoDB");
  }
}
