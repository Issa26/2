var express = require('express');
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require('fs');
const multiparty = require('multiparty');
app.use(express.static(__dirname + '/public'));
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";



app.get('/', function (req, res) {
    res.sendfile('app.html');
});

var connectedSockets={};
var allUsers=[{nickname:"",color:"#000",channel:''}];//初始值即包含"群聊",用""表示nickname
io.on('connection',function(socket) {


    socket.on('addUser', function (data) { //有新用户进入聊天室
        if (connectedSockets[data.nickname]) {//昵称已被占用
            socket.emit('userAddingResult', {result: false});
        } else {
            socket.emit('userAddingResult', {result: true});
            socket.nickname = data.nickname;
            socket.channel = data.channel;
            connectedSockets[socket.nickname] = socket;//保存每个socket实例,发私信需要用
            allUsers.push(data);
            socket.broadcast.emit('userAdded', data);//广播欢迎新用户,除新用户外都可看到
            socket.emit('allUser', allUsers);//将所有在线用户发给新用户
        }

    });

    socket.on('addMessage', function (data) { //有用户发送新消息
        let form = new multiparty.Form();
        /* 设置编辑 */
        form.encoding = 'utf-8';
        //设置文件存储路劲
        form.uploadDir = './tmplFile';
        form.parse(function (err, fields, files) {
            try {
                let inputFile = files.file[0];
                let uploadedPath = inputFile.path;
                let newPath = form.uploadDir + "/" + inputFile.originalFilename;
                //同步重命名文件名 fs.renameSync(oldPath, newPath)
                fs.renameSync(inputFile.path, newPath);
                // res.send({ data: "上传成功！" });
                //读取数据后 删除文件
                // fs.unlink(newPath, function () {
                //   console.log("删除上传文件");
                // })
                data.url = newPath;
            } catch (err) {
                console.log(err);
              //  res.send({ err: "上传失败！" });
            };
        })

        if (data.to) {//发给特定用户
            connectedSockets[data.to].emit('messageAdded', data);
        } else {//群发
            socket.broadcast.emit('messageAdded', data);//广播消息,除原发送者外都可看到
        }



    });

    socket.on('disconnect', function () {  //有用户退出聊天室
        socket.broadcast.emit('userRemoved', {  //广播有用户退出
            nickname: socket.nickname
        });
        for (var i = 0; i < allUsers.length; i++) {
            if (allUsers[i].nickname == socket.nickname) {
                allUsers.splice(i, 1);
            }
        }
        delete connectedSockets[socket.nickname]; //删除对应的socket实例

    });

    socket.on('list', function (data) {
        var str = JSON.stringify(data);//因为nodejs的写入文件只认识字符串或者二进制数，所以把json对象转换成字符串重新写入json文件中
        MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
            if (err) throw err;
            var dbo = db.db("runoob");
            var myobj = str;
            dbo.collection("site").insertOne(myobj, function(err, res) {
                if (err) throw err;
                console.log("文档插入成功");
                db.close();
            });
        });

    });

    socket.on('li', function (data) {
        MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
            if (err) throw err;
            var dbo = db.db("runoob");
            var whereStr = {};  // 查询条件
            dbo.collection("site").find(whereStr).toArray(function(err, result) {
                if (err) throw err;
                console.log(result);
                var sss = data.toString();//将二进制的数据转换为字符串
                socket.emit('lis', sss);//将所有在线用户发给新用户
                db.close();
            });
        });
    });




})



http.listen(3000, function () {
    console.log('listening on *:3000');
});