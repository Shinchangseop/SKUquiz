const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const session = require('express-session'); // 세션 모듈 추가
const app = express();
const port = 80;

// PostgreSQL 연결 설정
const pool = new Pool({
  user: 'postgres', // PostgreSQL 사용자 이름
  host: 'localhost',
  database: 'quizdb', // 생성한 데이터베이스 이름
  password: 'hoonz@001105', // PostgreSQL 비밀번호로 변경 필요
  port: 5432,
});

// 요청 본문을 JSON 형식으로 파싱
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 세션 설정
app.use(session({
  secret: 'my-secret-key', // 보안 키 (임의의 문자열)
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // https 환경이 아니면 secure: false
}));

// 정적 파일 제공
app.use(express.static('public')); // public 폴더 내의 파일들을 정적으로 제공

// 기본 라우트들
app.get('/', (req, res) => {
  if (req.session.user) {
    // 로그인한 사용자가 있는 경우
    res.send(`
      <h1>정상화 퀴즈</h1>
      <p>${req.session.user.username}님, 환영합니다!</p>
      <a href="/logout">로그아웃</a>
    `);
  } else {
    res.sendFile(__dirname + '/public/index.html');
  }
});

app.get('/edit', (req, res) => {
  res.sendFile(__dirname + '/public/edit.html');
});

app.get('/edit/new', (req, res) => {
  res.sendFile(__dirname + '/public/edit_new.html');
});

// /edit/new/text 라우트 (로그인 여부 확인)
app.get('/edit/new/text', (req, res) => {
  if (!req.session.user) {
    // 로그인이 되어 있지 않으면 login.html로 리다이렉트
    res.send(`
      <script>
        alert('로그인이 필요합니다.');
        window.location.href = '/login';
      </script>
    `);
  } else {
    // 로그인된 사용자만 edit_new_text.html 제공
    res.sendFile(__dirname + '/public/edit_new_text.html');
  }
});


app.get('/edit/modify', (req, res) => {
  res.sendFile(__dirname + '/public/edit_modify.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

app.get('/join', (req, res) => {
  res.sendFile(__dirname + '/public/join.html');
});

app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/public/register.html');
});

// 회원가입 처리 라우트
app.post('/register', async (req, res) => {
  console.log('회원가입 요청 데이터:', req.body); // 추가된 로그
  const { username, password, passwordrepeat } = req.body;

  if (password !== passwordrepeat) {
    return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
      [username, password]
    );
    res.send(`
      <script>
        alert('회원 가입에 성공하셨습니다.');
        window.location.href = '/login';
      </script>
    `);
  } catch (error) {
    console.error('회원가입 중 오류 발생:', error.message);
    res.status(500).json({ message: '회원가입 실패. 이미 존재하는 사용자일 수 있습니다.' });
  }
});

// 아이디 중복 확인 라우트
app.post('/check-username', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: '아이디를 입력해주세요.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      res.status(400).json({ message: '중복되는 아이디입니다.' });
    } else {
      res.status(200).json({ message: '사용 가능한 아이디입니다.' });
    }
  } catch (error) {
    console.error('아이디 중복 확인 중 오류 발생:', error.message);
    res.status(500).json({ message: '서버 내부 오류가 발생했습니다. 다시 시도해주세요.' });
  }
});

// 로그인 처리 라우트 추가
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

    if (result.rows.length > 0) {
      // 로그인 성공 시 세션에 사용자 정보 저장
      req.session.user = result.rows[0];
      console.log('사용자 로그인:', req.session.user);
      res.send(`
        <script>
          alert('로그인에 성공하셨습니다.');
          window.location.href = '/';
        </script>
      `);
    } else {
      res.send(`
        <script>
          alert('아이디 또는 비밀번호가 잘못되었습니다.');
          window.location.href = '/login';
        </script>
      `);
    }
  } catch (error) {
    console.error('로그인 중 오류 발생:', error.message);
    res.status(500).send('서버 오류가 발생했습니다. 다시 시도해주세요.');
  }
});

// 로그아웃 라우트 추가
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('로그아웃 중 오류가 발생했습니다.');
    }
    res.send(`
      <script>
        alert('로그아웃 되었습니다.');
        window.location.href = '/';
      </script>
    `);
  });
});

app.get('/check-login', (req, res) => {
  console.log('로그인 상태 확인:', req.session.user);
  if (req.session.user) {
    res.json({ loggedIn: true, username: req.session.user.username });
  } else {
    res.json({ loggedIn: false });
  }
});

// 퀴즈 저장 라우트
app.post('/save-quiz', async (req, res) => {
  const { title, username, questions } = req.body;

  // 필수 데이터 검증
  if (!title || !username || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: '필수 데이터 누락 또는 형식 오류' });
  }

  try {
    // 퀴즈 저장
    const quizResult = await pool.query(
      'INSERT INTO quizzes (title, username) VALUES ($1, $2) RETURNING id',
      [title, username]
    );
    const quizId = quizResult.rows[0].id;

    // 각 질문 저장
    for (const question of questions) {
      await pool.query(
        'INSERT INTO questions (quiz_id, question, answer) VALUES ($1, $2, $3)',
        [quizId, question.question, question.answer]
      );
    }

    res.json({ message: '퀴즈가 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('퀴즈 저장 중 오류 발생:', error.message);
    res.status(500).json({ message: '퀴즈 저장 중 오류가 발생했습니다. 다시 시도해주세요.' });
  }
});

// 퀴즈 저장 라우트 추가
app.post('/save-quiz', async (req, res) => {
  const { title, username, questions } = req.body;

  if (!title || !username || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: '필수 데이터 누락 또는 형식 오류' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO quizzes (title, username, questions) VALUES ($1, $2, $3) RETURNING *',
      [title, username, JSON.stringify(questions)]
    );
    res.status(200).json({ message: '퀴즈 저장 성공' });
  } catch (error) {
    console.error('퀴즈 저장 중 오류 발생:', error.message);
    res.status(500).json({ message: '퀴즈 저장 실패' });
  }
});

// 사용자의 퀴즈 목록 조회
app.get('/quizzes', async (req, res) => {
  const { username } = req.query;

  try {
    const result = await pool.query('SELECT * FROM quizzes WHERE username = $1', [username]);
    res.json(result.rows);
  } catch (error) {
    console.error('퀴즈 목록 조회 중 오류 발생:', error.message);
    res.status(500).json({ message: '퀴즈 목록 조회 실패' });
  }
});

// 퀴즈 삭제
app.delete('/delete-quiz', async (req, res) => {
  const { quizId } = req.query;

  try {
    await pool.query('DELETE FROM quizzes WHERE id = $1', [quizId]);
    res.status(200).send('퀴즈 삭제 성공');
  } catch (error) {
    console.error('퀴즈 삭제 중 오류 발생:', error.message);
    res.status(500).json({ message: '퀴즈 삭제 실패' });
  }
});




app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});