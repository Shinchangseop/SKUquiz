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

// userLastActive 객체와 로그인된 유저 목록
let userLastActive = {};
let loggedInUsers = [];

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
    res.send(`
      <h1>정상화 퀴즈</h1>
      <p>${req.session.user.username}님, 환영합니다!</p>
      <a href="/logout">로그아웃</a>
    `);
  } else {
    res.sendFile(__dirname + '/public/index.html');
  }
});

// 로그인 처리 라우트
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

    if (result.rows.length > 0) {
      req.session.user = result.rows[0];
      const username = req.session.user.username;

      // 로그인된 유저 목록에 추가 (중복 방지)
      if (!loggedInUsers.includes(username)) {
        loggedInUsers.push(username);
      }

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


// 로그아웃 라우트
app.get('/logout', (req, res) => {
  const username = req.session.user ? req.session.user.username : null;

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('로그아웃 중 오류가 발생했습니다.');
    }

    // 유저 목록에서 해당 유저 제거
    if (username) {
      loggedInUsers = loggedInUsers.filter(user => user !== username);
    }

    res.send(`
      <script>
        alert('로그아웃 되었습니다.');
        window.location.href = '/';
      </script>
    `);
  });
});

// 로그인된 유저 목록을 반환하는 API
app.get('/api/connected-users', (req, res) => {
  res.json({ users: loggedInUsers });
});

app.get('/edit', (req, res) => {
  res.sendFile(__dirname + '/public/edit.html');
});

app.get('/edit/new', (req, res) => {
  res.sendFile(__dirname + '/public/edit_new.html');
});


// 활성 상태 핑 API
app.post('/api/ping', (req, res) => {
  if (req.session.user) {
    const username = req.session.user.username;
    userLastActive[username] = Date.now(); // 유저의 마지막 활성 시간 업데이트

    // 유저가 목록에서 삭제되었으면 다시 추가
    if (!loggedInUsers.includes(username)) {
      loggedInUsers.push(username);
      console.log(`${username}가 다시 활성화되어 목록에 추가되었습니다.`);
    }

    res.json({ status: 'active' });
  } else {
    res.status(401).json({ status: 'not_logged_in' });
  }
});

// 비활성 사용자 목록에서 제거 (주기적 체크)
setInterval(() => {
  const now = Date.now();
  for (const [username, lastActive] of Object.entries(userLastActive)) {
    if (now - lastActive > 600000) { // 18초 동안 활동이 없으면
      loggedInUsers = loggedInUsers.filter(user => user !== username); // 목록에서 제거
      delete userLastActive[username]; // 비활성화된 유저의 마지막 활동 시간 삭제
      console.log(`${username}가 비활성화되어 목록에서 제거되었습니다.`);
    }
  }
}, 60000); // 1.8초마다 비활성 유저 체크


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

app.get('/edit/new/image', (req, res) => {
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
    res.sendFile(__dirname + '/public/edit_new_image.html');
  }
});

app.get('/edit/new/sound', (req, res) => {
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
    res.sendFile(__dirname + '/public/edit_new_sound.html');
  }
});


app.get('/edit/modify', (req, res) => {
  res.sendFile(__dirname + '/public/edit_modify.html');
});

app.get('/edit/modify/text', (req, res) => {
  res.sendFile(__dirname + '/public/edit_modify_text.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

app.get('/join', (req, res) => {
  res.sendFile(__dirname + '/public/join.html');
});

app.get('/join/single', (req, res) => {
  res.sendFile(__dirname + '/public/join_single.html');
});

app.get('/join/multi', (req, res) => {
  res.sendFile(__dirname + '/public/join_multi.html');
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

// 퀴즈 저장 라우트 (type 추가)
app.post('/save-quiz', async (req, res) => {
  const { title, username, questions, type } = req.body;

  // 필수 데이터 검증
  if (!title || !username || !Array.isArray(questions) || questions.length === 0 || !type) {
    return res.status(400).json({ message: '필수 데이터 누락 또는 형식 오류' });
  }

  try {
    // 퀴즈 저장
    const quizResult = await pool.query(
      'INSERT INTO quizzes (title, username, type) VALUES ($1, $2, $3) RETURNING id',
      [title, username, type]
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

// 퀴즈 데이터 가져오기 라우트
app.get('/get-quiz', async (req, res) => {
  const { quizId } = req.query;

  if (!quizId) {
    return res.status(400).json({ message: '퀴즈 ID가 필요합니다.' });
  }

  try {
    // 데이터베이스에서 해당 퀴즈 정보를 가져옴
    const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ message: '퀴즈를 찾을 수 없습니다.' });
    }

    const quiz = quizResult.rows[0];

    // 퀴즈에 해당하는 질문들을 가져옴
    const questionsResult = await pool.query('SELECT * FROM questions WHERE quiz_id = $1 ORDER BY id ASC', [quizId]);
    const questions = questionsResult.rows.map(row => ({
      question: row.question,
      answer: row.answer,
      displayAnswer: row.answer.split('/')[0] // 정답에서 '/' 기준으로 앞에 있는 값 사용
    }));

    res.json({
      title: quiz.title,
      questions: questions
    });
  } catch (error) {
    console.error('퀴즈 데이터를 불러오는 중 오류 발생:', error.message);
    res.status(500).json({ message: '서버 내부 오류가 발생했습니다. 다시 시도해주세요.' });
  }
});


// 퀴즈 수정 라우트
app.post('/update-quiz', async (req, res) => {
  const { quizId, title, type, questions } = req.body;

  // 필수 데이터 검증
  if (!quizId || !title || !type || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: '필수 데이터 누락 또는 형식 오류' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // 트랜잭션 시작

    // 퀴즈 제목 및 유형 업데이트
    await client.query(
      'UPDATE quizzes SET title = $1, type = $2 WHERE id = $3',
      [title, type, quizId]
    );

    // 기존의 질문들을 모두 삭제하고 새롭게 추가 (간단한 구현 방식)
    await client.query('DELETE FROM questions WHERE quiz_id = $1', [quizId]);

    for (const question of questions) {
      await client.query(
        'INSERT INTO questions (quiz_id, question, answer) VALUES ($1, $2, $3)',
        [quizId, question.question, question.answer]
      );
    }

    await client.query('COMMIT'); // 트랜잭션 커밋
    res.json({ message: '퀴즈가 성공적으로 수정되었습니다.' });
  } catch (error) {
    await client.query('ROLLBACK'); // 오류 발생 시 롤백
    console.error('퀴즈 수정 중 오류 발생:', error.message);
    res.status(500).json({ message: '퀴즈 수정 중 오류가 발생했습니다. 다시 시도해주세요.' });
  } finally {
    client.release(); // 연결 해제
  }
});




// 문장 퀴즈 목록 가져오기 라우트
app.get('/get-sentence-quizzes', async (req, res) => {
  try {
    const quizzesResult = await pool.query(`
      SELECT 
        q.id,
        q.title,
        q.username,
        q.created_at,
        COUNT(que.id) AS question_count
      FROM quizzes q
      LEFT JOIN questions que ON q.id = que.quiz_id
      WHERE q.type = 'sentence'
      GROUP BY q.id, q.title, q.username, q.created_at
      ORDER BY q.title ASC
    `);
    
    res.json(quizzesResult.rows);
  } catch (error) {
    console.error('퀴즈 목록을 불러오는 중 오류 발생:', error.message);
    res.status(500).json({ message: '퀴즈 목록을 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.' });
  }
});
