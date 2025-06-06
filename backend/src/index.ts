import express from 'express';
const app = express();
const port = 3001;

app.get('/', (_req, res) => {
  res.send('Backend is running!');
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});