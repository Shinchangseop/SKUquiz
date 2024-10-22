setInterval(() => {
    fetch('/api/ping', { method: 'POST' })
        .then(response => response.json())
        .then(data => console.log('서버에 핑 전송:', data))
        .catch(error => console.error('서버 핑 전송 실패:', error));
}, 300000); // 5분마다 핑 전송