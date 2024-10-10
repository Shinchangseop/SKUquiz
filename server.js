const express = require('express');
const app = express();
const port = 80;

// 정적 파일 제공
app.use(express.static('public')); // public 폴더 내의 파일들을 정적으로 제공

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/edit', (req, res) => {
  res.sendFile(__dirname + '/public/edit.html');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
