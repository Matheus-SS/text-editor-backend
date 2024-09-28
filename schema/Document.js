import mongoose from 'mongoose';
const { Schema } = mongoose;

const documentSchema = new Schema({
  title: String,      
  text: String,
  authorId: String
});

export const DocumentModel = mongoose.model('Document', documentSchema);