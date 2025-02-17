// server.js
const https = require('http');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const socketIo = require('socket.io');

const options = {
  key: fs.readFileSync("./server.key"),
  cert: fs.readFileSync("./server.cert"),
};

const app = express();
const server = https.createServer(app);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Thư mục lưu trữ file
  },
});

// Reset folder live_stream
const files = fs.readdirSync('live_stream/');
files.forEach((file) => {
  fs.unlinkSync(path.join('live_stream/', file));
});
const files2 = fs.readdirSync('uploads/');
files2.forEach((file) => {
  fs.unlinkSync(path.join('uploads/', file));
});

const upload = multer({
  storage,
  limits: { fileSize: 1000 * 1024 * 1024 },
}); // Giới hạn kích thước });

app.use(express.static('public'));
app.use('/live_stream', express.static('live_stream'));
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ limit: '1024mb', extended: true }));

app.post('/api/upload/webcam', upload.single('video'), (req, res) => {
  const input = path.join(__dirname, './uploads/', req.file.filename);
  const folders = fs.readdirSync('live_stream/');
  // const output = path.join(__dirname, './live_stream/', `segment_${folders.length + 1}.`);
  console.log(input);

  // fs.renameSync(input, output);
  // res.send('Video uploaded and streaming started');

  exec(
    `ffmpeg -i ${input} -c:v vp8 -c:a libvorbis -f webm -speed 10 -threads 8 -preset ultrafast "live_stream/segment_${folders.length + 1}.webm"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        console.error(`stderr: ${stderr}`);
        return res.status(500).send('Error processing video');
      }
      fs.unlinkSync(input);
      res.send('Video uploaded and streaming started');
    }
  );
});

app.get('/api/current_stream', (req, res) => {
  const webcamFolder = fs.readdirSync('live_stream/');

  return res
    .status(200)
    .json({
      liveWebcamCount: webcamFolder.length,
    });
});

const io = socketIo(server);

let liveCount = 0;

io.on('connection', (socket) => {
  console.log('A user connected', socket.id);

  socket.on('join', (data) => {
    console.log('Received message: ', data);

    liveCount++;
    socket.broadcast.emit('joined', { count: liveCount, ...data });
    socket.emit('joined', { count: liveCount, ...data });
  });

  socket.on('message', (data) => {
    console.log('Received message: ', data);
    socket.broadcast.emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');

    if (liveCount > 0) liveCount--;
  });
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
