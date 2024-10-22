
document.addEventListener('DOMContentLoaded', function () {
  fetch('/check-login')
    .then(response => response.json())
    .then(data => {
      const userInfo = document.getElementById('user-info');
      if (data.loggedIn) {
        userInfo.innerHTML = `
          <span style="font-size: 1.5em; font-weight: bold; margin-right: 150px; margin-top: 10px; display: inline-block;">${data.username}</span>
          <button class="login-button" onclick="location.href='/logout/'">로그아웃</button>
        `;
      } else {
        userInfo.innerHTML = `
          <button class="login-button" onclick="location.href='/login/'">로그인</button>
        `;
      }
    })
    .catch(error => {
      console.error('로그인 상태 확인 중 오류 발생:', error);
    });
});
