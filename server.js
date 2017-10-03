"use strict";
var players = [];    // players placed in the array based on their number
var counter = 0;     // count inputs
var maxPlayers = 64; // 2 ^ 6 bits
////////////////////////////////////////////////////////////////////////////////
// SERVER //////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var http = require("http");
var express = require("express");
var Player = require("./public/player");
var app = express().use(express.static(__dirname + "/public/"));
var port = process.env.PORT || 8080;
var server = http.createServer(app).listen(port, function() {
  console.log('Listening on %d', server.address().port);
});
var WebSocket = require('ws');
var wss = new WebSocket.Server({server});
////////////////////////////////////////////////////////////////////////////////
// WEBSOCKET ///////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
wss.on('connection', function(ws) {

  ws.on('message', function(data) {
    var packet = JSON.parse(data);

    if (packet.name) {
      if (players.length < maxPlayers) {
        players.push(new Player(packet.name,
                                Math.round(Math.random()*800+100),
                                Math.round(Math.random()*800+100),
                                0,   //angle.base
                                0)); //kills
        ws.number = players.length - 1;
        start(ws);
        add(ws);
      } else {
        ws.send(JSON.stringify({error : "Sorry, too many players."}));
      }//if (players.length < maxPlayers)


    } else if (players[ws.number]){
      var number = ws.number;
      counter += 1;
      players[number].last += (packet >>> 26);
      packet = packet << 6 >>> 6;
      if (players[number].dead && (players[number].deadStep === players[number].step)) {packet |= 128;} //flag.dead
      players[number].inputs.push(packet);
      players[number].move();
      players[number].inputs.shift();
      players[number].snapshot(counter);
      if (players[number].shooting) {
        var enemies = getEnemies(number);
        var dead = players[number].shoot(enemies);
        if (dead) {
          players[dead].dead = true;
          players[dead].deadStep = players[dead].step;
          players[number].kills += 1;
          packet |= 64; //flag.kill
        }//if (dead)
      }//if (players[number].shooting)
      packet += (number << 26);
      broadcast(packet);
    }
  });//message

  ws.on('close', function (event) {
    if (players[ws.number]) {
      players.splice(ws.number, 1);
      wss.clients.forEach(function each(client) {
        if (client.number > ws.number) {client.number -= 1;}
      });
    }
    broadcast({remove : {number:ws.number}});
  });//close

});//connection
////////////////////////////////////////////////////////////////////////////////
// START ///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function start(ws) {
  var packet = [];

  for (var i = 0; i < players.length; i++) {
    packet[i] = {
      name  : players[i].name,
      x     : players[i].x,
      y     : players[i].y,
      angle : players[i].angle.base,
      kills : players[i].kills};
  }

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({start : packet}));
  }
};
////////////////////////////////////////////////////////////////////////////////
// ADD /////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function add(ws) {
  var i = players.length - 1;

  var packet = {
    name  : players[i].name,
    x     : players[i].x,
    y     : players[i].y,
    angle : players[i].angle.base,
    kills : players[i].kills};

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client !== ws && players[client.number]) {
      client.send(JSON.stringify({add : packet}));
    }
  });

};
////////////////////////////////////////////////////////////////////////////////
// BROADCAST ///////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && players[client.number]) {
      client.send(JSON.stringify(data));
    }
  });
};
////////////////////////////////////////////////////////////////////////////////
// ENEMIES /////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function getEnemies(number) {
  var margin = players[number].step - players[number].last;
  if (margin < 0) {console.log("Number: "+number+" Step: "+players[number].step+" last: "+players[number].last);}
  var step = players[number].snapshots[margin].counter;
  var enemies = {};

  for (var i = 0; i < players.length; i++) {
    if (i === number) {continue;}
    for (var s = 0; s < players[i].snapshots.length; s++) {
      if (step > players[i].snapshots[s].counter) {
        if      (players[i].snapshots[s+2]) {enemies[i] = players[i].snapshots[s+2];}
        else if (players[i].snapshots[s+1]) {enemies[i] = players[i].snapshots[s+1];}
        else                                {enemies[i] = players[i].snapshots[s];}
        break;
      }
    }//for (var s = 0; s < players[i].snapshots.length; s++)
  }//for (var i = 0; i < players.length; i++)
  return enemies;
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
